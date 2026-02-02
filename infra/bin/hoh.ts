#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AuthStack } from '../lib/auth-stack';
import { DataStack } from '../lib/data-stack';
import { ApiStack } from '../lib/api-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Auth stack - Cognito
const authStack = new AuthStack(app, 'HohAuthStack', { env });

// Data stack - DynamoDB
const dataStack = new DataStack(app, 'HohDataStack', { env });

// API stack - API Gateway + Lambda
const apiStack = new ApiStack(app, 'HohApiStack', {
  env,
  userPool: authStack.userPool,
  userPoolClient: authStack.userPoolClient,
  usersTable: dataStack.usersTable,
  mealPlansTable: dataStack.mealPlansTable,
});

// Note: Outputs are defined in individual stacks
