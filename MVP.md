# HOH MVP — Meal Planner

## User Flow

```
┌─────────────────────────────────────────────────────────┐
│  1. SIGN UP / LOGIN                                     │
│     └─ Cognito hosted UI or custom                      │
└─────────────────────┬───────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────┐
│  2. HOUSEHOLD SETUP (first time)                        │
│     A) Create household (become admin)                  │
│        OR                                               │
│     B) Accept invite to join existing household         │
└─────────────────────┬───────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────┐
│  3. ONBOARDING (per household)                          │
│     • Add family members                                │
│       - Name                                            │
│       - Dietary restrictions (vegan, gluten-free, etc)  │
│       - Allergies                                       │
│       - Likes / dislikes                                │
│     • General preferences                               │
│       - Preferred cuisines                              │
│       - Cooking time available (quick/medium/elaborate) │
│       - Meals to plan (breakfast/lunch/dinner)          │
│       - Budget range                                    │
└─────────────────────┬───────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────┐
│  4. DASHBOARD                                           │
│     • "Generate Meal Plan" button                       │
│     • Select week / date range                          │
│     • Optional: "I'm feeling..." (quick, comfort, etc)  │
│     • Invite family members (admin only)                │
│     • See household members                             │
└─────────────────────┬───────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────┐
│  5. MEAL PLAN CALENDAR                                  │
│     ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐        │
│     │ Mon │ Tue │ Wed │ Thu │ Fri │ Sat │ Sun │        │
│     ├─────┼─────┼─────┼─────┼─────┼─────┼─────┤        │
│     │ 🍳  │ 🍳  │ 🍳  │ 🍳  │ 🍳  │ 🍳  │ 🍳  │ Breakfast│
│     ├─────┼─────┼─────┼─────┼─────┼─────┼─────┤        │
│     │ 🥗  │ 🥗  │ 🥗  │ 🥗  │ 🥗  │ 🥗  │ 🥗  │ Lunch   │
│     ├─────┼─────┼─────┼─────┼─────┼─────┼─────┤        │
│     │ 🍝  │ 🍝  │ 🍝  │ 🍝  │ 🍝  │ 🍝  │ 🍝  │ Dinner  │
│     └─────┴─────┴─────┴─────┴─────┴─────┴─────┘        │
│     • Click meal → view recipe details                  │
│     • Swap meal → regenerate single slot                │
│     • "Generate Shopping List" button                   │
│     • ALL household members see the SAME plan           │
└─────────────────────────────────────────────────────────┘
```

---

## Multi-User Household Model

### Key Concepts

- **Household**: The central entity that owns all data (family members, preferences, meal plans)
- **Users**: Cognito accounts that belong to a household
- **Family Members**: Non-user profiles (kids, etc.) with dietary info
- **Roles**:
  - `admin` - Can invite/remove users
  - `member` - Can view/edit household data but not manage users

### User Journey

**First User (creates household):**
1. Signs up → no household yet
2. Creates household → becomes `admin`
3. Can invite others by email

**Invited User:**
1. Receives invite (by email or shared link)
2. Signs up or logs in
3. Sees pending invite → accepts
4. Now linked to household with role `member`

**Any Household Member:**
- Sees same dashboard, family members, preferences, meal plans
- Can add/edit family members and preferences
- Only `admin` can invite/remove users

---

## Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| **Frontend** | React + Vite + shadcn/ui + Tailwind | Fast, modern UI |
| **Auth** | Cognito | User accounts |
| **API** | API Gateway + Lambda | REST endpoints |
| **Database** | DynamoDB | Single-table design |
| **Recipes** | Spoonacular API | Meal plan generation |

---

## DynamoDB Schema (Single Table)

### Users Table (`hoh-users`)

#### User Profile
```
PK: USER#<cognitoSub>
SK: PROFILE
{
  email: string,
  displayName: string,
  householdId: string | null,
  role: "admin" | "member" | null,
  GSI1PK: HOUSEHOLD#<householdId>,  // For byHousehold index
  GSI1SK: USER#<cognitoSub>,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### Household Info
```
PK: HOUSEHOLD#<householdId>
SK: INFO
{
  name: string,
  createdBy: string,
  createdAt: timestamp
}
```

#### Family Members (non-users like kids)
```
PK: HOUSEHOLD#<householdId>
SK: MEMBER#<memberId>
{
  name: string,
  dietaryRestrictions: string[],
  allergies: string[],
  likes: string[],
  dislikes: string[],
  addedBy: string,
  createdAt: timestamp
}
```

#### Preferences
```
PK: HOUSEHOLD#<householdId>
SK: PREFERENCES
{
  cuisines: string[],
  cookingTime: "quick" | "medium" | "elaborate",
  mealsToInclude: string[],
  budget: "low" | "medium" | "high",
  updatedBy: string,
  updatedAt: timestamp
}
```

#### Pending Invite
```
PK: INVITE#<email>
SK: HOUSEHOLD#<householdId>
{
  invitedBy: string,
  invitedByEmail: string,
  householdName: string,
  invitedAt: timestamp,
  ttl: number  // Auto-expire in 7 days
}
```

### GSI: byHousehold
Find all users in a household:
- `GSI1PK: HOUSEHOLD#<householdId>`
- `GSI1SK: USER#<userId>`

### Meal Plans Table (`hoh-meal-plans`)

```
PK: HOUSEHOLD#<householdId>
SK: PLAN#<startDate>
{
  startDate: string,
  endDate: string,
  meals: [...],
  generatedBy: string,
  generatedAt: timestamp,
  ttl: number  // Auto-expire in 90 days
}
```

---

## API Endpoints

### Users
| Method | Path | Description |
|--------|------|-------------|
| GET | `/users/profile` | Get current user's profile + household info |
| POST | `/users/profile` | Update display name |
| PUT | `/users/preferences` | Update household preferences |

### Household
| Method | Path | Description |
|--------|------|-------------|
| GET | `/household` | Get household info + all users |
| POST | `/household` | Create new household (user becomes admin) |
| DELETE | `/household` | Leave current household |
| POST | `/household/invite` | Invite user by email (admin only) |
| GET | `/household/invites` | Get pending invites for current user |
| POST | `/household/accept` | Accept an invite |

### Family
| Method | Path | Description |
|--------|------|-------------|
| GET | `/family` | Get all family members |
| POST | `/family` | Add family member |
| DELETE | `/family/{memberId}` | Remove family member |

### Meals
| Method | Path | Description |
|--------|------|-------------|
| POST | `/meals/generate` | Generate meal plan for week |
| GET | `/meals/plan` | Get current/specific meal plan |

---

## Build Order

### Phase 1: Foundation ✅
- [x] Set up AWS CDK project
- [x] Create Cognito user pool
- [x] Create DynamoDB tables with GSI
- [x] Set up API Gateway + Lambda scaffold
- [x] Basic Lambda functions

### Phase 2: Multi-User Household
- [ ] Implement household create/join flow
- [ ] Implement invite system
- [ ] Update frontend for household setup
- [ ] Test multi-user access

### Phase 3: Meal Planning
- [ ] Integrate Spoonacular API
- [ ] Calendar UI component
- [ ] Display generated plan

### Phase 4: Polish
- [ ] Recipe detail modal
- [ ] Swap/regenerate single meal
- [ ] Shopping list generation
- [ ] Responsive design

---

## Open Decisions

1. **Email notifications?** - Send actual emails for invites, or just in-app?
2. **Promote member to admin?** - UI for admin to change roles?
3. **Multiple admins?** - Allow or restrict to one admin per household?
