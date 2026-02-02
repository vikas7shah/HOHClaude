import { docClient, USERS_TABLE, MEAL_PLANS_TABLE, getUserId, requireHouseholdId, success, error, QueryCommand, GetCommand, PutCommand } from '../shared/dynamo';
import { generateMealPlan, mapDietaryRestrictions, mapAllergiesToExclude } from '../shared/spoonacular';

export async function handler(event: any) {
  try {
    const userId = getUserId(event);
    const body = JSON.parse(event.body || '{}');
    
    const { startDate } = body; // YYYY-MM-DD format
    
    if (!startDate) {
      return error(400, 'startDate is required (YYYY-MM-DD)');
    }

    // Require user to be in a household
    let householdId: string;
    try {
      householdId = await requireHouseholdId(userId);
    } catch {
      return error(400, 'You must be part of a household to generate meal plans');
    }

    // Get household preferences
    const prefsResult = await docClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { PK: `HOUSEHOLD#${householdId}`, SK: 'PREFERENCES' },
    }));

    // Get family members to aggregate dietary restrictions
    const familyResult = await docClient.send(new QueryCommand({
      TableName: USERS_TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `HOUSEHOLD#${householdId}`,
        ':sk': 'MEMBER#',
      },
    }));

    // Aggregate all dietary restrictions and allergies
    const allRestrictions = new Set<string>();
    const allAllergies = new Set<string>();
    
    for (const member of familyResult.Items || []) {
      (member.dietaryRestrictions || []).forEach((r: string) => allRestrictions.add(r));
      (member.allergies || []).forEach((a: string) => allAllergies.add(a));
    }

    // Call Spoonacular
    const diet = mapDietaryRestrictions([...allRestrictions]);
    const exclude = mapAllergiesToExclude([...allAllergies]);

    const spoonacularPlan = await generateMealPlan({
      timeFrame: 'week',
      diet,
      exclude: exclude || undefined,
    });

    // Transform to our format
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const meals: any[] = [];
    
    const start = new Date(startDate);
    
    days.forEach((day, index) => {
      const dayPlan = (spoonacularPlan.week as any)[day];
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const dateStr = date.toISOString().split('T')[0];

      dayPlan.meals.forEach((meal: any, mealIndex: number) => {
        const mealTypes = ['breakfast', 'lunch', 'dinner'];
        meals.push({
          date: dateStr,
          day,
          mealType: mealTypes[mealIndex] || 'dinner',
          recipeId: meal.id.toString(),
          recipeName: meal.title,
          recipeImage: `https://spoonacular.com/recipeImages/${meal.id}-312x231.jpg`,
          readyInMinutes: meal.readyInMinutes,
          servings: meal.servings,
          sourceUrl: meal.sourceUrl,
        });
      });
    });

    // Calculate end date
    const endDate = new Date(start);
    endDate.setDate(start.getDate() + 6);

    // Save to DynamoDB (keyed by household, not user)
    await docClient.send(new PutCommand({
      TableName: MEAL_PLANS_TABLE,
      Item: {
        PK: `HOUSEHOLD#${householdId}`,
        SK: `PLAN#${startDate}`,
        startDate,
        endDate: endDate.toISOString().split('T')[0],
        meals,
        generatedBy: userId,
        generatedAt: new Date().toISOString(),
        // TTL: auto-delete after 90 days
        ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60),
      },
    }));

    return success({
      startDate,
      endDate: endDate.toISOString().split('T')[0],
      meals,
    });
  } catch (err) {
    console.error('Error generating plan:', err);
    return error(500, 'Failed to generate meal plan');
  }
}
