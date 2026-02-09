import { docClient, USERS_TABLE, getUserId, getUserProfile, success, error, PutCommand, QueryCommand, DeleteCommand } from '../shared/dynamo';

export async function handler(event: any) {
  try {
    const userId = getUserId(event);

    const profile = await getUserProfile(userId);
    if (!profile?.householdId) {
      return error(400, 'You are not part of a household', event);
    }

    const householdId = profile.householdId;

    // Check if user is the only admin
    if (profile.role === 'admin') {
      // Get all users in household
      const usersResult = await docClient.send(new QueryCommand({
        TableName: USERS_TABLE,
        IndexName: 'byHousehold',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `HOUSEHOLD#${householdId}`,
        },
      }));

      const users = usersResult.Items || [];
      const admins = users.filter(u => u.role === 'admin');
      const otherMembers = users.filter(u => u.PK !== `USER#${userId}`);

      if (admins.length === 1 && otherMembers.length > 0) {
        return error(400, 'You are the only admin. Promote another member to admin before leaving, or remove all members first.', event);
      }

      // If user is last person, delete household data
      if (otherMembers.length === 0) {
        // Delete household info
        await docClient.send(new DeleteCommand({
          TableName: USERS_TABLE,
          Key: {
            PK: `HOUSEHOLD#${householdId}`,
            SK: 'INFO',
          },
        }));

        // Delete household preferences
        await docClient.send(new DeleteCommand({
          TableName: USERS_TABLE,
          Key: {
            PK: `HOUSEHOLD#${householdId}`,
            SK: 'PREFERENCES',
          },
        }));

        // Delete all family members
        const membersResult = await docClient.send(new QueryCommand({
          TableName: USERS_TABLE,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          ExpressionAttributeValues: {
            ':pk': `HOUSEHOLD#${householdId}`,
            ':sk': 'MEMBER#',
          },
        }));

        for (const member of membersResult.Items || []) {
          await docClient.send(new DeleteCommand({
            TableName: USERS_TABLE,
            Key: { PK: member.PK, SK: member.SK },
          }));
        }
      }
    }

    // Update user profile to remove household
    await docClient.send(new PutCommand({
      TableName: USERS_TABLE,
      Item: {
        PK: `USER#${userId}`,
        SK: 'PROFILE',
        email: profile.email,
        displayName: profile.displayName,
        householdId: null,
        role: null,
        GSI1PK: null,
        GSI1SK: null,
        createdAt: profile.createdAt,
        updatedAt: new Date().toISOString(),
      },
    }));

    return success({ message: 'Left household' }, event);
  } catch (err) {
    console.error('Error leaving household:', err);
    return error(500, 'Failed to leave household', event);
  }
}
