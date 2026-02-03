import { docClient, USERS_TABLE, getUserId, requireHouseholdId, success, error, PutCommand, GetCommand } from '../shared/dynamo';

export async function handler(event: any) {
  try {
    const userId = getUserId(event);
    const body = JSON.parse(event.body || '{}');

    // Require user to be in a household
    let householdId: string;
    try {
      householdId = await requireHouseholdId(userId);
    } catch {
      return error(400, 'You must be part of a household to set preferences');
    }

    const {
      cuisines,
      cookingTime,
      mealsToInclude,
      budget,
      typicalBreakfast,
      typicalLunch,
      typicalDinner,
      typicalSnacks,
      mealSuggestionMode,
      additionalPreferences
    } = body;

    // Get existing preferences
    const existing = await docClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: {
        PK: `HOUSEHOLD#${householdId}`,
        SK: 'PREFERENCES',
      },
    }));

    await docClient.send(new PutCommand({
      TableName: USERS_TABLE,
      Item: {
        PK: `HOUSEHOLD#${householdId}`,
        SK: 'PREFERENCES',
        cuisines: cuisines ?? existing.Item?.cuisines ?? [],
        cookingTime: cookingTime ?? existing.Item?.cookingTime ?? 'medium',
        mealsToInclude: mealsToInclude ?? existing.Item?.mealsToInclude ?? ['breakfast', 'lunch', 'dinner', 'snacks'],
        budget: budget ?? existing.Item?.budget ?? 'medium',
        typicalBreakfast: typicalBreakfast ?? existing.Item?.typicalBreakfast ?? [],
        typicalLunch: typicalLunch ?? existing.Item?.typicalLunch ?? [],
        typicalDinner: typicalDinner ?? existing.Item?.typicalDinner ?? [],
        typicalSnacks: typicalSnacks ?? existing.Item?.typicalSnacks ?? [],
        mealSuggestionMode: mealSuggestionMode ?? existing.Item?.mealSuggestionMode ?? 'ai_and_user',
        additionalPreferences: additionalPreferences ?? existing.Item?.additionalPreferences ?? '',
        updatedBy: userId,
        updatedAt: new Date().toISOString(),
      },
    }));

    return success({ message: 'Preferences saved' });
  } catch (err) {
    console.error('Error updating preferences:', err);
    return error(500, 'Failed to update preferences');
  }
}
