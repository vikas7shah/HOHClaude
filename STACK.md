# HOH Tech Stack

## Locked Decisions

| Layer | Choice |
|-------|--------|
| Frontend | React 18 + Vite |
| UI | shadcn/ui + Tailwind CSS |
| Auth | AWS Cognito (Amplify client) |
| API | API Gateway (REST) + Lambda |
| Database | DynamoDB |
| IaC | AWS CDK (TypeScript) |
| Recipes | Spoonacular API (Phase 1) → Bedrock AgentCore (Phase 2) |

## Project Structure

```
hoh/
├── frontend/                 # React app
│   ├── src/
│   │   ├── components/       # UI components
│   │   ├── pages/            # Route pages
│   │   ├── hooks/            # Custom hooks
│   │   ├── lib/              # Utilities, API client
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── infra/                    # AWS CDK
│   ├── lib/
│   │   ├── auth-stack.ts     # Cognito
│   │   ├── api-stack.ts      # API Gateway + Lambda
│   │   └── data-stack.ts     # DynamoDB
│   ├── bin/
│   │   └── hoh.ts
│   └── package.json
│
├── lambdas/                  # Lambda functions
│   ├── users/
│   │   ├── createProfile.ts
│   │   ├── getProfile.ts
│   │   └── updatePreferences.ts
│   ├── family/
│   │   ├── addMember.ts
│   │   ├── updateMember.ts
│   │   └── deleteMember.ts
│   ├── meals/
│   │   ├── generatePlan.ts
│   │   ├── getPlan.ts
│   │   └── swapMeal.ts
│   └── shared/
│       ├── dynamo.ts
│       └── spoonacular.ts
│
└── docs/                     # Documentation
    ├── api.md
    └── schema.md
```

## Phase 1 → Phase 2 Evolution

### Phase 1: Spoonacular Direct
```
Frontend → API Gateway → Lambda → Spoonacular API
                            ↓
                        DynamoDB (store plan)
```

### Phase 2: AgentCore Intelligence
```
Frontend → API Gateway → Lambda → Bedrock AgentCore
                                       ↓
                            ┌──────────┴──────────┐
                            ▼                     ▼
                     Spoonacular API         DynamoDB
                     (tool)                  (memory + prefs)
```

AgentCore adds:
- Learning from feedback ("I didn't like that")
- Smarter variety (tracks what you've had)
- Natural language requests ("something quick with chicken")
- Adapts to context ("guests coming", "leftover ingredients")
