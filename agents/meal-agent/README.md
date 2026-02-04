# HOH Meal Planning Agent

A sophisticated AI agent for personalized meal recommendations, built with **Strands Agents SDK** for deployment to **AWS Bedrock AgentCore**.

## Features

- **Family-Aware Meal Planning**: Considers all family members' dietary restrictions, allergies, and preferences
- **Natural Language Understanding**: Interprets requests like "quick weeknight meals" or "budget-friendly dinner ideas"
- **Recipe Discovery**: Searches Spoonacular's database of 5000+ recipes
- **Meal Plan Generation**: Creates weekly meal plans with variety and balance
- **Ingredient-Based Search**: "What can I make with chicken and broccoli?"
- **Memory & Personalization**: Remembers preferences across conversations (with AgentCore Memory)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     HOH Meal Agent                               │
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                  Strands Agent                             │  │
│  │  • Claude Sonnet 4 (via Bedrock)                          │  │
│  │  • System prompt with meal planning expertise             │  │
│  │  • AgentCore Memory (optional)                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│         ┌────────────────────┼────────────────────┐             │
│         ▼                    ▼                    ▼             │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│  │  DynamoDB   │     │ Spoonacular │     │  AgentCore  │       │
│  │   Tools     │     │    Tools    │     │   Memory    │       │
│  └─────────────┘     └─────────────┘     └─────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Python 3.10+
- AWS account with Bedrock access
- Spoonacular API key

### Installation

```bash
# Clone and navigate to the agent directory
cd agents/meal-agent

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env
# Edit .env with your configuration
```

### Configuration

Edit `.env` with your settings:

```env
AWS_REGION=us-east-1
USERS_TABLE=hoh-users-2026
MEAL_PLANS_TABLE=hoh-meal-plans-2026
SPOONACULAR_API_KEY=your_api_key_here
```

### Run Locally

```bash
# Basic agent (no memory)
python agent.py

# Agent with AgentCore memory
python agent_with_memory.py
```

## Available Tools

### DynamoDB Tools

| Tool | Description |
|------|-------------|
| `get_family_members` | Get all family members with dietary info |
| `get_family_preferences` | Get household meal preferences |
| `get_meal_plan` | Retrieve existing meal plan |
| `save_meal_plan` | Save generated meal plan |
| `get_aggregated_dietary_needs` | Summary of all restrictions/allergies |

### Spoonacular Tools

| Tool | Description |
|------|-------------|
| `search_recipes` | Search by query, cuisine, diet, time |
| `search_recipes_by_ingredients` | Find recipes using specific ingredients |
| `get_recipe_details` | Get full recipe with instructions |
| `generate_meal_plan_from_api` | Generate day/week meal plan |
| `get_random_recipes` | Get random recipe suggestions |

## Example Interactions

```
🧑 You: What should I make for dinner tonight? Something quick.

🤖 Assistant: Let me check your family's preferences and find some quick dinner options!

[Calls get_family_preferences and get_aggregated_dietary_needs]

I see you prefer meals under 30 minutes and have a vegetarian in the family.
Here are 3 great options:

1. **15-Minute Veggie Stir Fry** - Quick, healthy, everyone can eat it
2. **Caprese Pasta** - 20 minutes, uses fresh tomatoes and basil
3. **Black Bean Tacos** - 25 minutes, kid-friendly and customizable

Would you like the full recipe for any of these?
```

## Deployment to Bedrock AgentCore

### Using the Deploy Script

```bash
./deploy.sh
```

### Manual Deployment

1. Build Docker image:
```bash
docker build -t hoh-meal-agent:latest .
```

2. Push to ECR:
```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ECR_REPO
docker tag hoh-meal-agent:latest YOUR_ECR_REPO:latest
docker push YOUR_ECR_REPO:latest
```

3. Deploy to AgentCore Runtime (via AWS Console or CLI)

## Testing

```bash
# Run all tests
pytest tests/ -v

# Run with coverage
pytest tests/ --cov=tools --cov-report=html
```

## Project Structure

```
meal-agent/
├── agent.py                 # Main agent (basic)
├── agent_with_memory.py     # Agent with AgentCore memory
├── handler.py               # Lambda/AgentCore handler
├── requirements.txt         # Python dependencies
├── Dockerfile               # Container image
├── deploy.sh                # Deployment script
├── .env.example             # Environment template
├── config/
│   └── agentcore_config.yaml  # AgentCore configuration
├── tools/
│   ├── __init__.py
│   ├── dynamo_tools.py      # DynamoDB tools
│   └── spoonacular_tools.py # Spoonacular API tools
└── tests/
    ├── __init__.py
    └── test_tools.py        # Tool tests
```

## Future Enhancements

- [ ] Pantry management tools
- [ ] Grocery list generation
- [ ] Receipt parsing for pantry updates
- [ ] Budget tracking
- [ ] Multi-agent coordination (pantry + meals + grocery)

## Resources

- [Strands Agents SDK](https://github.com/strands-agents/sdk-python)
- [AWS Bedrock AgentCore](https://aws.amazon.com/bedrock/agentcore/)
- [Spoonacular API Docs](https://spoonacular.com/food-api/docs)
