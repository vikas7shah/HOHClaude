import { docClient, USERS_TABLE, getUserId, requireHouseholdId, success, error, GetCommand } from '../shared/dynamo';

export async function handler(event: any) {
  try {
    const userId = getUserId(event);

    // Require user to be in a household
    let householdId: string;
    try {
      householdId = await requireHouseholdId(userId);
    } catch {
      return success({ preferences: null });
    }

    const result = await docClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: {
        PK: `HOUSEHOLD#${householdId}`,
        SK: 'PREFERENCES',
      },
    }));

    if (!result.Item) {
      return success({
        preferences: {
          cuisines: [],
          cookingTime: 'medium',
          mealsToInclude: ['breakfast', 'lunch', 'dinner'],
          budget: 'medium',
        },
      });
    }

    return success({
      preferences: {
        cuisines: result.Item.cuisines || [],
        cookingTime: result.Item.cookingTime || 'medium',
        mealsToInclude: result.Item.mealsToInclude || ['breakfast', 'lunch', 'dinner'],
        budget: result.Item.budget || 'medium',
      },
    });
  } catch (err) {
    console.error('Error getting preferences:', err);
    return error(500, 'Failed to get preferences');
  }
}
