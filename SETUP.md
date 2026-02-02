# HOH Setup Guide

## Prerequisites

- Node.js 18+
- AWS CLI configured with credentials
- AWS CDK CLI (`npm install -g aws-cdk`)
- Spoonacular API key (get one at https://spoonacular.com/food-api)

## 1. Deploy Infrastructure

```bash
cd projects/hoh/infra

# Install dependencies
npm install

# Bootstrap CDK (first time only)
cdk bootstrap

# Set Spoonacular API key
export SPOONACULAR_API_KEY=your_api_key_here

# Deploy all stacks
cdk deploy --all
```

Note the outputs:
- `UserPoolId`
- `UserPoolClientId`  
- `ApiUrl`

## 2. Configure Frontend

```bash
cd projects/hoh/frontend

# Install dependencies
npm install

# Create .env file
cp .env.example .env
```

Edit `.env` with the values from CDK outputs:
```
VITE_USER_POOL_ID=<UserPoolId>
VITE_USER_POOL_CLIENT_ID=<UserPoolClientId>
VITE_API_URL=<ApiUrl>
```

## 3. Run Locally

```bash
npm run dev
```

Visit http://localhost:5173

## 4. Test the Flow

1. Sign up with email
2. Verify email with code
3. Complete onboarding (household name, family members, preferences)
4. Generate a meal plan
5. View calendar and click meals for details

## Troubleshooting

### CORS errors
- Check API Gateway CORS settings in CDK
- Ensure the API URL doesn't have a trailing slash

### Auth errors
- Verify Cognito User Pool ID and Client ID are correct
- Check callback URLs include http://localhost:5173/

### Spoonacular errors
- Verify API key is set in Lambda environment
- Check free tier limits (150 requests/day)

## Next Steps

After MVP is working:
1. Add shopping list generation
2. Implement meal swapping
3. Add Bedrock AgentCore for smarter personalization
4. Deploy frontend to CloudFront/S3
