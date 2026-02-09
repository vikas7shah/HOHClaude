import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
export const docClient = DynamoDBDocumentClient.from(client);

export const USERS_TABLE = process.env.USERS_TABLE!;
export const MEAL_PLANS_TABLE = process.env.MEAL_PLANS_TABLE!;

// Helper to extract userId from Cognito claims
export function getUserId(event: any): string {
  return event.requestContext.authorizer.claims.sub;
}

// Helper to extract email from Cognito claims
export function getUserEmail(event: any): string {
  return event.requestContext.authorizer.claims.email;
}

// Get user profile with householdId
export async function getUserProfile(userId: string) {
  const result = await docClient.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: {
      PK: `USER#${userId}`,
      SK: 'PROFILE',
    },
  }));
  return result.Item || null;
}

// Get householdId for a user (returns null if not in a household)
export async function getHouseholdId(userId: string): Promise<string | null> {
  const profile = await getUserProfile(userId);
  return profile?.householdId || null;
}

// Require householdId - throws if user not in a household
export async function requireHouseholdId(userId: string): Promise<string> {
  const householdId = await getHouseholdId(userId);
  if (!householdId) {
    throw new Error('User is not part of a household');
  }
  return householdId;
}

// Get allowed CORS origins from environment
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://www.homeoperationshub.com,https://homeoperationshub.com').split(',').filter(Boolean);

// Helper to get the correct CORS origin header based on request origin
export function getCorsOrigin(event?: any): string {
  const requestOrigin = event?.headers?.origin || event?.headers?.Origin;

  // If request origin is in our allowed list, return it
  if (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) {
    return requestOrigin;
  }

  // Default to first allowed origin (production domain)
  return ALLOWED_ORIGINS[0] || 'https://www.homeoperationshub.com';
}

// Response helpers with optional event parameter for CORS origin detection
export function success(body: any, event?: any) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': getCorsOrigin(event),
      'Access-Control-Allow-Credentials': 'true',
    },
    body: JSON.stringify(body),
  };
}

export function error(statusCode: number, message: string, event?: any) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': getCorsOrigin(event),
      'Access-Control-Allow-Credentials': 'true',
    },
    body: JSON.stringify({ error: message }),
  };
}

export { GetCommand, PutCommand, QueryCommand, DeleteCommand };
