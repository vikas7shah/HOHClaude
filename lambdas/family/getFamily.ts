import { docClient, USERS_TABLE, getUserId, requireHouseholdId, success, error, QueryCommand } from '../shared/dynamo';

export async function handler(event: any) {
  try {
    const userId = getUserId(event);

    // Require user to be in a household
    let householdId: string;
    try {
      householdId = await requireHouseholdId(userId);
    } catch {
      return success({ members: [] }); // No household = no family members
    }

    const result = await docClient.send(new QueryCommand({
      TableName: USERS_TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `HOUSEHOLD#${householdId}`,
        ':sk': 'MEMBER#',
      },
    }));

    const members = (result.Items || []).map(item => ({
      id: item.SK.replace('MEMBER#', ''),
      name: item.name,
      age: item.age !== null ? item.age : undefined,
      dietaryRestrictions: item.dietaryRestrictions || [],
      allergies: item.allergies || [],
      likes: item.likes || [],
      dislikes: item.dislikes || [],
      sameAsAdults: item.sameAsAdults !== undefined ? item.sameAsAdults : true,
      mealPreferences: item.mealPreferences || null,
    }));

    return success({ members });
  } catch (err) {
    console.error('Error getting family:', err);
    return error(500, 'Failed to get family members');
  }
}
