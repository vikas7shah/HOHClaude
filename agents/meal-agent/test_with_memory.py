"""
Test the Meal Agent with AgentCore memory.
"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Set required env vars
os.environ.setdefault('AWS_REGION', 'us-east-1')
os.environ.setdefault('USERS_TABLE', 'hoh-users-2026')
os.environ.setdefault('MEAL_PLANS_TABLE', 'hoh-meal-plans-2026')

# Real household ID
HOUSEHOLD_ID = "d004460c-d9e7-475c-923f-4a19b4865f11"

print("=" * 70)
print("🍽️  HOH Meal Agent - Test with Memory")
print("=" * 70)
print(f"📍 Household ID: {HOUSEHOLD_ID}")

# Create agent with memory
print("\n📦 Creating agent with memory...")
from agent_with_memory import create_meal_agent_with_memory

agent = create_meal_agent_with_memory(
    household_id=HOUSEHOLD_ID,
    session_id="test-session-001"  # Fixed session for testing
)
print("✅ Agent created!")

# Test conversation that should trigger memory learning
print("\n" + "=" * 70)
print("🧪 Testing memory-enabled conversation...")
print("=" * 70)

try:
    # First message - should learn preference
    print("\n👤 User: We tried the chana masala last night and everyone loved it!")
    response = agent("We tried the chana masala last night and everyone loved it!")
    print(f"\n🤖 Agent: {response}")

    # Second message - should use context
    print("\n" + "-" * 50)
    print("\n👤 User: Can you suggest something similar for tomorrow?")
    response = agent("Can you suggest something similar for tomorrow?")
    print(f"\n🤖 Agent: {response}")

except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 70)
print("🏁 Memory test complete!")
print("=" * 70)
