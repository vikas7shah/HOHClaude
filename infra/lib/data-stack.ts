import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export class DataStack extends cdk.Stack {
  public readonly usersTable: dynamodb.Table;
  public readonly mealPlansTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Users table - stores user profiles, household data, family members, invites
    // 
    // Entities:
    // - User Profile:     PK: USER#<userId>           SK: PROFILE
    // - Household Info:   PK: HOUSEHOLD#<householdId> SK: INFO
    // - Family Member:    PK: HOUSEHOLD#<householdId> SK: MEMBER#<memberId>
    // - Preferences:      PK: HOUSEHOLD#<householdId> SK: PREFERENCES
    // - Pending Invite:   PK: INVITE#<email>          SK: HOUSEHOLD#<householdId>
    //
    // GSI1 (byHousehold): Find all users in a household
    //   GSI1PK: HOUSEHOLD#<householdId>
    //   GSI1SK: USER#<userId>
    //
    this.usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: 'hoh-users-2026',
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Change for production
    });

    // GSI to find users by household
    this.usersTable.addGlobalSecondaryIndex({
      indexName: 'byHousehold',
      partitionKey: {
        name: 'GSI1PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI1SK',
        type: dynamodb.AttributeType.STRING,
      },
    });

    // Meal Plans table - stores generated meal plans and shopping lists
    // PK: HOUSEHOLD#<householdId>
    // SK: PLAN#<startDate> | LIST#<planId>
    this.mealPlansTable = new dynamodb.Table(this, 'MealPlansTable', {
      tableName: 'hoh-meal-plans-2026',
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Change for production
      timeToLiveAttribute: 'ttl', // Auto-delete old plans
    });

    // GSI for querying plans by date range
    this.mealPlansTable.addGlobalSecondaryIndex({
      indexName: 'byDate',
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'startDate',
        type: dynamodb.AttributeType.STRING,
      },
    });

    // Outputs
    new cdk.CfnOutput(this, 'UsersTableName', {
      value: this.usersTable.tableName,
      description: 'Users DynamoDB Table Name',
      exportName: 'HohUsersTableName',
    });

    new cdk.CfnOutput(this, 'MealPlansTableName', {
      value: this.mealPlansTable.tableName,
      description: 'Meal Plans DynamoDB Table Name',
      exportName: 'HohMealPlansTableName',
    });
  }
}
