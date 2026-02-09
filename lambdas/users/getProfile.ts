import { docClient, USERS_TABLE, getUserId, getUserEmail, success, error, GetCommand } from '../shared/dynamo';

export async function handler(event: any) {
  try {
    const userId = getUserId(event);
    const email = getUserEmail(event);

    const result = await docClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: {
        PK: `USER#${userId}`,
        SK: 'PROFILE',
      },
    }));

    if (!result.Item) {
      // User exists in Cognito but no profile yet
      return success({
        profile: {
          email,
          displayName: null,
          householdId: null,
          role: null,
          dietaryRestrictions: [],
          allergies: [],
        },
        household: null,
        hasHousehold: false,
      }, event);
    }

    // If user has a household, get household info
    let household = null;
    if (result.Item.householdId) {
      const householdResult = await docClient.send(new GetCommand({
        TableName: USERS_TABLE,
        Key: {
          PK: `HOUSEHOLD#${result.Item.householdId}`,
          SK: 'INFO',
        },
      }));

      if (householdResult.Item) {
        household = {
          id: result.Item.householdId,
          name: householdResult.Item.name,
        };
      }
    }

    return success({
      profile: {
        email: result.Item.email,
        displayName: result.Item.displayName,
        householdId: result.Item.householdId,
        role: result.Item.role,
        dietaryRestrictions: result.Item.dietaryRestrictions || [],
        allergies: result.Item.allergies || [],
      },
      household,
      hasHousehold: !!result.Item.householdId,
    }, event);
  } catch (err) {
    console.error('Error getting profile:', err);
    return error(500, 'Failed to get profile', event);
  }
}
