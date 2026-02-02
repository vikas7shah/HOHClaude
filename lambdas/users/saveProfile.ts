import { docClient, USERS_TABLE, getUserId, getUserEmail, getUserProfile, success, error, PutCommand } from '../shared/dynamo';

export async function handler(event: any) {
  try {
    const userId = getUserId(event);
    const email = getUserEmail(event);
    const body = JSON.parse(event.body || '{}');

    const { displayName } = body;

    // Get existing profile to preserve household info
    const existingProfile = await getUserProfile(userId);
    const now = new Date().toISOString();

    await docClient.send(new PutCommand({
      TableName: USERS_TABLE,
      Item: {
        PK: `USER#${userId}`,
        SK: 'PROFILE',
        email,
        displayName: displayName || existingProfile?.displayName || email.split('@')[0],
        householdId: existingProfile?.householdId || null,
        role: existingProfile?.role || null,
        GSI1PK: existingProfile?.GSI1PK || null,
        GSI1SK: existingProfile?.GSI1SK || null,
        createdAt: existingProfile?.createdAt || now,
        updatedAt: now,
      },
    }));

    return success({ message: 'Profile saved' });
  } catch (err) {
    console.error('Error saving profile:', err);
    return error(500, 'Failed to save profile');
  }
}
