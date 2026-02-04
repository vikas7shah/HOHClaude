"""
Tests for HOH Meal Agent Tools

Run with: pytest tests/test_tools.py -v
"""

import os
import pytest
from unittest.mock import Mock, patch, MagicMock

# Set test environment variables before imports
os.environ['AWS_REGION'] = 'us-east-1'
os.environ['USERS_TABLE'] = 'hoh-users-test'
os.environ['MEAL_PLANS_TABLE'] = 'hoh-meal-plans-test'
os.environ['SPOONACULAR_API_KEY'] = 'test-api-key'


class TestDynamoTools:
    """Tests for DynamoDB tools"""

    @patch('tools.dynamo_tools.dynamodb')
    def test_get_family_members_success(self, mock_dynamodb):
        """Test getting family members returns correct format"""
        from tools.dynamo_tools import get_family_members

        # Mock DynamoDB response
        mock_table = MagicMock()
        mock_dynamodb.Table.return_value = mock_table
        mock_table.query.return_value = {
            'Items': [
                {
                    'SK': 'MEMBER#123',
                    'name': 'John',
                    'age': 35,
                    'dietaryRestrictions': ['vegetarian'],
                    'allergies': ['peanuts'],
                    'sameAsAdults': True,
                },
                {
                    'SK': 'MEMBER#456',
                    'name': 'Junior',
                    'age': 5,
                    'sameAsAdults': False,
                    'mealPreferences': {
                        'breakfast': ['pancakes'],
                        'lunch': ['mac and cheese'],
                        'dinner': ['chicken nuggets']
                    }
                }
            ]
        }

        result = get_family_members('test-household')

        assert result['status'] == 'success'
        assert result['memberCount'] == 2
        assert len(result['members']) == 2
        assert result['members'][0]['name'] == 'John'
        assert result['members'][1]['sameAsAdults'] == False

    @patch('tools.dynamo_tools.dynamodb')
    def test_get_family_preferences_success(self, mock_dynamodb):
        """Test getting family preferences returns correct format"""
        from tools.dynamo_tools import get_family_preferences

        mock_table = MagicMock()
        mock_dynamodb.Table.return_value = mock_table
        mock_table.get_item.return_value = {
            'Item': {
                'mealSuggestionMode': 'ai_and_user',
                'cookingTime': 'quick',
                'typicalBreakfast': ['eggs', 'toast'],
                'typicalDinner': ['pasta', 'stir fry'],
                'additionalPreferences': 'Budget-friendly meals preferred'
            }
        }

        result = get_family_preferences('test-household')

        assert result['status'] == 'success'
        assert result['mealSuggestionMode'] == 'ai_and_user'
        assert result['cookingTime'] == 'quick'
        assert 'eggs' in result['typicalBreakfast']


class TestSpoonacularTools:
    """Tests for Spoonacular API tools"""

    @patch('tools.spoonacular_tools.httpx.Client')
    def test_search_recipes_success(self, mock_client_class):
        """Test recipe search returns correct format"""
        from tools.spoonacular_tools import search_recipes

        # Mock httpx response
        mock_client = MagicMock()
        mock_client_class.return_value.__enter__ = Mock(return_value=mock_client)
        mock_client_class.return_value.__exit__ = Mock(return_value=False)

        mock_response = MagicMock()
        mock_response.json.return_value = {
            'results': [
                {
                    'id': 123,
                    'title': 'Vegetarian Pasta',
                    'readyInMinutes': 30,
                    'servings': 4,
                    'image': 'https://example.com/pasta.jpg',
                }
            ],
            'totalResults': 100
        }
        mock_response.raise_for_status = Mock()
        mock_client.get.return_value = mock_response

        result = search_recipes(
            query='pasta',
            diet='vegetarian',
            max_ready_time=30
        )

        assert result['status'] == 'success'
        assert result['totalResults'] == 100
        assert len(result['recipes']) == 1
        assert result['recipes'][0]['title'] == 'Vegetarian Pasta'

    @patch('tools.spoonacular_tools.httpx.Client')
    def test_search_recipes_by_ingredients(self, mock_client_class):
        """Test search by ingredients returns correct format"""
        from tools.spoonacular_tools import search_recipes_by_ingredients

        mock_client = MagicMock()
        mock_client_class.return_value.__enter__ = Mock(return_value=mock_client)
        mock_client_class.return_value.__exit__ = Mock(return_value=False)

        mock_response = MagicMock()
        mock_response.json.return_value = [
            {
                'id': 456,
                'title': 'Chicken Stir Fry',
                'image': 'https://example.com/stirfry.jpg',
                'usedIngredientCount': 3,
                'missedIngredientCount': 2,
                'usedIngredients': [{'name': 'chicken'}, {'name': 'broccoli'}],
                'missedIngredients': [{'name': 'soy sauce'}],
            }
        ]
        mock_response.raise_for_status = Mock()
        mock_client.get.return_value = mock_response

        result = search_recipes_by_ingredients(ingredients='chicken,broccoli,rice')

        assert result['status'] == 'success'
        assert len(result['recipes']) == 1
        assert result['recipes'][0]['usedIngredientCount'] == 3


class TestAgentCreation:
    """Tests for agent creation"""

    @patch('agent.BedrockModel')
    def test_create_meal_agent(self, mock_model):
        """Test agent is created with correct configuration"""
        from agent import create_meal_agent

        mock_model.return_value = MagicMock()

        agent = create_meal_agent(household_id='test-household')

        assert agent is not None
        # Verify model was created with correct parameters
        mock_model.assert_called_once()


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
