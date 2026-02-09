"""
Lambda Handler for HOH Meal Agent

This handler receives requests from API Gateway and processes them
using the Strands-based Meal Agent with Claude Haiku for cost-effective intelligence.
"""

import os
import json
import logging
import boto3
from typing import Any, Dict, Optional
from datetime import datetime, timedelta

# Set up logging
logger = logging.getLogger()
logger.setLevel(os.getenv('LOG_LEVEL', 'INFO'))

# Lazy imports for cold start optimization
_agent = None
_agent_household = None


def get_user_household_id(user_id: str) -> str:
    """Get the household ID for a user from DynamoDB."""
    dynamodb = boto3.resource('dynamodb', region_name=os.getenv('AWS_REGION', 'us-east-1'))
    table = dynamodb.Table(os.getenv('USERS_TABLE', 'hoh-users-2026'))

    try:
        response = table.get_item(
            Key={'PK': f'USER#{user_id}', 'SK': 'PROFILE'}
        )
        item = response.get('Item', {})
        return item.get('householdId')
    except Exception as e:
        logger.error(f"Error getting user household: {e}")
        return None


def get_household_context(household_id: str) -> dict:
    """Get all household context: family members, preferences, and dietary needs."""
    dynamodb = boto3.resource('dynamodb', region_name=os.getenv('AWS_REGION', 'us-east-1'))
    table = dynamodb.Table(os.getenv('USERS_TABLE', 'hoh-users-2026'))

    context = {
        'householdId': household_id,
        'members': [],
        'preferences': {},
        'aggregatedNeeds': {
            'allRestrictions': [],
            'allAllergies': [],
            'allDislikes': [],
        }
    }

    try:
        # Get family members
        members_response = table.query(
            KeyConditionExpression='PK = :pk AND begins_with(SK, :sk)',
            ExpressionAttributeValues={
                ':pk': f'HOUSEHOLD#{household_id}',
                ':sk': 'MEMBER#'
            }
        )

        all_restrictions = set()
        all_allergies = set()
        all_dislikes = set()

        for item in members_response.get('Items', []):
            member = {
                'id': item['SK'].replace('MEMBER#', ''),
                'name': item.get('name', 'Unknown'),
                'age': item.get('age'),
                'dietaryRestrictions': item.get('dietaryRestrictions', []),
                'allergies': item.get('allergies', []),
                'likes': item.get('likes', []),
                'dislikes': item.get('dislikes', []),
                'sameAsAdults': item.get('sameAsAdults', True),
                'mealPreferences': item.get('mealPreferences'),
            }
            context['members'].append(member)

            for r in member['dietaryRestrictions']:
                all_restrictions.add(r)
            for a in member['allergies']:
                all_allergies.add(a)
            for d in member['dislikes']:
                all_dislikes.add(d)

        context['aggregatedNeeds'] = {
            'allRestrictions': list(all_restrictions),
            'allAllergies': list(all_allergies),
            'allDislikes': list(all_dislikes),
        }

        # Get preferences
        prefs_response = table.get_item(
            Key={
                'PK': f'HOUSEHOLD#{household_id}',
                'SK': 'PREFERENCES'
            }
        )

        prefs_item = prefs_response.get('Item', {})
        context['preferences'] = {
            'mealSuggestionMode': prefs_item.get('mealSuggestionMode', 'ai_and_user'),
            'cookingTime': prefs_item.get('cookingTime', 'medium'),
            'typicalBreakfast': prefs_item.get('typicalBreakfast', []),
            'typicalLunch': prefs_item.get('typicalLunch', []),
            'typicalDinner': prefs_item.get('typicalDinner', []),
            'typicalSnacks': prefs_item.get('typicalSnacks', []),
            'additionalPreferences': prefs_item.get('additionalPreferences', ''),
        }

        return context

    except Exception as e:
        logger.error(f"Error getting household context: {e}")
        return context


def get_agent(household_id: str):
    """Get or create the meal agent for a household."""
    global _agent, _agent_household

    # Reuse agent if same household (Lambda warm start)
    if _agent is not None and _agent_household == household_id:
        return _agent

    # Import here to speed up cold starts
    from strands import Agent
    from strands.models import BedrockModel

    # Import custom tools
    from tools.dynamo_tools import (
        get_family_members,
        get_family_preferences,
        get_meal_plan,
        save_meal_plan,
        get_aggregated_dietary_needs,
    )
    from tools.spoonacular_tools import (
        search_recipes,
        search_recipes_by_ingredients,
        get_recipe_details,
        generate_meal_plan_from_api,
        get_random_recipes,
    )

    SYSTEM_PROMPT = """You are the HOH (Home Operations Hub) Meal Planning Assistant - a friendly, knowledgeable AI that helps families plan delicious, personalized meals.

## Your Personality
- Warm and approachable, like a helpful friend who loves cooking
- Enthusiastic about food but respectful of dietary needs and preferences
- Practical and understanding of busy family life

## Your Capabilities
You have access to tools that let you:
1. **Understand the Family**: Get family members, their dietary restrictions, allergies, likes/dislikes
2. **Know Their Preferences**: Retrieve meal preferences, cooking time limits, typical meals
3. **Find Perfect Recipes**: Search for recipes by cuisine, diet, ingredients, cooking time
4. **Generate Meal Plans**: Create weekly meal plans considering all family needs
5. **Save Plans**: Persist meal plans for the family

## Key Guidelines
- **Allergies are NON-NEGOTIABLE** - never suggest recipes with allergens
- **Respect dietary restrictions** - vegetarian, vegan, gluten-free, etc.
- **Consider cooking time** - quick meals for busy nights
- **Provide variety** - don't repeat meals too often
- Be conversational and explain your reasoning
- Keep responses concise but helpful
"""

    # Create model with Claude Haiku for cost efficiency
    model = BedrockModel(
        model_id=os.getenv('MODEL_ID', 'us.anthropic.claude-3-5-haiku-20241022-v1:0'),
        region_name=os.getenv('AWS_REGION', 'us-east-1')
    )

    # Create agent
    _agent = Agent(
        model=model,
        system_prompt=SYSTEM_PROMPT + f"\n\n## Context\nHousehold: {household_id}",
        tools=[
            get_family_members,
            get_family_preferences,
            get_meal_plan,
            save_meal_plan,
            get_aggregated_dietary_needs,
            search_recipes,
            search_recipes_by_ingredients,
            get_recipe_details,
            generate_meal_plan_from_api,
            get_random_recipes,
        ]
    )
    _agent_household = household_id

    logger.info(f"Created agent for household: {household_id}")
    return _agent


def generate_meal_plan_with_agent(household_id: str, start_date: str, user_id: str) -> dict:
    """
    Generate a personalized meal plan using the AI agent.

    This function:
    1. Gets household context (members, preferences, dietary needs)
    2. Creates a focused prompt with all the context
    3. Uses Claude Haiku to intelligently plan meals
    4. Saves the plan to DynamoDB

    Args:
        household_id: The household to generate meals for
        start_date: Start date in YYYY-MM-DD format
        user_id: The user who requested the plan

    Returns:
        Dictionary with meal plan or error
    """
    from strands import Agent
    from strands.models import BedrockModel
    from tools.spoonacular_tools import (
        search_recipes,
        get_recipe_details,
        generate_meal_plan_from_api,
    )

    try:
        # Get household context
        context = get_household_context(household_id)
        logger.info(f"Household context: {json.dumps(context, default=str)[:500]}")

        preferences = context['preferences']
        members = context['members']
        aggregated = context['aggregatedNeeds']

        # Build a detailed prompt for meal generation
        additional_prefs = preferences.get('additionalPreferences', '')
        cooking_time = preferences.get('cookingTime', 'medium')
        mode = preferences.get('mealSuggestionMode', 'ai_and_user')

        # Map cooking time to description
        cooking_time_desc = {
            'quick': 'under 20 minutes',
            'medium': '20-45 minutes',
            'elaborate': '45+ minutes (can be more complex)'
        }.get(cooking_time, '20-45 minutes')

        # Build member info
        member_info = []
        for m in members:
            info = f"- {m['name']}"
            if m.get('age'):
                info += f" (age {m['age']})"
            if m.get('dietaryRestrictions'):
                info += f", dietary: {', '.join(m['dietaryRestrictions'])}"
            if m.get('allergies'):
                info += f", allergies: {', '.join(m['allergies'])}"
            if not m.get('sameAsAdults', True):
                info += " (needs different meals)"
            member_info.append(info)

        # Build typical meals info
        typical_meals = []
        if preferences.get('typicalBreakfast'):
            typical_meals.append(f"Typical breakfast: {', '.join(preferences['typicalBreakfast'])}")
        if preferences.get('typicalLunch'):
            typical_meals.append(f"Typical lunch: {', '.join(preferences['typicalLunch'])}")
        if preferences.get('typicalDinner'):
            typical_meals.append(f"Typical dinner: {', '.join(preferences['typicalDinner'])}")
        if preferences.get('typicalSnacks'):
            typical_meals.append(f"Typical snacks: {', '.join(preferences['typicalSnacks'])}")

        # Determine meal generation strategy based on mode
        mode_instruction = ""
        if mode == 'user_preference':
            mode_instruction = """
Mode: USER PREFERENCES ONLY
For each meal, you MUST use one of the typical meals listed above.
You can still search Spoonacular to get recipe details (image, cook time) for the user's meals.
Interpret the additional preferences to decide WHEN to use each meal.
"""
        elif mode == 'ai_suggest':
            mode_instruction = """
Mode: AI SUGGESTIONS
Use the Spoonacular API to find new recipes for most meals.
Still consider typical meals as inspiration for what flavors/styles they like.
The additional preferences should guide your recipe selection.
"""
        else:
            mode_instruction = """
Mode: MIX OF USER AND AI
Combine the user's typical meals with new AI suggestions.
Use typical meals for some days (especially those matching additional preferences).
Use Spoonacular to find new recipes for variety on other days.
"""

        # Build the generation prompt
        generation_prompt = f"""Generate a weekly meal plan for this household starting {start_date}.

## Family Members:
{chr(10).join(member_info) if member_info else 'No members specified'}

## Cooking Time Preference:
{cooking_time_desc}

## Aggregated Dietary Needs:
- Dietary restrictions: {', '.join(aggregated['allRestrictions']) if aggregated['allRestrictions'] else 'None'}
- Allergies (MUST AVOID): {', '.join(aggregated['allAllergies']) if aggregated['allAllergies'] else 'None'}
- Dislikes (try to avoid): {', '.join(aggregated['allDislikes']) if aggregated['allDislikes'] else 'None'}

## Typical Meals:
{chr(10).join(typical_meals) if typical_meals else 'No typical meals specified'}

## Additional Preferences:
{additional_prefs if additional_prefs else 'None specified'}

{mode_instruction}

## Instructions:
1. First, analyze the additional preferences to understand special requirements (e.g., "cottage cheese on Sunday and Tuesday for breakfast" means specifically plan cottage cheese for those days)
2. Use the search_recipes tool to find appropriate recipes based on the diet, allergies, and preferences
3. Create a meal plan for 7 days (Monday to Sunday) with breakfast, lunch, and dinner
4. Each meal should have: recipeId, recipeName, recipeImage (URL), readyInMinutes, servings, sourceUrl
5. For user-provided meals without Spoonacular data, use recipeId like "user-meal-name-timestamp"
6. Ensure variety - don't repeat the same meal too often
7. Consider cooking time limits for each meal

Return the meal plan in this exact JSON format:
{{
  "meals": [
    {{
      "date": "YYYY-MM-DD",
      "day": "monday",
      "mealType": "breakfast|lunch|dinner|snacks",
      "recipeId": "string",
      "recipeName": "string",
      "recipeImage": "url or null",
      "readyInMinutes": number or null,
      "servings": number or null,
      "sourceUrl": "url or null",
      "source": "user_preference|ai_suggest",
      "isUserMeal": true|false
    }}
  ],
  "explanation": "Brief explanation of how you incorporated the preferences"
}}"""

        # Create a one-off agent for meal generation
        model = BedrockModel(
            model_id=os.getenv('MODEL_ID', 'us.anthropic.claude-3-5-haiku-20241022-v1:0'),
            region_name=os.getenv('AWS_REGION', 'us-east-1')
        )

        meal_agent = Agent(
            model=model,
            system_prompt="""You are a meal planning AI that generates personalized weekly meal plans.
You have access to the Spoonacular API to search for recipes.
Always respond with valid JSON in the specified format.
Be concise and efficient - minimize API calls while getting good results.""",
            tools=[
                search_recipes,
                get_recipe_details,
                generate_meal_plan_from_api,
            ]
        )

        logger.info(f"Calling agent with prompt: {generation_prompt[:500]}...")
        response = meal_agent(generation_prompt)
        response_text = str(response) if response else ""
        logger.info(f"Agent response: {response_text[:1000]}...")

        # Parse the response to extract JSON
        try:
            # Try to find JSON in the response
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1
            if json_start >= 0 and json_end > json_start:
                json_str = response_text[json_start:json_end]
                result = json.loads(json_str)
                meals = result.get('meals', [])
                explanation = result.get('explanation', '')

                # Save to DynamoDB
                dynamodb = boto3.resource('dynamodb', region_name=os.getenv('AWS_REGION', 'us-east-1'))
                table = dynamodb.Table(os.getenv('MEAL_PLANS_TABLE', 'hoh-meal-plans-2026'))

                # Calculate end date
                start = datetime.strptime(start_date, '%Y-%m-%d')
                end_date = (start + timedelta(days=6)).strftime('%Y-%m-%d')

                table.put_item(Item={
                    'PK': f'HOUSEHOLD#{household_id}',
                    'SK': f'PLAN#{start_date}',
                    'startDate': start_date,
                    'endDate': end_date,
                    'meals': meals,
                    'mealSuggestionMode': mode,
                    'generatedBy': user_id,
                    'generatedAt': datetime.utcnow().isoformat(),
                    'generatedByAgent': True,
                    'explanation': explanation,
                    'ttl': int(datetime.utcnow().timestamp()) + (90 * 24 * 60 * 60),
                })

                return {
                    'status': 'success',
                    'startDate': start_date,
                    'endDate': end_date,
                    'meals': meals,
                    'mealSuggestionMode': mode,
                    'explanation': explanation,
                }
            else:
                raise ValueError("No JSON found in response")

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse agent response as JSON: {e}")
            logger.error(f"Response was: {response_text}")
            return {
                'status': 'error',
                'error': 'Failed to parse meal plan from agent',
                'raw_response': response_text[:500]
            }

    except Exception as e:
        logger.error(f"Error generating meal plan with agent: {e}", exc_info=True)
        return {
            'status': 'error',
            'error': str(e)
        }


def get_cors_origin(event: dict) -> str:
    """Get the appropriate CORS origin header."""
    allowed_origins = os.getenv('ALLOWED_ORIGINS', 'https://www.homeoperationshub.com,https://homeoperationshub.com').split(',')
    request_origin = event.get('headers', {}).get('origin') or event.get('headers', {}).get('Origin')

    if request_origin and request_origin in allowed_origins:
        return request_origin
    return allowed_origins[0] if allowed_origins else 'https://www.homeoperationshub.com'


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for the Meal Agent API.

    Supports two modes:
    1. Chat mode: { "message": "user's question" }
    2. Generate mode: { "action": "generate", "startDate": "YYYY-MM-DD" }

    Returns:
    - Chat: { "response": "agent's reply", "household_id": "..." }
    - Generate: { "startDate": "...", "endDate": "...", "meals": [...] }
    """
    cors_origin = get_cors_origin(event)

    try:
        logger.info(f"Received event: {json.dumps(event)[:500]}")

        # Get user ID from Cognito authorizer
        claims = event.get('requestContext', {}).get('authorizer', {}).get('claims', {})
        user_id = claims.get('sub')

        if not user_id:
            return {
                'statusCode': 401,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': cors_origin,
                    'Access-Control-Allow-Credentials': 'true',
                },
                'body': json.dumps({'error': 'Unauthorized - no user ID found'})
            }

        # Parse request body
        body = json.loads(event.get('body', '{}'))
        action = body.get('action', 'chat')

        # Get user's household
        household_id = get_user_household_id(user_id)

        if not household_id:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': cors_origin,
                    'Access-Control-Allow-Credentials': 'true',
                },
                'body': json.dumps({'error': 'User is not part of a household. Please create or join a household first.'})
            }

        # Handle meal generation request
        if action == 'generate':
            start_date = body.get('startDate')
            if not start_date:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': cors_origin,
                        'Access-Control-Allow-Credentials': 'true',
                    },
                    'body': json.dumps({'error': 'startDate is required for meal generation'})
                }

            logger.info(f"Generating meal plan for user {user_id}, household {household_id}, start: {start_date}")

            result = generate_meal_plan_with_agent(household_id, start_date, user_id)

            if result.get('status') == 'error':
                return {
                    'statusCode': 500,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': cors_origin,
                        'Access-Control-Allow-Credentials': 'true',
                    },
                    'body': json.dumps({
                        'error': result.get('error', 'Failed to generate meal plan'),
                        'raw_response': result.get('raw_response')
                    })
                }

            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': cors_origin,
                    'Access-Control-Allow-Credentials': 'true',
                },
                'body': json.dumps(result)
            }

        # Handle chat request (default)
        message = body.get('message')

        if not message:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': cors_origin,
                    'Access-Control-Allow-Credentials': 'true',
                },
                'body': json.dumps({'error': 'Missing required field: message'})
            }

        logger.info(f"Processing message for user {user_id}, household {household_id}: {message[:100]}")

        # Get the agent and process message
        agent = get_agent(household_id)
        response = agent(message)

        response_text = str(response) if response else "I'm sorry, I couldn't generate a response."

        logger.info(f"Agent response: {response_text[:200]}")

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': cors_origin,
                'Access-Control-Allow-Credentials': 'true',
            },
            'body': json.dumps({
                'response': response_text,
                'household_id': household_id,
            })
        }

    except json.JSONDecodeError:
        return {
            'statusCode': 400,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': cors_origin,
                'Access-Control-Allow-Credentials': 'true',
            },
            'body': json.dumps({'error': 'Invalid JSON in request body'})
        }
    except Exception as e:
        logger.error(f"Error processing request: {e}", exc_info=True)
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': cors_origin,
                'Access-Control-Allow-Credentials': 'true',
            },
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e)
            })
        }
