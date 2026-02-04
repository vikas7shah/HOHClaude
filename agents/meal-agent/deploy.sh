#!/bin/bash
# HOH Meal Agent - Deployment script for Bedrock AgentCore

set -e

# Configuration
AGENT_NAME="hoh-meal-agent"
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPO="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${AGENT_NAME}"

echo "================================================"
echo "HOH Meal Agent - Deploying to Bedrock AgentCore"
echo "================================================"
echo "Agent: ${AGENT_NAME}"
echo "Region: ${AWS_REGION}"
echo "Account: ${AWS_ACCOUNT_ID}"
echo ""

# Step 1: Create ECR repository if it doesn't exist
echo "📦 Checking ECR repository..."
aws ecr describe-repositories --repository-names ${AGENT_NAME} --region ${AWS_REGION} 2>/dev/null || \
    aws ecr create-repository --repository-name ${AGENT_NAME} --region ${AWS_REGION}

# Step 2: Build Docker image
echo "🔨 Building Docker image..."
docker build -t ${AGENT_NAME}:latest .

# Step 3: Tag and push to ECR
echo "📤 Pushing to ECR..."
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REPO}
docker tag ${AGENT_NAME}:latest ${ECR_REPO}:latest
docker push ${ECR_REPO}:latest

# Step 4: Deploy to AgentCore Runtime (using AWS CLI)
echo "🚀 Deploying to AgentCore Runtime..."

# Check if agent exists
AGENT_EXISTS=$(aws bedrock-agentcore list-agents --query "agents[?name=='${AGENT_NAME}'].id" --output text 2>/dev/null || echo "")

if [ -z "$AGENT_EXISTS" ]; then
    echo "Creating new agent..."
    aws bedrock-agentcore create-agent \
        --name ${AGENT_NAME} \
        --description "HOH Meal Planning Assistant" \
        --container-image ${ECR_REPO}:latest \
        --runtime-config '{"entryPoint": "handler.handler", "timeoutSeconds": 300, "memorySize": 512}' \
        --region ${AWS_REGION}
else
    echo "Updating existing agent..."
    aws bedrock-agentcore update-agent \
        --agent-id ${AGENT_EXISTS} \
        --container-image ${ECR_REPO}:latest \
        --region ${AWS_REGION}
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "To test the agent locally:"
echo "  python agent.py"
echo ""
echo "To invoke via AgentCore:"
echo "  aws bedrock-agentcore invoke-agent --agent-name ${AGENT_NAME} --input '{\"message\": \"What should I make for dinner?\", \"household_id\": \"YOUR_HOUSEHOLD_ID\"}'"
