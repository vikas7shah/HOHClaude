import { docClient, USERS_TABLE, getUserId, getUserEmail, getUserProfile, success, error, PutCommand, GetCommand, DeleteCommand } from '../shared/dynamo';

export async function handler(event: any) {
  try {
    const userId = getUserId(event);
    const email = getUserEmail(event);
    const body = JSON.parse(event.body || '{}');
    const { householdId } = body;

    if (!householdId) {
      return error(400, 'householdId is required');
    }

    // Check user isn't already in a household
    const existingProfile = await getUserProfile(userId);
    if (existingProfile?.householdId) {
      return error(400, 'You are already part of a household. Leave it first to join another.');
    }

    // Check invite exists
    const inviteResult = await docClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: {
        PK: `INVITE#${email.toLowerCase()}`,
        SK: `HOUSEHOLD#${householdId}`,
      },
    }));

    if (!inviteResult.Item) {
      return error(404, 'Invite not found or expired');
    }

    // Get household info
    const householdResult = await docClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: {
        PK: `HOUSEHOLD#${householdId}`,
        SK: 'INFO',
      },
    }));

    if (!householdResult.Item) {
      return error(404, 'Household no longer exists');
    }

    const now = new Date().toISOString();

    // Create/update user profile with household
    await docClient.send(new PutCommand({
      TableName: USERS_TABLE,
      Item: {
        PK: `USER#${userId}`,
        SK: 'PROFILE',
        email,
        displayName: existingProfile?.displayName || email.split('@')[0],
        householdId,
        role: 'member', // Invited users are members, not admins
        GSI1PK: `HOUSEHOLD#${householdId}`,
        GSI1SK: `USER#${userId}`,
        createdAt: existingProfile?.createdAt || now,
        updatedAt: now,
      },
    }));

    // Delete the invite
    await docClient.send(new DeleteCommand({
      TableName: USERS_TABLE,
      Key: {
        PK: `INVITE#${email.toLowerCase()}`,
        SK: `HOUSEHOLD#${householdId}`,
      },
    }));

    return success({
      message: 'Joined household',
      household: {
        id: householdId,
        name: householdResult.Item.name,
        role: 'member',
      },
    });
  } catch (err) {
    console.error('Error accepting invite:', err);
    return error(500, 'Failed to accept invite');
  }
}
