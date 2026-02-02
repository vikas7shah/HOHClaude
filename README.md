# HOH — Home Operations Hub

> AI-powered household orchestration, starting with meal planning.

## Vision
An AI system that learns your household's preferences and orchestrates daily operations — meals, cleaning, coordination, deliveries.

## MVP Scope: Meal Planner

**Core user flows:**
1. User sets dietary preferences & constraints
2. User requests a meal plan ("plan my week", "quick dinners for 3 days")
3. Agent generates personalized meal plan
4. Agent creates shopping list from plan
5. User can adjust/swap meals, agent adapts

**Out of scope for MVP:**
- Smart home integration
- Multi-user/family coordination
- Delivery service integration
- Task scheduling beyond meals

---

## Tech Stack

| Layer | Service |
|-------|---------|
| Auth | Cognito |
| API | API Gateway (or Bedrock direct) |
| Agent | Bedrock AgentCore |
| Database | DynamoDB |
| Frontend | TBD |

---

## Architecture

```
┌─────────────┐
│   Frontend  │  (web/mobile TBD)
└──────┬──────┘
       │ JWT (Cognito)
       ▼
┌─────────────┐
│ API Gateway │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│         Bedrock AgentCore           │
│  ┌─────────────────────────────┐    │
│  │ HOH Meal Planner Agent      │    │
│  │                             │    │
│  │ Tools:                      │    │
│  │ • get_user_preferences      │    │
│  │ • search_recipes            │    │
│  │ • create_meal_plan          │    │
│  │ • generate_shopping_list    │    │
│  │ • update_meal_plan          │    │
│  └─────────────────────────────┘    │
│                                     │
│  Knowledge Base:                    │
│  • Recipe collection                │
│  • Nutritional data                 │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│            DynamoDB                 │
│                                     │
│  Tables:                            │
│  • Users (prefs, constraints)       │
│  • MealPlans (weekly plans)         │
│  • ShoppingLists                    │
│  • Recipes (or in KB)               │
└─────────────────────────────────────┘
```

---

## DynamoDB Schema (Draft)

### Users
- PK: `USER#<userId>`
- SK: `PROFILE`
- Attributes: dietary restrictions, cuisine preferences, household size, cooking skill, time constraints

### MealPlans
- PK: `USER#<userId>`
- SK: `PLAN#<weekStart>`
- Attributes: meals array (day, mealType, recipeId, servings), status

### ShoppingLists  
- PK: `USER#<userId>`
- SK: `LIST#<planId>`
- Attributes: items array (ingredient, quantity, unit, category, checked)

### Recipes
- PK: `RECIPE#<recipeId>`
- SK: `META`
- Attributes: name, ingredients, instructions, prep time, cook time, cuisine, dietary tags
- GSI: by cuisine, by dietary tag, by time

---

## Next Steps

1. [ ] Define agent tools in detail
2. [ ] Design conversation flows
3. [ ] Set up Cognito user pool
4. [ ] Create DynamoDB tables
5. [ ] Build AgentCore agent with tools
6. [ ] Seed recipe knowledge base
7. [ ] Simple frontend to test

---

## Open Questions

- Frontend: Web app? Mobile? Both?
- Recipe source: Build own DB? Use external API? User-submitted?
- Shopping list: Just generate, or integrate with grocery services later?
