"""
Spoonacular API Tools for HOH Meal Agent

These tools allow the agent to search for recipes, get recipe details,
and generate meal plans using the Spoonacular API.
"""

import os
import json
import httpx
import boto3
from strands import tool
from typing import Optional

SPOONACULAR_BASE_URL = 'https://api.spoonacular.com'

# Cache API key to avoid repeated Secrets Manager calls
_cached_api_key = None


def _get_api_key() -> str:
    """Get API key from Secrets Manager, with caching."""
    global _cached_api_key

    if _cached_api_key:
        return _cached_api_key

    secret_name = os.getenv('SPOONACULAR_SECRET_NAME', 'hoh/spoonacular-api-key')
    region = os.getenv('AWS_REGION', 'us-east-1')

    try:
        client = boto3.client('secretsmanager', region_name=region)
        response = client.get_secret_value(SecretId=secret_name)
        secret = json.loads(response['SecretString'])
        _cached_api_key = secret.get('api_key')

        if not _cached_api_key:
            raise ValueError("api_key not found in secret")

        return _cached_api_key
    except Exception as e:
        raise ValueError(f"Failed to retrieve Spoonacular API key: {e}")


# Map common dietary restrictions to Spoonacular diet parameter
DIET_MAP = {
    'vegetarian': 'vegetarian',
    'vegan': 'vegan',
    'gluten-free': 'gluten free',
    'gluten free': 'gluten free',
    'dairy-free': 'dairy free',
    'dairy free': 'dairy free',
    'keto': 'ketogenic',
    'ketogenic': 'ketogenic',
    'paleo': 'paleo',
    'whole30': 'whole30',
    'pescetarian': 'pescetarian',
    'lacto-vegetarian': 'lacto-vegetarian',
    'ovo-vegetarian': 'ovo-vegetarian',
}


def _map_diet(restrictions: list) -> Optional[str]:
    """Convert dietary restrictions to Spoonacular diet parameter."""
    for restriction in restrictions:
        diet = DIET_MAP.get(restriction.lower())
        if diet:
            return diet
    return None


@tool
def search_recipes(
    query: str,
    cuisine: Optional[str] = None,
    diet: Optional[str] = None,
    intolerances: Optional[str] = None,
    exclude_ingredients: Optional[str] = None,
    meal_type: Optional[str] = None,
    max_ready_time: Optional[int] = None,
    number: int = 10,
    offset: int = 0,
    sort: Optional[str] = None
) -> dict:
    """Search for recipes based on various criteria.

    Use this tool to find recipes matching specific requirements like cuisine type,
    dietary restrictions, allergies (intolerances), and cooking time limits.

    Args:
        query: Search query for recipes (e.g., "pasta", "chicken dinner", "quick breakfast")
        cuisine: Cuisine type (e.g., "italian", "mexican", "asian", "mediterranean", "american", "indian")
        diet: Dietary restriction (e.g., "vegetarian", "vegan", "gluten free", "ketogenic", "paleo")
        intolerances: Comma-separated allergies to avoid (e.g., "dairy,gluten,peanut,shellfish")
        exclude_ingredients: Comma-separated ingredients to exclude (e.g., "mushrooms,olives")
        meal_type: Type of meal (e.g., "breakfast", "main course", "snack", "dessert", "soup", "salad")
        max_ready_time: Maximum cooking time in minutes
        number: Number of results to return (default 10, max 100)
        offset: Number of results to skip for pagination (use to get different results each time)
        sort: Sort order - use "random" to get varied results, "popularity", "healthiness", or "time"

    Returns:
        A dictionary containing:
        - results: List of recipe objects with id, title, image, readyInMinutes, servings
        - totalResults: Total number of matching recipes
    """
    try:
        api_key = _get_api_key()

        params = {
            'apiKey': api_key,
            'query': query,
            'number': min(number, 100),
            'addRecipeInformation': 'true',
        }

        if cuisine:
            params['cuisine'] = cuisine
        if diet:
            params['diet'] = diet
        if intolerances:
            params['intolerances'] = intolerances
        if exclude_ingredients:
            params['excludeIngredients'] = exclude_ingredients
        if meal_type:
            params['type'] = meal_type
        if max_ready_time:
            params['maxReadyTime'] = max_ready_time
        if offset > 0:
            params['offset'] = offset
        if sort:
            params['sort'] = sort
            params['sortDirection'] = 'desc'

        with httpx.Client() as client:
            response = client.get(
                f'{SPOONACULAR_BASE_URL}/recipes/complexSearch',
                params=params,
                timeout=30.0
            )
            response.raise_for_status()
            data = response.json()

        # Format results
        recipes = []
        for recipe in data.get('results', []):
            recipes.append({
                'id': recipe['id'],
                'title': recipe['title'],
                'image': recipe.get('image', ''),
                'readyInMinutes': recipe.get('readyInMinutes', 0),
                'servings': recipe.get('servings', 0),
                'sourceUrl': recipe.get('sourceUrl', ''),
                'summary': recipe.get('summary', '')[:200] + '...' if recipe.get('summary') else '',
                'healthScore': recipe.get('healthScore', 0),
                'cuisines': recipe.get('cuisines', []),
                'dishTypes': recipe.get('dishTypes', []),
                'diets': recipe.get('diets', []),
            })

        return {
            'status': 'success',
            'query': query,
            'totalResults': data.get('totalResults', 0),
            'resultsReturned': len(recipes),
            'recipes': recipes
        }

    except httpx.HTTPStatusError as e:
        return {
            'status': 'error',
            'error': f'Spoonacular API error: {e.response.status_code}'
        }
    except Exception as e:
        return {
            'status': 'error',
            'error': str(e)
        }


@tool
def search_recipes_by_ingredients(
    ingredients: str,
    number: int = 10,
    ranking: int = 1,
    ignore_pantry: bool = True
) -> dict:
    """Search for recipes that use specific ingredients.

    Use this tool when you want to find recipes based on ingredients the user has
    available (e.g., in their pantry). This is great for minimizing waste and
    using up ingredients.

    Args:
        ingredients: Comma-separated list of ingredients (e.g., "chicken,rice,broccoli")
        number: Number of results to return (default 10, max 100)
        ranking: 1 = maximize used ingredients, 2 = minimize missing ingredients
        ignore_pantry: If true, ignore typical pantry items when calculating missing ingredients

    Returns:
        A dictionary containing recipes that use the specified ingredients, showing:
        - usedIngredients: Ingredients from the list used in the recipe
        - missedIngredients: Additional ingredients needed
    """
    try:
        api_key = _get_api_key()

        params = {
            'apiKey': api_key,
            'ingredients': ingredients,
            'number': min(number, 100),
            'ranking': ranking,
            'ignorePantry': str(ignore_pantry).lower(),
        }

        with httpx.Client() as client:
            response = client.get(
                f'{SPOONACULAR_BASE_URL}/recipes/findByIngredients',
                params=params,
                timeout=30.0
            )
            response.raise_for_status()
            data = response.json()

        recipes = []
        for recipe in data:
            recipes.append({
                'id': recipe['id'],
                'title': recipe['title'],
                'image': recipe.get('image', ''),
                'usedIngredientCount': recipe.get('usedIngredientCount', 0),
                'missedIngredientCount': recipe.get('missedIngredientCount', 0),
                'usedIngredients': [i['name'] for i in recipe.get('usedIngredients', [])],
                'missedIngredients': [i['name'] for i in recipe.get('missedIngredients', [])],
            })

        return {
            'status': 'success',
            'ingredients': ingredients,
            'recipesFound': len(recipes),
            'recipes': recipes
        }

    except httpx.HTTPStatusError as e:
        return {
            'status': 'error',
            'error': f'Spoonacular API error: {e.response.status_code}'
        }
    except Exception as e:
        return {
            'status': 'error',
            'error': str(e)
        }


@tool
def get_recipe_details(recipe_id: int) -> dict:
    """Get detailed information about a specific recipe.

    Use this tool to get complete recipe information including ingredients,
    instructions, nutrition, and more. Use this after searching for recipes
    to get the full details.

    Args:
        recipe_id: The Spoonacular recipe ID

    Returns:
        Complete recipe details including:
        - title, image, sourceUrl
        - readyInMinutes, servings
        - ingredients with amounts
        - step-by-step instructions
        - nutrition information
        - dietary information (vegetarian, vegan, gluten-free, etc.)
    """
    try:
        api_key = _get_api_key()

        params = {
            'apiKey': api_key,
            'includeNutrition': 'true',
        }

        with httpx.Client() as client:
            response = client.get(
                f'{SPOONACULAR_BASE_URL}/recipes/{recipe_id}/information',
                params=params,
                timeout=30.0
            )
            response.raise_for_status()
            recipe = response.json()

        # Extract key nutrition info
        nutrition = {}
        if recipe.get('nutrition') and recipe['nutrition'].get('nutrients'):
            for nutrient in recipe['nutrition']['nutrients']:
                if nutrient['name'] in ['Calories', 'Protein', 'Carbohydrates', 'Fat']:
                    nutrition[nutrient['name'].lower()] = {
                        'amount': nutrient['amount'],
                        'unit': nutrient['unit']
                    }

        # Format ingredients
        ingredients = []
        for ing in recipe.get('extendedIngredients', []):
            ingredients.append({
                'name': ing['name'],
                'amount': ing['amount'],
                'unit': ing['unit'],
                'original': ing['original']
            })

        # Format instructions
        instructions = []
        if recipe.get('analyzedInstructions'):
            for instruction_set in recipe['analyzedInstructions']:
                for step in instruction_set.get('steps', []):
                    instructions.append({
                        'number': step['number'],
                        'step': step['step']
                    })

        return {
            'status': 'success',
            'recipe': {
                'id': recipe['id'],
                'title': recipe['title'],
                'image': recipe.get('image', ''),
                'sourceUrl': recipe.get('sourceUrl', ''),
                'readyInMinutes': recipe.get('readyInMinutes', 0),
                'servings': recipe.get('servings', 0),
                'summary': recipe.get('summary', ''),
                'ingredients': ingredients,
                'instructions': instructions,
                'nutrition': nutrition,
                'dietary': {
                    'vegetarian': recipe.get('vegetarian', False),
                    'vegan': recipe.get('vegan', False),
                    'glutenFree': recipe.get('glutenFree', False),
                    'dairyFree': recipe.get('dairyFree', False),
                    'veryHealthy': recipe.get('veryHealthy', False),
                },
                'cuisines': recipe.get('cuisines', []),
                'dishTypes': recipe.get('dishTypes', []),
            }
        }

    except httpx.HTTPStatusError as e:
        return {
            'status': 'error',
            'error': f'Spoonacular API error: {e.response.status_code}'
        }
    except Exception as e:
        return {
            'status': 'error',
            'error': str(e)
        }


@tool
def generate_meal_plan_from_api(
    time_frame: str = 'week',
    target_calories: Optional[int] = None,
    diet: Optional[str] = None,
    exclude: Optional[str] = None
) -> dict:
    """Generate a meal plan using Spoonacular's meal plan generator.

    Use this tool to get AI-generated meal suggestions for a day or week.
    The generated plan includes breakfast, lunch, and dinner with nutritional info.

    Args:
        time_frame: Either 'day' for one day or 'week' for a full week
        target_calories: Target daily calories (e.g., 2000)
        diet: Dietary restriction (e.g., "vegetarian", "vegan", "gluten free")
        exclude: Comma-separated ingredients to exclude (e.g., "shellfish,olives")

    Returns:
        A meal plan with:
        - For 'day': meals array with breakfast, lunch, dinner and daily nutrients
        - For 'week': meals for each day (monday through sunday) with nutrients
    """
    try:
        api_key = _get_api_key()

        params = {
            'apiKey': api_key,
            'timeFrame': time_frame,
        }

        if target_calories:
            params['targetCalories'] = target_calories
        if diet:
            params['diet'] = diet
        if exclude:
            params['exclude'] = exclude

        with httpx.Client() as client:
            response = client.get(
                f'{SPOONACULAR_BASE_URL}/mealplanner/generate',
                params=params,
                timeout=30.0
            )
            response.raise_for_status()
            data = response.json()

        if time_frame == 'day':
            meals = []
            for meal in data.get('meals', []):
                meals.append({
                    'id': meal['id'],
                    'title': meal['title'],
                    'readyInMinutes': meal.get('readyInMinutes', 0),
                    'servings': meal.get('servings', 0),
                    'sourceUrl': meal.get('sourceUrl', ''),
                })

            return {
                'status': 'success',
                'timeFrame': 'day',
                'meals': meals,
                'nutrients': data.get('nutrients', {})
            }
        else:
            # Week format
            week_plan = {}
            for day_name, day_data in data.get('week', {}).items():
                day_meals = []
                for meal in day_data.get('meals', []):
                    day_meals.append({
                        'id': meal['id'],
                        'title': meal['title'],
                        'readyInMinutes': meal.get('readyInMinutes', 0),
                        'servings': meal.get('servings', 0),
                        'sourceUrl': meal.get('sourceUrl', ''),
                    })

                week_plan[day_name] = {
                    'meals': day_meals,
                    'nutrients': day_data.get('nutrients', {})
                }

            return {
                'status': 'success',
                'timeFrame': 'week',
                'week': week_plan
            }

    except httpx.HTTPStatusError as e:
        return {
            'status': 'error',
            'error': f'Spoonacular API error: {e.response.status_code}'
        }
    except Exception as e:
        return {
            'status': 'error',
            'error': str(e)
        }


@tool
def get_random_recipes(
    number: int = 5,
    tags: Optional[str] = None
) -> dict:
    """Get random recipe suggestions.

    Use this tool when you want to surprise the user with random meal ideas
    or need variety in suggestions. Can be filtered by tags.

    Args:
        number: Number of random recipes to return (default 5, max 100)
        tags: Comma-separated tags to filter by (e.g., "vegetarian,dessert" or "dinner,italian")

    Returns:
        A list of random recipes with basic information
    """
    try:
        api_key = _get_api_key()

        params = {
            'apiKey': api_key,
            'number': min(number, 100),
        }

        if tags:
            params['tags'] = tags

        with httpx.Client() as client:
            response = client.get(
                f'{SPOONACULAR_BASE_URL}/recipes/random',
                params=params,
                timeout=30.0
            )
            response.raise_for_status()
            data = response.json()

        recipes = []
        for recipe in data.get('recipes', []):
            recipes.append({
                'id': recipe['id'],
                'title': recipe['title'],
                'image': recipe.get('image', ''),
                'readyInMinutes': recipe.get('readyInMinutes', 0),
                'servings': recipe.get('servings', 0),
                'sourceUrl': recipe.get('sourceUrl', ''),
                'summary': recipe.get('summary', '')[:200] + '...' if recipe.get('summary') else '',
                'cuisines': recipe.get('cuisines', []),
                'dishTypes': recipe.get('dishTypes', []),
            })

        return {
            'status': 'success',
            'recipesReturned': len(recipes),
            'recipes': recipes
        }

    except httpx.HTTPStatusError as e:
        return {
            'status': 'error',
            'error': f'Spoonacular API error: {e.response.status_code}'
        }
    except Exception as e:
        return {
            'status': 'error',
            'error': str(e)
        }
