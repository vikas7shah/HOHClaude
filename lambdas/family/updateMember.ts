import { docClient, USERS_TABLE, getUserId, requireHouseholdId, success, error, PutCommand, GetCommand } from '../shared/dynamo';

export async function handler(event: any) {
  try {
    const userId = getUserId(event);
    const memberId = event.pathParameters?.memberId;
    const body = JSON.parse(event.body || '{}');

    if (!memberId) {
      return error(400, 'memberId is required', event);
    }

    // Require user to be in a household
    let householdId: string;
    try {
      householdId = await requireHouseholdId(userId);
    } catch {
      return error(400, 'You must be part of a household to update family members', event);
    }

    // Fetch existing member to make sure it exists
    const existingResult = await docClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: {
        PK: `HOUSEHOLD#${householdId}`,
        SK: `MEMBER#${memberId}`,
      },
    }));

    if (!existingResult.Item) {
      return error(404, 'Family member not found', event);
    }

    const { name, age, dietaryRestrictions, allergies, likes, dislikes, sameAsAdults, mealPreferences } = body;

    if (!name) {
      return error(400, 'name is required', event);
    }

    const sameAsAdultsValue = sameAsAdults !== undefined ? sameAsAdults : true;

    // Only store meal preferences if member has different meals
    const mealPrefsToStore = !sameAsAdultsValue && mealPreferences ? {
      breakfast: mealPreferences.breakfast || [],
      lunch: mealPreferences.lunch || [],
      dinner: mealPreferences.dinner || [],
    } : null;

    await docClient.send(new PutCommand({
      TableName: USERS_TABLE,
      Item: {
        PK: `HOUSEHOLD#${householdId}`,
        SK: `MEMBER#${memberId}`,
        name,
        age: age !== undefined ? age : null,
        dietaryRestrictions: dietaryRestrictions || [],
        allergies: allergies || [],
        likes: likes || [],
        dislikes: dislikes || [],
        sameAsAdults: sameAsAdultsValue,
        mealPreferences: mealPrefsToStore,
        addedBy: existingResult.Item.addedBy,
        createdAt: existingResult.Item.createdAt,
        updatedAt: new Date().toISOString(),
        updatedBy: userId,
      },
    }));

    return success({
      message: 'Family member updated',
      member: {
        id: memberId,
        name,
        age,
        dietaryRestrictions: dietaryRestrictions || [],
        allergies: allergies || [],
        likes: likes || [],
        dislikes: dislikes || [],
        sameAsAdults: sameAsAdultsValue,
        mealPreferences: mealPrefsToStore,
      }
    }, event);
  } catch (err) {
    console.error('Error updating member:', err);
    return error(500, 'Failed to update family member', event);
  }
}
