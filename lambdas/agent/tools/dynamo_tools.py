"""
DynamoDB Tools for HOH Meal Agent

These tools allow the agent to interact with the HOH DynamoDB tables
to retrieve family information, preferences, and meal plans.
"""

import os
import boto3
from strands import tool
from typing import Optional
from datetime import datetime

# Initialize DynamoDB client
dynamodb = boto3.resource('dynamodb', region_name=os.getenv('AWS_REGION', 'us-east-1'))
USERS_TABLE = os.getenv('USERS_TABLE', 'hoh-users-2026')
MEAL_PLANS_TABLE = os.getenv('MEAL_PLANS_TABLE', 'hoh-meal-plans-2026')


@tool
def get_family_members(household_id: str) -> dict:
    """Get all family members in a household with their dietary restrictions and preferences.

    Use this tool to understand who is in the family, their ages, dietary restrictions,
    allergies, food likes/dislikes, and whether they eat the same meals as adults.

    Args:
        household_id: The unique identifier for the household

    Returns:
        A dictionary containing the list of family members with their details including:
        - name: Member's name
        - age: Member's age (if provided)
        - dietaryRestrictions: List of dietary restrictions (vegetarian, vegan, etc.)
        - allergies: List of food allergies
        - likes: Foods they enjoy
        - dislikes: Foods they don't like
        - sameAsAdults: Whether they eat the same meals as adults
        - mealPreferences: Specific breakfast/lunch/dinner preferences if different from adults
    """
    try:
        table = dynamodb.Table(USERS_TABLE)

        response = table.query(
            KeyConditionExpression='PK = :pk AND begins_with(SK, :sk)',
            ExpressionAttributeValues={
                ':pk': f'HOUSEHOLD#{household_id}',
                ':sk': 'MEMBER#'
            }
        )

        members = []
        for item in response.get('Items', []):
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
            members.append(member)

        return {
            'status': 'success',
            'householdId': household_id,
            'memberCount': len(members),
            'members': members
        }

    except Exception as e:
        return {
            'status': 'error',
            'error': str(e)
        }


@tool
def get_family_preferences(household_id: str) -> dict:
    """Get the household's meal preferences and typical meals.

    Use this tool to understand the family's overall meal preferences including:
    - Meal suggestion mode (user preferences only, AI suggestions, or both)
    - Cooking time preferences (quick, medium, elaborate)
    - Typical breakfast, lunch, dinner, and snack options they enjoy
    - Any additional preferences described in natural language

    Args:
        household_id: The unique identifier for the household

    Returns:
        A dictionary containing:
        - mealSuggestionMode: 'user_preference', 'ai_suggest', or 'ai_and_user'
        - cookingTime: 'quick' (under 20min), 'medium' (20-45min), or 'elaborate' (45min+)
        - typicalBreakfast: List of breakfast items they usually eat
        - typicalLunch: List of lunch items they usually eat
        - typicalDinner: List of dinner items they usually eat
        - typicalSnacks: List of snacks they enjoy
        - additionalPreferences: Free-text preferences (e.g., "budget-friendly", "one-pot meals")
    """
    try:
        table = dynamodb.Table(USERS_TABLE)

        response = table.get_item(
            Key={
                'PK': f'HOUSEHOLD#{household_id}',
                'SK': 'PREFERENCES'
            }
        )

        item = response.get('Item', {})

        preferences = {
            'status': 'success',
            'householdId': household_id,
            'mealSuggestionMode': item.get('mealSuggestionMode', 'ai_and_user'),
            'cookingTime': item.get('cookingTime', 'medium'),
            'typicalBreakfast': item.get('typicalBreakfast', []),
            'typicalLunch': item.get('typicalLunch', []),
            'typicalDinner': item.get('typicalDinner', []),
            'typicalSnacks': item.get('typicalSnacks', []),
            'additionalPreferences': item.get('additionalPreferences', ''),
        }

        return preferences

    except Exception as e:
        return {
            'status': 'error',
            'error': str(e)
        }


@tool
def get_meal_plan(household_id: str, start_date: str) -> dict:
    """Get the existing meal plan for a household starting from a specific date.

    Use this tool to retrieve a previously generated meal plan. The meal plan
    contains breakfast, lunch, and dinner for each day of the week.

    Args:
        household_id: The unique identifier for the household
        start_date: The start date of the week in YYYY-MM-DD format (should be a Monday)

    Returns:
        A dictionary containing:
        - meals: List of meal objects for the week, each containing:
          - day: Day of the week (monday, tuesday, etc.)
          - date: The date in YYYY-MM-DD format
          - breakfast, lunch, dinner: Meal details with id, title, image, readyInMinutes
          - personalizedMeals: Different meals for family members with specific needs
    """
    try:
        table = dynamodb.Table(MEAL_PLANS_TABLE)

        response = table.get_item(
            Key={
                'PK': f'HOUSEHOLD#{household_id}',
                'SK': f'WEEK#{start_date}'
            }
        )

        item = response.get('Item')

        if not item:
            return {
                'status': 'not_found',
                'message': f'No meal plan found for week starting {start_date}'
            }

        return {
            'status': 'success',
            'householdId': household_id,
            'startDate': start_date,
            'meals': item.get('meals', []),
            'createdAt': item.get('createdAt'),
            'updatedAt': item.get('updatedAt')
        }

    except Exception as e:
        return {
            'status': 'error',
            'error': str(e)
        }


@tool
def save_meal_plan(
    household_id: str,
    start_date: str,
    meals: list
) -> dict:
    """Save a generated meal plan for a household.

    Use this tool after generating or modifying a meal plan to persist it
    to the database. The meal plan should contain meals for each day of the week.

    Args:
        household_id: The unique identifier for the household
        start_date: The start date of the week in YYYY-MM-DD format (should be a Monday)
        meals: List of meal objects for the week. Each meal object should contain:
            - day: Day of the week (monday, tuesday, etc.)
            - date: The date in YYYY-MM-DD format
            - breakfast: Object with id, title, image, readyInMinutes, sourceUrl
            - lunch: Object with id, title, image, readyInMinutes, sourceUrl
            - dinner: Object with id, title, image, readyInMinutes, sourceUrl
            - personalizedMeals (optional): Dict mapping member IDs to their specific meals

    Returns:
        A dictionary with status and the saved meal plan details
    """
    try:
        table = dynamodb.Table(MEAL_PLANS_TABLE)

        now = datetime.utcnow().isoformat()

        item = {
            'PK': f'HOUSEHOLD#{household_id}',
            'SK': f'WEEK#{start_date}',
            'householdId': household_id,
            'startDate': start_date,
            'meals': meals,
            'createdAt': now,
            'updatedAt': now,
        }

        table.put_item(Item=item)

        return {
            'status': 'success',
            'message': f'Meal plan saved for week starting {start_date}',
            'householdId': household_id,
            'startDate': start_date,
            'mealCount': len(meals)
        }

    except Exception as e:
        return {
            'status': 'error',
            'error': str(e)
        }


@tool
def get_aggregated_dietary_needs(household_id: str) -> dict:
    """Get aggregated dietary restrictions and allergies for the household.

    Use this tool to get a summary of all dietary restrictions and allergies
    across all family members. This is useful when searching for recipes that
    need to accommodate everyone.

    Args:
        household_id: The unique identifier for the household

    Returns:
        A dictionary containing:
        - allRestrictions: Combined list of all dietary restrictions
        - allAllergies: Combined list of all allergies to avoid
        - allDislikes: Combined list of foods to avoid
        - membersWithDifferentMeals: List of members who need separate meals
    """
    try:
        # Get family members first
        members_result = get_family_members(household_id)

        if members_result.get('status') == 'error':
            return members_result

        members = members_result.get('members', [])

        all_restrictions = set()
        all_allergies = set()
        all_dislikes = set()
        members_different_meals = []

        for member in members:
            for restriction in member.get('dietaryRestrictions', []):
                all_restrictions.add(restriction)
            for allergy in member.get('allergies', []):
                all_allergies.add(allergy)
            for dislike in member.get('dislikes', []):
                all_dislikes.add(dislike)

            if not member.get('sameAsAdults', True):
                members_different_meals.append({
                    'id': member['id'],
                    'name': member['name'],
                    'age': member.get('age'),
                    'mealPreferences': member.get('mealPreferences')
                })

        return {
            'status': 'success',
            'householdId': household_id,
            'allRestrictions': list(all_restrictions),
            'allAllergies': list(all_allergies),
            'allDislikes': list(all_dislikes),
            'membersWithDifferentMeals': members_different_meals,
            'totalMembers': len(members)
        }

    except Exception as e:
        return {
            'status': 'error',
            'error': str(e)
        }
