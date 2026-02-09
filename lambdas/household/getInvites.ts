import { docClient, USERS_TABLE, getUserId, getUserEmail, success, error, QueryCommand } from '../shared/dynamo';

export async function handler(event: any) {
  try {
    const userId = getUserId(event);
    const email = getUserEmail(event);

    // Get all invites for this user's email
    const result = await docClient.send(new QueryCommand({
      TableName: USERS_TABLE,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `INVITE#${email.toLowerCase()}`,
      },
    }));

    const invites = (result.Items || []).map(item => ({
      householdId: item.SK.replace('HOUSEHOLD#', ''),
      householdName: item.householdName,
      invitedBy: item.invitedByEmail,
      invitedAt: item.invitedAt,
    }));

    return success({ invites }, event);
  } catch (err) {
    console.error('Error getting invites:', err);
    return error(500, 'Failed to get invites', event);
  }
}
