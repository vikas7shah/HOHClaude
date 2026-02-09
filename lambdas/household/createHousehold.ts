import { docClient, USERS_TABLE, getUserId, getUserEmail, getUserProfile, success, error, PutCommand, GetCommand } from '../shared/dynamo';
import { randomUUID } from 'crypto';

export async function handler(event: any) {
  try {
    const userId = getUserId(event);
    const email = getUserEmail(event);
    const body = JSON.parse(event.body || '{}');
    const { name } = body;

    if (!name) {
      return error(400, 'Household name is required', event);
    }

    // Check if user already has a household
    const existingProfile = await getUserProfile(userId);
    if (existingProfile?.householdId) {
      return error(400, 'You are already part of a household. Leave it first to create a new one.', event);
    }

    const householdId = randomUUID();
    const now = new Date().toISOString();

    // Create household info
    await docClient.send(new PutCommand({
      TableName: USERS_TABLE,
      Item: {
        PK: `HOUSEHOLD#${householdId}`,
        SK: 'INFO',
        name,
        createdBy: userId,
        createdAt: now,
      },
    }));

    // Create/update user profile with householdId
    await docClient.send(new PutCommand({
      TableName: USERS_TABLE,
      Item: {
        PK: `USER#${userId}`,
        SK: 'PROFILE',
        email,
        displayName: existingProfile?.displayName || email.split('@')[0],
        householdId,
        role: 'admin', // Creator is admin
        GSI1PK: `HOUSEHOLD#${householdId}`, // For byHousehold GSI
        GSI1SK: `USER#${userId}`,
        createdAt: existingProfile?.createdAt || now,
        updatedAt: now,
      },
    }));

    return success({
      message: 'Household created',
      household: {
        id: householdId,
        name,
        role: 'admin',
      },
    }, event);
  } catch (err) {
    console.error('Error creating household:', err);
    return error(500, 'Failed to create household', event);
  }
}
