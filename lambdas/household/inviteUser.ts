import { docClient, USERS_TABLE, getUserId, getUserProfile, requireHouseholdId, success, error, PutCommand, GetCommand, QueryCommand } from '../shared/dynamo';

export async function handler(event: any) {
  try {
    const userId = getUserId(event);
    const body = JSON.parse(event.body || '{}');
    const { email } = body;

    if (!email) {
      return error(400, 'Email is required', event);
    }

    // Get current user's profile
    const profile = await getUserProfile(userId);
    if (!profile?.householdId) {
      return error(400, 'You must be part of a household to invite users', event);
    }
    if (profile.role !== 'admin') {
      return error(403, 'Only admins can invite users', event);
    }

    const householdId = profile.householdId;

    // Get household name for the invite
    const householdResult = await docClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: {
        PK: `HOUSEHOLD#${householdId}`,
        SK: 'INFO',
      },
    }));

    const householdName = householdResult.Item?.name || 'Unknown';

    // Check if invite already exists
    const existingInvite = await docClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: {
        PK: `INVITE#${email.toLowerCase()}`,
        SK: `HOUSEHOLD#${householdId}`,
      },
    }));

    if (existingInvite.Item) {
      return error(400, 'Invite already sent to this email', event);
    }

    // Create invite
    await docClient.send(new PutCommand({
      TableName: USERS_TABLE,
      Item: {
        PK: `INVITE#${email.toLowerCase()}`,
        SK: `HOUSEHOLD#${householdId}`,
        invitedBy: userId,
        invitedByEmail: profile.email,
        householdName,
        invitedAt: new Date().toISOString(),
        // TTL: invite expires in 7 days
        ttl: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
      },
    }));

    return success({
      message: 'Invite sent',
      invite: {
        email: email.toLowerCase(),
        householdName,
      },
    }, event);
  } catch (err) {
    console.error('Error inviting user:', err);
    return error(500, 'Failed to send invite', event);
  }
}
