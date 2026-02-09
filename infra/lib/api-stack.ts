import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import * as path from 'path';

interface ApiStackProps extends cdk.StackProps {
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  usersTable: dynamodb.Table;
  mealPlansTable: dynamodb.Table;
}

export class ApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { userPool, usersTable, mealPlansTable } = props;

    // Reference existing Spoonacular API key secret
    const spoonacularSecret = secretsmanager.Secret.fromSecretNameV2(
      this, 'SpoonacularSecret', 'hoh/spoonacular-api-key'
    );

    // Allowed origins for CORS - restrict to production domain only
    const allowedOrigins = [
      'https://www.homeoperationshub.com',
      'https://homeoperationshub.com',
    ];

    // Add localhost for development if needed
    if (process.env.NODE_ENV !== 'production') {
      allowedOrigins.push('http://localhost:5173');
      allowedOrigins.push('http://localhost:3000');
    }

    // API Gateway
    this.api = new apigateway.RestApi(this, 'HohApi', {
      restApiName: 'HOH API',
      description: 'Home Operations Hub API',
      defaultCorsPreflightOptions: {
        allowOrigins: allowedOrigins,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // Cognito Authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'HohAuthorizer', {
      cognitoUserPools: [userPool],
      identitySource: 'method.request.header.Authorization',
    });

    // Common Lambda props
    const commonLambdaProps: Partial<nodejs.NodejsFunctionProps> = {
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        USERS_TABLE: usersTable.tableName,
        MEAL_PLANS_TABLE: mealPlansTable.tableName,
        SPOONACULAR_SECRET_NAME: 'hoh/spoonacular-api-key',
        ALLOWED_ORIGINS: allowedOrigins.join(','),
      },
      bundling: {
        minify: true,
        sourceMap: true,
        forceDockerBundling: false,
      },
    };

    const authMethodOptions: apigateway.MethodOptions = {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    };

    // ============ USER ENDPOINTS ============

    const getProfileFn = new nodejs.NodejsFunction(this, 'GetProfileFn', {
      ...commonLambdaProps,
      entry: path.join(__dirname, '../../lambdas/users/getProfile.ts'),
      handler: 'handler',
    });
    usersTable.grantReadData(getProfileFn);

    const saveProfileFn = new nodejs.NodejsFunction(this, 'SaveProfileFn', {
      ...commonLambdaProps,
      entry: path.join(__dirname, '../../lambdas/users/saveProfile.ts'),
      handler: 'handler',
    });
    usersTable.grantReadWriteData(saveProfileFn);

    const getPreferencesFn = new nodejs.NodejsFunction(this, 'GetPreferencesFn', {
      ...commonLambdaProps,
      entry: path.join(__dirname, '../../lambdas/users/getPreferences.ts'),
      handler: 'handler',
    });
    usersTable.grantReadData(getPreferencesFn);

    const updatePreferencesFn = new nodejs.NodejsFunction(this, 'UpdatePreferencesFn', {
      ...commonLambdaProps,
      entry: path.join(__dirname, '../../lambdas/users/updatePreferences.ts'),
      handler: 'handler',
    });
    usersTable.grantReadWriteData(updatePreferencesFn);

    // ============ HOUSEHOLD ENDPOINTS ============

    const createHouseholdFn = new nodejs.NodejsFunction(this, 'CreateHouseholdFn', {
      ...commonLambdaProps,
      entry: path.join(__dirname, '../../lambdas/household/createHousehold.ts'),
      handler: 'handler',
    });
    usersTable.grantReadWriteData(createHouseholdFn);

    const getHouseholdFn = new nodejs.NodejsFunction(this, 'GetHouseholdFn', {
      ...commonLambdaProps,
      entry: path.join(__dirname, '../../lambdas/household/getHousehold.ts'),
      handler: 'handler',
    });
    usersTable.grantReadData(getHouseholdFn);

    const inviteUserFn = new nodejs.NodejsFunction(this, 'InviteUserFn', {
      ...commonLambdaProps,
      entry: path.join(__dirname, '../../lambdas/household/inviteUser.ts'),
      handler: 'handler',
    });
    usersTable.grantReadWriteData(inviteUserFn);

    const getInvitesFn = new nodejs.NodejsFunction(this, 'GetInvitesFn', {
      ...commonLambdaProps,
      entry: path.join(__dirname, '../../lambdas/household/getInvites.ts'),
      handler: 'handler',
    });
    usersTable.grantReadData(getInvitesFn);

    const acceptInviteFn = new nodejs.NodejsFunction(this, 'AcceptInviteFn', {
      ...commonLambdaProps,
      entry: path.join(__dirname, '../../lambdas/household/acceptInvite.ts'),
      handler: 'handler',
    });
    usersTable.grantReadWriteData(acceptInviteFn);

    const leaveHouseholdFn = new nodejs.NodejsFunction(this, 'LeaveHouseholdFn', {
      ...commonLambdaProps,
      entry: path.join(__dirname, '../../lambdas/household/leaveHousehold.ts'),
      handler: 'handler',
    });
    usersTable.grantReadWriteData(leaveHouseholdFn);

    // ============ FAMILY ENDPOINTS ============

    const getFamilyFn = new nodejs.NodejsFunction(this, 'GetFamilyFn', {
      ...commonLambdaProps,
      entry: path.join(__dirname, '../../lambdas/family/getFamily.ts'),
      handler: 'handler',
    });
    usersTable.grantReadData(getFamilyFn);

    const addMemberFn = new nodejs.NodejsFunction(this, 'AddMemberFn', {
      ...commonLambdaProps,
      entry: path.join(__dirname, '../../lambdas/family/addMember.ts'),
      handler: 'handler',
    });
    usersTable.grantReadWriteData(addMemberFn);

    const deleteMemberFn = new nodejs.NodejsFunction(this, 'DeleteMemberFn', {
      ...commonLambdaProps,
      entry: path.join(__dirname, '../../lambdas/family/deleteMember.ts'),
      handler: 'handler',
    });
    usersTable.grantReadWriteData(deleteMemberFn);

    const updateMemberFn = new nodejs.NodejsFunction(this, 'UpdateMemberFn', {
      ...commonLambdaProps,
      entry: path.join(__dirname, '../../lambdas/family/updateMember.ts'),
      handler: 'handler',
    });
    usersTable.grantReadWriteData(updateMemberFn);

    // ============ MEAL PLAN ENDPOINTS ============

    const generatePlanFn = new nodejs.NodejsFunction(this, 'GeneratePlanFn', {
      ...commonLambdaProps,
      entry: path.join(__dirname, '../../lambdas/meals/generatePlan.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(90), // Extended for agent invocation
    });
    usersTable.grantReadData(generatePlanFn);
    mealPlansTable.grantReadWriteData(generatePlanFn);
    spoonacularSecret.grantRead(generatePlanFn);

    const getPlanFn = new nodejs.NodejsFunction(this, 'GetPlanFn', {
      ...commonLambdaProps,
      entry: path.join(__dirname, '../../lambdas/meals/getPlan.ts'),
      handler: 'handler',
    });
    usersTable.grantReadData(getPlanFn);
    mealPlansTable.grantReadData(getPlanFn);

    const updateMealFn = new nodejs.NodejsFunction(this, 'UpdateMealFn', {
      ...commonLambdaProps,
      entry: path.join(__dirname, '../../lambdas/meals/updateMeal.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
    });
    usersTable.grantReadData(updateMealFn);
    mealPlansTable.grantReadWriteData(updateMealFn);
    spoonacularSecret.grantRead(updateMealFn);

    // ============ AI AGENT ENDPOINT ============

    // Meal Agent - Python Lambda with Strands SDK
    // Note: Requires pre-bundled deployment package at lambdas/agent/deployment.zip
    // Build with: cd lambdas/agent && pip install -r requirements.txt -t package &&
    //             cp -r *.py tools package/ && cd package && zip -r ../deployment.zip .
    const mealAgentFn = new lambda.Function(this, 'MealAgentFn', {
      runtime: lambda.Runtime.PYTHON_3_11,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambdas/agent/package')),
      handler: 'meal_agent_handler.handler',
      timeout: cdk.Duration.seconds(120), // Agent needs more time
      memorySize: 1024, // More memory for ML workloads
      environment: {
        USERS_TABLE: usersTable.tableName,
        MEAL_PLANS_TABLE: mealPlansTable.tableName,
        SPOONACULAR_SECRET_NAME: 'hoh/spoonacular-api-key',
        MODEL_ID: 'us.anthropic.claude-3-5-haiku-20241022-v1:0', // Using Haiku for cost efficiency
        ALLOWED_ORIGINS: allowedOrigins.join(','),
        LOG_LEVEL: 'INFO',
      },
    });

    // Grant Secrets Manager access to agent for Spoonacular API key
    spoonacularSecret.grantRead(mealAgentFn);

    // Grant DynamoDB access
    usersTable.grantReadWriteData(mealAgentFn);
    mealPlansTable.grantReadWriteData(mealAgentFn);

    // Grant Bedrock access for Claude model
    mealAgentFn.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
      ],
      resources: [
        'arn:aws:bedrock:*::foundation-model/anthropic.*',
        'arn:aws:bedrock:*:*:inference-profile/*',
      ],
    }));

    // Allow generatePlanFn to invoke the meal agent
    mealAgentFn.grantInvoke(generatePlanFn);

    // Add environment variable to generatePlanFn with the agent function name
    generatePlanFn.addEnvironment('MEAL_AGENT_FUNCTION_NAME', mealAgentFn.functionName);

    // ============ ROUTE SETUP ============

    // /users
    const usersResource = this.api.root.addResource('users');
    const profileResource = usersResource.addResource('profile');
    profileResource.addMethod('GET', new apigateway.LambdaIntegration(getProfileFn), authMethodOptions);
    profileResource.addMethod('POST', new apigateway.LambdaIntegration(saveProfileFn), authMethodOptions);

    const preferencesResource = usersResource.addResource('preferences');
    preferencesResource.addMethod('GET', new apigateway.LambdaIntegration(getPreferencesFn), authMethodOptions);
    preferencesResource.addMethod('PUT', new apigateway.LambdaIntegration(updatePreferencesFn), authMethodOptions);

    // /household
    const householdResource = this.api.root.addResource('household');
    householdResource.addMethod('GET', new apigateway.LambdaIntegration(getHouseholdFn), authMethodOptions);
    householdResource.addMethod('POST', new apigateway.LambdaIntegration(createHouseholdFn), authMethodOptions);
    householdResource.addMethod('DELETE', new apigateway.LambdaIntegration(leaveHouseholdFn), authMethodOptions);

    // /household/invite
    const inviteResource = householdResource.addResource('invite');
    inviteResource.addMethod('POST', new apigateway.LambdaIntegration(inviteUserFn), authMethodOptions);

    // /household/invites (get pending invites for current user)
    const invitesResource = householdResource.addResource('invites');
    invitesResource.addMethod('GET', new apigateway.LambdaIntegration(getInvitesFn), authMethodOptions);

    // /household/accept
    const acceptResource = householdResource.addResource('accept');
    acceptResource.addMethod('POST', new apigateway.LambdaIntegration(acceptInviteFn), authMethodOptions);

    // /family
    const familyResource = this.api.root.addResource('family');
    familyResource.addMethod('GET', new apigateway.LambdaIntegration(getFamilyFn), authMethodOptions);
    familyResource.addMethod('POST', new apigateway.LambdaIntegration(addMemberFn), authMethodOptions);

    const memberResource = familyResource.addResource('{memberId}');
    memberResource.addMethod('DELETE', new apigateway.LambdaIntegration(deleteMemberFn), authMethodOptions);
    memberResource.addMethod('PUT', new apigateway.LambdaIntegration(updateMemberFn), authMethodOptions);

    // /meals
    const mealsResource = this.api.root.addResource('meals');
    const generateResource = mealsResource.addResource('generate');
    generateResource.addMethod('POST', new apigateway.LambdaIntegration(generatePlanFn), authMethodOptions);

    const planResource = mealsResource.addResource('plan');
    planResource.addMethod('GET', new apigateway.LambdaIntegration(getPlanFn), authMethodOptions);

    // /meals/update - for swapping or customizing individual meals
    const updateMealResource = mealsResource.addResource('update');
    updateMealResource.addMethod('POST', new apigateway.LambdaIntegration(updateMealFn), authMethodOptions);

    // /agent
    const agentResource = this.api.root.addResource('agent');
    const chatResource = agentResource.addResource('chat');
    chatResource.addMethod('POST', new apigateway.LambdaIntegration(mealAgentFn), authMethodOptions);

    // ============ OUTPUTS ============

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'API Gateway URL',
      exportName: 'HohApiUrl',
    });
  }
}
