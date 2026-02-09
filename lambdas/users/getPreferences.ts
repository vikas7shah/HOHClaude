import { docClient, USERS_TABLE, getUserId, requireHouseholdId, success, error, GetCommand } from '../shared/dynamo';

export async function handler(event: any) {
  try {
    const userId = getUserId(event);

    // Require user to be in a household
    let householdId: string;
    try {
      householdId = await requireHouseholdId(userId);
    } catch {
      return success({ preferences: null }, event);
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
          mealsToInclude: ['breakfast', 'lunch', 'dinner', 'snacks'],
          budget: 'medium',
          typicalBreakfast: [],
          typicalLunch: [],
          typicalDinner: [],
          typicalSnacks: [],
          mealSuggestionMode: 'ai_and_user',
          additionalPreferences: '',
        },
      }, event);
    }

    return success({
      preferences: {
        cuisines: result.Item.cuisines || [],
        cookingTime: result.Item.cookingTime || 'medium',
        mealsToInclude: result.Item.mealsToInclude || ['breakfast', 'lunch', 'dinner', 'snacks'],
        budget: result.Item.budget || 'medium',
        typicalBreakfast: result.Item.typicalBreakfast || [],
        typicalLunch: result.Item.typicalLunch || [],
        typicalDinner: result.Item.typicalDinner || [],
        typicalSnacks: result.Item.typicalSnacks || [],
        mealSuggestionMode: result.Item.mealSuggestionMode || 'ai_and_user',
        additionalPreferences: result.Item.additionalPreferences || '',
      },
    }, event);
  } catch (err) {
    console.error('Error getting preferences:', err);
    return error(500, 'Failed to get preferences', event);
  }
}
