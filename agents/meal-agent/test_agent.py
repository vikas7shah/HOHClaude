"""
Quick test script to verify the Meal Agent works locally.
"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Set required env vars if not set
os.environ.setdefault('AWS_REGION', 'us-east-1')
os.environ.setdefault('USERS_TABLE', 'hoh-users-2026')
os.environ.setdefault('MEAL_PLANS_TABLE', 'hoh-meal-plans-2026')

print("=" * 60)
print("🍽️  HOH Meal Agent - Quick Test")
print("=" * 60)

# Test 1: Import and create agent
print("\n📦 Test 1: Creating agent...")
try:
    from agent import create_meal_agent

    # Create agent with a test household
    agent = create_meal_agent(household_id="test-household")
    print("✅ Agent created successfully!")
except Exception as e:
    print(f"❌ Failed to create agent: {e}")
    exit(1)

# Test 2: Simple query (won't use DynamoDB, just tests Bedrock connection)
print("\n🧠 Test 2: Testing simple query (Claude via Bedrock)...")
try:
    response = agent("What are 3 quick dinner ideas that take less than 30 minutes? Just list them briefly.")
    print(f"✅ Got response:\n{response}")
except Exception as e:
    print(f"❌ Failed to get response: {e}")
    import traceback
    traceback.print_exc()

# Test 3: Test Spoonacular API
print("\n🥘 Test 3: Testing Spoonacular API...")
try:
    from tools.spoonacular_tools import search_recipes

    result = search_recipes(query="quick pasta", max_ready_time=30, number=3)
    if result['status'] == 'success':
        print(f"✅ Spoonacular API working! Found {result['totalResults']} recipes")
        for recipe in result['recipes'][:3]:
            print(f"   - {recipe['title']} ({recipe['readyInMinutes']} min)")
    else:
        print(f"❌ Spoonacular error: {result.get('error')}")
except Exception as e:
    print(f"❌ Spoonacular test failed: {e}")

# Test 4: Test DynamoDB connection
print("\n📊 Test 4: Testing DynamoDB connection...")
try:
    from tools.dynamo_tools import get_family_preferences

    # This will likely return empty/error for test household, but tests connection
    result = get_family_preferences("test-household-123")
    print(f"✅ DynamoDB connection working!")
    print(f"   Result status: {result.get('status')}")
except Exception as e:
    print(f"❌ DynamoDB test failed: {e}")

print("\n" + "=" * 60)
print("🏁 Test complete!")
print("=" * 60)
