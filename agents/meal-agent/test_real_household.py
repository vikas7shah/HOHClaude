"""
Test the Meal Agent with a real household from the database.
"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Set required env vars
os.environ.setdefault('AWS_REGION', 'us-east-1')
os.environ.setdefault('USERS_TABLE', 'hoh-users-2026')
os.environ.setdefault('MEAL_PLANS_TABLE', 'hoh-meal-plans-2026')

# Real household ID from your app
HOUSEHOLD_ID = "d004460c-d9e7-475c-923f-4a19b4865f11"

print("=" * 70)
print("🍽️  HOH Meal Agent - Real Household Test")
print("=" * 70)
print(f"📍 Household ID: {HOUSEHOLD_ID}")

# Create agent
print("\n📦 Creating agent...")
from agent import create_meal_agent

agent = create_meal_agent(household_id=HOUSEHOLD_ID)
print("✅ Agent created!")

# Test queries
test_queries = [
    "What are my family's dietary preferences and restrictions?",
    "Suggest 3 dinner ideas for tonight that would work for my family",
]

for i, query in enumerate(test_queries, 1):
    print(f"\n{'='*70}")
    print(f"🧪 Test {i}: {query}")
    print("=" * 70)

    try:
        response = agent(query)
        print(f"\n✅ Response:\n{response}")
    except Exception as e:
        print(f"❌ Error: {e}")

print("\n" + "=" * 70)
print("🏁 Real household test complete!")
print("=" * 70)
