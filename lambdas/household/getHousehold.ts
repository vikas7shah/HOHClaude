import { docClient, USERS_TABLE, getUserId, requireHouseholdId, success, error, GetCommand, QueryCommand } from '../shared/dynamo';

export async function handler(event: any) {
  try {
    const userId = getUserId(event);
    
    let householdId: string;
    try {
      householdId = await requireHouseholdId(userId);
    } catch {
      return success({ household: null }, event);
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
      return error(404, 'Household not found', event);
    }

    // Get all users in household via GSI
    const usersResult = await docClient.send(new QueryCommand({
      TableName: USERS_TABLE,
      IndexName: 'byHousehold',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `HOUSEHOLD#${householdId}`,
      },
    }));

    const users = (usersResult.Items || []).map(item => ({
      id: item.PK.replace('USER#', ''),
      email: item.email,
      displayName: item.displayName,
      role: item.role,
      isCurrentUser: item.PK === `USER#${userId}`,
    }));

    return success({
      household: {
        id: householdId,
        name: householdResult.Item.name,
        createdAt: householdResult.Item.createdAt,
        users,
      },
    }, event);
  } catch (err) {
    console.error('Error getting household:', err);
    return error(500, 'Failed to get household', event);
  }
}
