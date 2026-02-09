import { docClient, MEAL_PLANS_TABLE, getUserId, requireHouseholdId, success, error, QueryCommand, GetCommand } from '../shared/dynamo';

export async function handler(event: any) {
  try {
    const userId = getUserId(event);
    const startDate = event.queryStringParameters?.startDate;

    // Require user to be in a household
    let householdId: string;
    try {
      householdId = await requireHouseholdId(userId);
    } catch {
      return success({ plan: null }, event);
    }

    if (startDate) {
      // Get specific plan by date
      const result = await docClient.send(new GetCommand({
        TableName: MEAL_PLANS_TABLE,
        Key: {
          PK: `HOUSEHOLD#${householdId}`,
          SK: `PLAN#${startDate}`,
        },
      }));

      if (!result.Item) {
        return success({ plan: null }, event);
      }

      return success({
        plan: {
          startDate: result.Item.startDate,
          endDate: result.Item.endDate,
          meals: result.Item.meals,
          generatedAt: result.Item.generatedAt,
          mealSuggestionMode: result.Item.mealSuggestionMode,
        },
      }, event);
    }

    // Get most recent plan
    const result = await docClient.send(new QueryCommand({
      TableName: MEAL_PLANS_TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `HOUSEHOLD#${householdId}`,
        ':sk': 'PLAN#',
      },
      ScanIndexForward: false, // Most recent first
      Limit: 1,
    }));

    if (!result.Items || result.Items.length === 0) {
      return success({ plan: null }, event);
    }

    const plan = result.Items[0];
    return success({
      plan: {
        startDate: plan.startDate,
        endDate: plan.endDate,
        meals: plan.meals,
        generatedAt: plan.generatedAt,
        mealSuggestionMode: plan.mealSuggestionMode,
      },
    }, event);
  } catch (err) {
    console.error('Error getting plan:', err);
    return error(500, 'Failed to get meal plan', event);
  }
}
