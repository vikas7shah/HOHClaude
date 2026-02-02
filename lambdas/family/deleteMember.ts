import { docClient, USERS_TABLE, getUserId, requireHouseholdId, success, error, DeleteCommand } from '../shared/dynamo';

export async function handler(event: any) {
  try {
    const userId = getUserId(event);
    const memberId = event.pathParameters?.memberId;

    if (!memberId) {
      return error(400, 'memberId is required');
    }

    // Require user to be in a household
    let householdId: string;
    try {
      householdId = await requireHouseholdId(userId);
    } catch {
      return error(400, 'You must be part of a household');
    }

    await docClient.send(new DeleteCommand({
      TableName: USERS_TABLE,
      Key: {
        PK: `HOUSEHOLD#${householdId}`,
        SK: `MEMBER#${memberId}`,
      },
    }));

    return success({ message: 'Family member removed' });
  } catch (err) {
    console.error('Error deleting member:', err);
    return error(500, 'Failed to delete family member');
  }
}
