import { docClient, USERS_TABLE, getUserId, requireHouseholdId, success, error, PutCommand } from '../shared/dynamo';
import { randomUUID } from 'crypto';

export async function handler(event: any) {
  try {
    const userId = getUserId(event);
    const body = JSON.parse(event.body || '{}');

    // Require user to be in a household
    let householdId: string;
    try {
      householdId = await requireHouseholdId(userId);
    } catch {
      return error(400, 'You must be part of a household to add family members');
    }

    const { name, dietaryRestrictions, allergies, likes, dislikes } = body;

    if (!name) {
      return error(400, 'name is required');
    }

    const memberId = randomUUID();

    await docClient.send(new PutCommand({
      TableName: USERS_TABLE,
      Item: {
        PK: `HOUSEHOLD#${householdId}`,
        SK: `MEMBER#${memberId}`,
        name,
        dietaryRestrictions: dietaryRestrictions || [],
        allergies: allergies || [],
        likes: likes || [],
        dislikes: dislikes || [],
        addedBy: userId,
        createdAt: new Date().toISOString(),
      },
    }));

    return success({ 
      message: 'Family member added',
      member: { id: memberId, name, dietaryRestrictions, allergies, likes, dislikes }
    });
  } catch (err) {
    console.error('Error adding member:', err);
    return error(500, 'Failed to add family member');
  }
}
