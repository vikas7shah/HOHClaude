"""
HOH Meal Recommendation Agent

A sophisticated AI agent that provides personalized meal recommendations
by coordinating family preferences, dietary restrictions, and recipe discovery.

Built with Strands Agents SDK for deployment to AWS Bedrock AgentCore.
"""

import os
from strands import Agent
from strands.models import BedrockModel
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

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

# System prompt for the Meal Recommendation Agent
SYSTEM_PROMPT = """You are the HOH (Home Operations Hub) Meal Planning Assistant - a friendly, knowledgeable AI that helps families plan delicious, personalized meals.

## Your Personality
- Warm and approachable, like a helpful friend who loves cooking
- Enthusiastic about food but respectful of dietary needs and preferences
- Practical and understanding of busy family life
- Creative with suggestions but mindful of constraints

## Your Capabilities
You have access to tools that let you:
1. **Understand the Family**: Get family members, their ages, dietary restrictions, allergies, likes/dislikes
2. **Know Their Preferences**: Retrieve meal preferences, cooking time limits, typical meals they enjoy
3. **Find Perfect Recipes**: Search for recipes by cuisine, diet, ingredients, cooking time
4. **Generate Meal Plans**: Create weekly meal plans considering all family needs
5. **Save Plans**: Persist meal plans for the family to reference

## How to Approach Meal Planning

### Step 1: Gather Context
Always start by understanding the household:
- Use `get_family_members` to learn about who you're cooking for
- Use `get_family_preferences` to understand their preferences and constraints
- Use `get_aggregated_dietary_needs` to get a summary of all dietary requirements

### Step 2: Consider All Needs
When recommending recipes:
- **Allergies are NON-NEGOTIABLE** - never suggest recipes with allergens
- **Dietary restrictions matter** - respect vegetarian, vegan, gluten-free, etc.
- **Age-appropriate meals** - young children may need simpler, kid-friendly options
- **Time constraints** - quick meals for busy weeknights, elaborate for weekends
- **Variety** - don't repeat the same meals too often
- **Family members with different meal needs** - some kids may need separate meals

### Step 3: Natural Language Understanding
Users will express preferences naturally. Interpret them intelligently:
- "Quick weeknight meals" → max 30 min cooking time
- "Budget-friendly" → simple ingredients, minimize waste
- "My kids are picky" → suggest kid-friendly versions or hidden veggie recipes
- "Something impressive for guests" → elaborate, presentation-focused dishes
- "Use up the chicken in my fridge" → search by ingredients
- "Mediterranean style" → cuisine: mediterranean
- "Comfort food" → hearty, warming dishes

### Step 4: Personalization
Remember and apply:
- Their typical breakfast/lunch/dinner preferences from the database
- Any additional preferences they've written (natural language)
- Previous meal plans to avoid repetition
- Family members who need different meals (kids with different dietary needs)

## Response Guidelines

1. **Be Conversational**: Don't just dump data - explain your reasoning
2. **Offer Choices**: "I found 3 great options - here's why each might work..."
3. **Explain Trade-offs**: "This recipe is quick but uses the oven; this one is stovetop only"
4. **Ask Clarifying Questions**: If you need more info, ask!
5. **Summarize Clearly**: When presenting a meal plan, make it scannable

## Example Interactions

**User**: "What should I make for dinner tonight? Something quick."
**You**:
1. Check family preferences and restrictions
2. Search for recipes with max 30 min cooking time that fit their diet
3. Present 2-3 options with brief explanations
4. Offer to save their choice or get more details

**User**: "Plan our meals for next week"
**You**:
1. Gather all family context
2. Check existing preferences and typical meals
3. Generate or search for appropriate recipes
4. Create a balanced week with variety
5. Consider different meals for family members who need them
6. Present the plan clearly by day
7. Offer to save the plan

**User**: "We have chicken, broccoli, and rice - what can we make?"
**You**:
1. Use search_recipes_by_ingredients
2. Filter results by family dietary needs
3. Present options showing what additional ingredients might be needed

## Important Notes
- Always respect the household_id context provided
- When saving meal plans, use the correct date format (YYYY-MM-DD, starting Monday)
- If API calls fail, gracefully explain and offer alternatives
- Keep track of the conversation context for follow-up questions
"""


def create_meal_agent(household_id: str = None) -> Agent:
    """
    Create a Meal Recommendation Agent instance.

    Args:
        household_id: Optional household ID to include in context

    Returns:
        Configured Strands Agent with meal planning capabilities
    """
    # Configure the model (Claude via Bedrock)
    # Using Claude Sonnet 4.5 - latest and most capable Sonnet
    model = BedrockModel(
        model_id="us.anthropic.claude-sonnet-4-5-20250929-v1:0",
        region_name=os.getenv('AWS_REGION', 'us-east-1')
    )

    # Build system prompt with household context if provided
    system_prompt = SYSTEM_PROMPT
    if household_id:
        system_prompt += f"\n\n## Current Context\nYou are helping household: {household_id}"

    # Create the agent with all tools
    agent = Agent(
        model=model,
        system_prompt=system_prompt,
        tools=[
            # DynamoDB tools
            get_family_members,
            get_family_preferences,
            get_meal_plan,
            save_meal_plan,
            get_aggregated_dietary_needs,
            # Spoonacular tools
            search_recipes,
            search_recipes_by_ingredients,
            get_recipe_details,
            generate_meal_plan_from_api,
            get_random_recipes,
        ]
    )

    return agent


def main():
    """
    Run the Meal Agent in interactive mode for local testing.
    """
    import sys

    print("=" * 60)
    print("🍽️  HOH Meal Planning Assistant")
    print("=" * 60)

    # Get household ID from environment or prompt
    household_id = os.getenv('HOUSEHOLD_ID')
    if not household_id:
        household_id = input("Enter your household ID (or press Enter to skip): ").strip()
        if not household_id:
            print("⚠️  No household ID provided. Some features may be limited.")
            household_id = None

    print(f"\n📍 Household: {household_id or 'Not set'}")
    print("\nType your questions or 'quit' to exit.\n")
    print("-" * 60)

    # Create the agent
    agent = create_meal_agent(household_id)

    # Interactive loop
    while True:
        try:
            user_input = input("\n🧑 You: ").strip()

            if not user_input:
                continue

            if user_input.lower() in ['quit', 'exit', 'q']:
                print("\n👋 Goodbye! Happy cooking!")
                break

            print("\n🤖 Assistant: ", end="", flush=True)

            # Call the agent
            response = agent(user_input)

            # Response is streamed, so it's already printed
            # Just add a newline for formatting
            print()

        except KeyboardInterrupt:
            print("\n\n👋 Goodbye!")
            break
        except Exception as e:
            print(f"\n❌ Error: {e}")
            print("Please try again.")


if __name__ == "__main__":
    main()
