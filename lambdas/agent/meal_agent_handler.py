"""
Lambda Handler for HOH Meal Agent

This handler receives requests from API Gateway and processes them
using the Strands-based Meal Agent with Claude Sonnet 4.5.
"""

import os
import json
import logging
import boto3
from typing import Any, Dict

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

    # Create model with Claude Sonnet 4.5
    model = BedrockModel(
        model_id=os.getenv('MODEL_ID', 'us.anthropic.claude-sonnet-4-5-20250929-v1:0'),
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


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for the Meal Agent API.

    Expects:
    - Authorization header with Cognito JWT
    - Body: { "message": "user's question" }

    Returns:
    - { "response": "agent's reply", "household_id": "..." }
    """
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
                    'Access-Control-Allow-Origin': '*',
                },
                'body': json.dumps({'error': 'Unauthorized - no user ID found'})
            }

        # Parse request body
        body = json.loads(event.get('body', '{}'))
        message = body.get('message')

        if not message:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                'body': json.dumps({'error': 'Missing required field: message'})
            }

        # Get user's household
        household_id = get_user_household_id(user_id)

        if not household_id:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                'body': json.dumps({'error': 'User is not part of a household. Please create or join a household first.'})
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
                'Access-Control-Allow-Origin': '*',
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
                'Access-Control-Allow-Origin': '*',
            },
            'body': json.dumps({'error': 'Invalid JSON in request body'})
        }
    except Exception as e:
        logger.error(f"Error processing request: {e}", exc_info=True)
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e)
            })
        }
