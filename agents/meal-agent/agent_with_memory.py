"""
HOH Meal Recommendation Agent with AgentCore Memory

This version includes Bedrock AgentCore memory integration for:
- SHORT-TERM MEMORY: Immediate conversation context within a session
- LONG-TERM MEMORY with multiple strategies:
  - Summary Strategy: Condenses conversation sessions for context
  - User Preference Strategy: Learns and remembers food preferences over time
  - Semantic Strategy: Extracts facts (allergies, family info, favorite cuisines)

Built with Strands Agents SDK for deployment to AWS Bedrock AgentCore.
"""

import os
from datetime import datetime
from strands import Agent
from strands.models import BedrockModel
from dotenv import load_dotenv

# AgentCore Memory imports
try:
    from bedrock_agentcore.memory import MemoryClient
    from bedrock_agentcore.memory.integrations.strands.config import (
        AgentCoreMemoryConfig,
        RetrievalConfig,
    )
    from bedrock_agentcore.memory.integrations.strands.session_manager import (
        AgentCoreMemorySessionManager,
    )
    AGENTCORE_AVAILABLE = True
except ImportError:
    AGENTCORE_AVAILABLE = False
    print("⚠️  bedrock-agentcore not installed. Running without memory integration.")

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

## Memory & Personalization
You have access to TWO types of memory:

### Short-Term Memory (Current Session)
- The current conversation history
- Use for immediate context and follow-up questions

### Long-Term Memory (Across Sessions)
You remember things from past conversations:
- **User Preferences**: Foods they love/hate, cooking styles, budget preferences
- **Semantic Facts**: Family members' names, allergies discovered, favorite cuisines
- **Session Summaries**: What was discussed in previous sessions

Use long-term memory to:
- Remember past meal suggestions and what the user liked/disliked
- Recall specific preferences mentioned weeks ago ("You mentioned you loved that Thai recipe")
- Avoid repeating suggestions they've rejected before
- Track seasonal preferences and special occasions
- Build rapport ("How did the birthday dinner turn out?")

## How to Approach Meal Planning

### Step 1: Check Memory First
Before using tools, consider what you already know from memory:
- Have they mentioned preferences before?
- Did they reject certain foods in past sessions?
- Any upcoming events they mentioned?

### Step 2: Gather Fresh Context
Use tools to get current family data:
- `get_family_members` for dietary info
- `get_family_preferences` for household preferences
- `get_aggregated_dietary_needs` for restrictions summary

### Step 3: Consider All Needs
When recommending recipes:
- **Allergies are NON-NEGOTIABLE** - never suggest recipes with allergens
- **Respect dietary restrictions** - vegetarian, vegan, gluten-free, etc.
- **Use memory** - avoid foods they've rejected, favor foods they've loved
- **Age-appropriate meals** - kid-friendly for young ones
- **Time constraints** - quick meals for busy nights

### Step 4: Natural Language Understanding
Interpret requests intelligently:
- "Quick weeknight meals" → max 30 min cooking time
- "Something different" → check memory for recent suggestions, offer variety
- "That thing I liked last month" → search long-term memory
- "Budget-friendly" → simple ingredients
- "My kids are picky" → kid-friendly, consider past successes

## Response Guidelines

1. **Reference Memory Naturally**: "I remember you enjoyed Mediterranean food last time..."
2. **Learn from Feedback**: When users express preferences, acknowledge you'll remember
3. **Build Continuity**: Reference past conversations when relevant
4. **Offer Personalized Choices**: Use accumulated knowledge to tailor suggestions
5. **Ask About Past Recommendations**: "How did that lasagna recipe work out?"

## Important Notes
- Always respect the household_id context provided
- When saving meal plans, use the correct date format (YYYY-MM-DD, starting Monday)
- If API calls fail, gracefully explain and offer alternatives
- Your long-term memories persist - use them to build a relationship over time
"""


def create_memory_with_strategies(
    memory_name: str = "HOHMealAgentMemory",
    region: str = "us-east-1"
) -> str:
    """
    Create an AgentCore memory with long-term memory strategies.

    This creates memory with THREE strategies:
    1. Summary Strategy - Condenses sessions for context
    2. User Preference Strategy - Learns food preferences
    3. Semantic Strategy - Extracts facts about family/food

    Args:
        memory_name: Name for the memory instance
        region: AWS region

    Returns:
        Memory ID
    """
    if not AGENTCORE_AVAILABLE:
        print("❌ AgentCore not available")
        return None

    client = MemoryClient(region_name=region)

    # Check if memory already exists
    try:
        memories = client.list_memories()
        # Handle both list and dict response formats
        memory_list = memories if isinstance(memories, list) else memories.get('memories', [])
        for memory in memory_list:
            if memory.get('name') == memory_name:
                print(f"📝 Found existing memory: {memory['id']}")
                return memory['id']
    except Exception as e:
        print(f"⚠️  Error listing memories: {e}")

    # Create new memory with ALL long-term memory strategies
    try:
        print("🧠 Creating memory with long-term strategies...")

        memory = client.create_memory_and_wait(
            name=memory_name,
            description="HOH Meal Planning Agent - Remembers family preferences, food facts, and conversation history",
            strategies=[
                # Strategy 1: Session Summaries
                # Condenses conversation sessions for efficient retrieval
                {
                    "summaryMemoryStrategy": {
                        "name": "MealSessionSummarizer",
                        "namespaces": ["/summaries/{actorId}/{sessionId}"]
                    }
                },
                # Strategy 2: User Preferences
                # Learns and stores food preferences over time
                # e.g., "prefers quick meals", "loves Italian", "hates mushrooms"
                {
                    "userPreferenceMemoryStrategy": {
                        "name": "FoodPreferenceLearner",
                        "namespaces": ["/preferences/{actorId}"]
                    }
                },
                # Strategy 3: Semantic/Factual Memory
                # Extracts and stores facts from conversations
                # e.g., "has 2 kids", "daughter is allergic to nuts", "anniversary is in March"
                {
                    "semanticMemoryStrategy": {
                        "name": "FamilyFactExtractor",
                        "namespaces": ["/facts/{actorId}"]
                    }
                }
            ]
        )

        memory_id = memory.get('id')
        print(f"✅ Created memory with long-term strategies: {memory_id}")
        print("   - Summary Strategy: Condenses conversation sessions")
        print("   - User Preference Strategy: Learns food preferences")
        print("   - Semantic Strategy: Extracts family/food facts")

        return memory_id

    except Exception as e:
        print(f"❌ Error creating memory: {e}")
        return None


def create_memory_session_manager(
    memory_id: str,
    actor_id: str,
    session_id: str = None,
    region: str = "us-east-1"
):
    """
    Create an AgentCore Memory session manager with retrieval from all namespaces.

    Args:
        memory_id: The AgentCore memory ID
        actor_id: Unique identifier for the user/actor (e.g., household_id)
        session_id: Optional session ID (generated if not provided)
        region: AWS region

    Returns:
        AgentCoreMemorySessionManager instance
    """
    if not AGENTCORE_AVAILABLE:
        return None

    if not session_id:
        session_id = f"session_{datetime.now().strftime('%Y%m%d%H%M%S')}"

    # Configure memory with retrieval configs for each strategy
    # The retrieval_config is a dict mapping strategy names to their configs
    memory_config = AgentCoreMemoryConfig(
        memory_id=memory_id,
        session_id=session_id,
        actor_id=actor_id,
        retrieval_config={
            # Retrieve from all our long-term memory strategies
            "summary": RetrievalConfig(top_k=5),
            "preference": RetrievalConfig(top_k=10),
            "semantic": RetrievalConfig(top_k=10),
        }
    )

    session_manager = AgentCoreMemorySessionManager(
        agentcore_memory_config=memory_config,
        region_name=region,
    )

    return session_manager


def create_meal_agent_with_memory(
    household_id: str,
    session_id: str = None,
    memory_id: str = None,
) -> Agent:
    """
    Create a Meal Recommendation Agent with full short-term and long-term memory.

    Memory capabilities:
    - SHORT-TERM: Current conversation context
    - LONG-TERM:
      - Summaries of past sessions
      - Learned user preferences (food likes/dislikes, cooking style)
      - Semantic facts (family members, allergies, special occasions)

    Args:
        household_id: The household ID (used as actor_id for memory)
        session_id: Optional session ID for conversation continuity
        memory_id: Optional memory ID (created with strategies if not provided)

    Returns:
        Configured Strands Agent with meal planning capabilities and full memory
    """
    region = os.getenv('AWS_REGION', 'us-east-1')

    # Configure the model (Claude via Bedrock)
    # Using Claude Sonnet 4.5 - latest and most capable Sonnet
    model = BedrockModel(
        model_id="us.anthropic.claude-sonnet-4-5-20250929-v1:0",
        region_name=region
    )

    # Build system prompt with household context
    system_prompt = SYSTEM_PROMPT + f"\n\n## Current Context\nYou are helping household: {household_id}"

    # Set up memory with long-term strategies if available
    session_manager = None
    if AGENTCORE_AVAILABLE:
        # Get or create memory with long-term strategies
        if not memory_id:
            memory_id = os.getenv('AGENTCORE_MEMORY_ID')

        if not memory_id:
            # Create new memory with all strategies
            memory_id = create_memory_with_strategies(region=region)

        if memory_id:
            session_manager = create_memory_session_manager(
                memory_id=memory_id,
                actor_id=household_id,
                session_id=session_id,
                region=region
            )
            print(f"\n🧠 Memory enabled for household: {household_id}")
            print(f"   Memory ID: {memory_id}")
            print(f"   Session ID: {session_id or 'auto-generated'}")
            print(f"   Short-term: ✅ Current conversation")
            print(f"   Long-term:  ✅ Summaries + Preferences + Facts")

    # Create the agent with all tools and memory
    agent_kwargs = {
        'model': model,
        'system_prompt': system_prompt,
        'tools': [
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
    }

    if session_manager:
        agent_kwargs['session_manager'] = session_manager

    agent = Agent(**agent_kwargs)

    return agent


def main():
    """
    Run the Meal Agent with full memory in interactive mode.
    """
    print("=" * 70)
    print("🍽️  HOH Meal Planning Assistant")
    print("   with Short-Term + Long-Term Memory")
    print("=" * 70)

    # Get household ID
    household_id = os.getenv('HOUSEHOLD_ID')
    if not household_id:
        household_id = input("Enter your household ID: ").strip()
        if not household_id:
            print("❌ Household ID is required.")
            return

    # Optional: get session ID for conversation continuity
    print("\n💡 Tip: Use the same session ID to continue a previous conversation")
    session_id = input("Enter session ID (or press Enter for new session): ").strip() or None

    print(f"\n📍 Household: {household_id}")
    print(f"📍 Session: {session_id or 'New session'}")

    # Create the agent with memory
    agent = create_meal_agent_with_memory(
        household_id=household_id,
        session_id=session_id
    )

    print("\n" + "-" * 70)
    print("Type your questions or 'quit' to exit.")
    print("Your preferences and facts will be remembered across sessions!")
    print("-" * 70)

    # Interactive loop
    while True:
        try:
            user_input = input("\n🧑 You: ").strip()

            if not user_input:
                continue

            if user_input.lower() in ['quit', 'exit', 'q']:
                print("\n👋 Goodbye! I'll remember your preferences for next time!")
                break

            print("\n🤖 Assistant: ", end="", flush=True)

            # Call the agent
            response = agent(user_input)

            # Response is streamed
            print()

        except KeyboardInterrupt:
            print("\n\n👋 Goodbye!")
            break
        except Exception as e:
            print(f"\n❌ Error: {e}")
            print("Please try again.")


if __name__ == "__main__":
    main()
