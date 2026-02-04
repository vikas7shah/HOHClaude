"""
AWS Lambda/AgentCore Handler for HOH Meal Agent

This handler is designed for deployment to AWS Bedrock AgentCore Runtime.
It receives requests from API Gateway or AgentCore and processes them
using the Meal Recommendation Agent.
"""

import os
import json
import logging
from typing import Any, Dict

from strands import Agent
from strands.models import BedrockModel

# Import tools
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

# Configure logging
logger = logging.getLogger()
logger.setLevel(os.getenv('LOG_LEVEL', 'INFO'))

# System prompt
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
"""

# Cache for agent instances (warm starts)
_agent_cache: Dict[str, Agent] = {}


def get_agent(household_id: str) -> Agent:
    """
    Get or create an agent instance for the given household.
    Uses caching for Lambda warm starts.
    """
    if household_id not in _agent_cache:
        model = BedrockModel(
            model_id=os.getenv('MODEL_ID', 'us.anthropic.claude-sonnet-4-5-20250929-v1:0'),
            region_name=os.getenv('AWS_REGION', 'us-east-1')
        )

        system_prompt = SYSTEM_PROMPT + f"\n\n## Context\nHousehold: {household_id}"

        agent = Agent(
            model=model,
            system_prompt=system_prompt,
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

        _agent_cache[household_id] = agent
        logger.info(f"Created new agent for household: {household_id}")

    return _agent_cache[household_id]


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main handler for AgentCore Runtime / Lambda.

    Expects event with:
    - body: JSON string with 'message' and 'household_id'
    - OR direct invocation with 'message' and 'household_id'

    Returns:
    - statusCode: HTTP status code
    - body: JSON response with agent's reply
    """
    try:
        logger.info(f"Received event: {json.dumps(event)[:500]}...")

        # Parse input - handle both API Gateway and direct invocation
        if 'body' in event:
            # API Gateway format
            body = json.loads(event['body']) if isinstance(event['body'], str) else event['body']
        else:
            # Direct invocation
            body = event

        message = body.get('message')
        household_id = body.get('household_id')
        session_id = body.get('session_id')  # Optional for future memory integration

        # Validate required fields
        if not message:
            return {
                'statusCode': 400,
                'body': json.dumps({
                    'error': 'Missing required field: message'
                })
            }

        if not household_id:
            return {
                'statusCode': 400,
                'body': json.dumps({
                    'error': 'Missing required field: household_id'
                })
            }

        # Get the agent
        agent = get_agent(household_id)

        # Process the message
        logger.info(f"Processing message for household {household_id}: {message[:100]}...")

        # Call the agent (non-streaming for Lambda)
        response = agent(message)

        # Extract text response
        response_text = str(response) if response else "I'm sorry, I couldn't generate a response."

        logger.info(f"Agent response generated: {response_text[:200]}...")

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            'body': json.dumps({
                'response': response_text,
                'household_id': household_id,
                'session_id': session_id,
            })
        }

    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {e}")
        return {
            'statusCode': 400,
            'body': json.dumps({
                'error': 'Invalid JSON in request body'
            })
        }

    except Exception as e:
        logger.error(f"Error processing request: {e}", exc_info=True)
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e)
            })
        }


def streaming_handler(event: Dict[str, Any], context: Any):
    """
    Streaming handler for AgentCore Runtime with response streaming.

    Use this handler when you need real-time streaming responses.
    Configure in AgentCore as the streaming entry point.
    """
    try:
        # Parse input
        if 'body' in event:
            body = json.loads(event['body']) if isinstance(event['body'], str) else event['body']
        else:
            body = event

        message = body.get('message')
        household_id = body.get('household_id')

        if not message or not household_id:
            yield json.dumps({'error': 'Missing message or household_id'})
            return

        # Get the agent
        agent = get_agent(household_id)

        # Stream the response
        for chunk in agent.stream(message):
            if hasattr(chunk, 'text'):
                yield chunk.text
            elif isinstance(chunk, str):
                yield chunk

    except Exception as e:
        logger.error(f"Streaming error: {e}", exc_info=True)
        yield json.dumps({'error': str(e)})
