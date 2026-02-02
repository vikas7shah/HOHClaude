import { docClient, USERS_TABLE, MEAL_PLANS_TABLE, getUserId, requireHouseholdId, success, error, QueryCommand, GetCommand, PutCommand } from '../shared/dynamo';
import { generateMealPlan, mapDietaryRestrictions, mapAllergiesToExclude } from '../shared/spoonacular';

// Helper to pick random item from array
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Generate a simple ID for user-provided meals
function generateMealId(mealName: string): string {
  return `user-${mealName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
}

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

    const preferences = prefsResult.Item || {};
    const mealSuggestionMode = preferences.mealSuggestionMode || 'ai_and_user';
    const typicalBreakfast: string[] = preferences.typicalBreakfast || [];
    const typicalLunch: string[] = preferences.typicalLunch || [];
    const typicalDinner: string[] = preferences.typicalDinner || [];

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

    const diet = mapDietaryRestrictions([...allRestrictions]);
    const exclude = mapAllergiesToExclude([...allAllergies]);

    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const meals: any[] = [];
    const start = new Date(startDate);

    // Only call Spoonacular API if mode is 'ai_suggest' or 'ai_and_user'
    let aiPlan: any = null;
    if (mealSuggestionMode === 'ai_suggest' || mealSuggestionMode === 'ai_and_user') {
      aiPlan = await generateMealPlan({
        timeFrame: 'week',
        diet,
        exclude: exclude || undefined,
      });
    }

    // Build the meal plan
    days.forEach((day, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const dateStr = date.toISOString().split('T')[0];

      const mealTypes = ['breakfast', 'lunch', 'dinner'];

      mealTypes.forEach((mealType, mealIndex) => {
        // Get user's typical meals for this meal type
        const userMeals =
          mealType === 'breakfast' ? typicalBreakfast :
          mealType === 'lunch' ? typicalLunch : typicalDinner;

        if (mealSuggestionMode === 'user_preference') {
          // USER PREFERENCE ONLY: Use saved meals directly, no API calls
          if (userMeals.length > 0) {
            const mealName = pickRandom(userMeals);
            meals.push({
              date: dateStr,
              day,
              mealType,
              recipeId: generateMealId(mealName),
              recipeName: mealName,
              recipeImage: null, // No image for user-provided meals
              readyInMinutes: null,
              servings: null,
              sourceUrl: null,
              source: 'user_preference',
              isUserMeal: true, // Flag to indicate this is a user-provided meal name
            });
          }
          // If no user meals for this type, skip (don't fill with AI)
        } else if (mealSuggestionMode === 'ai_and_user') {
          // MIX OF BOTH: Alternate between user meals and AI suggestions
          const useUserMeal = index % 2 === 0 && userMeals.length > 0;

          if (useUserMeal) {
            const mealName = pickRandom(userMeals);
            meals.push({
              date: dateStr,
              day,
              mealType,
              recipeId: generateMealId(mealName),
              recipeName: mealName,
              recipeImage: null,
              readyInMinutes: null,
              servings: null,
              sourceUrl: null,
              source: 'user_preference',
              isUserMeal: true,
            });
          } else if (aiPlan) {
            const dayPlan = (aiPlan.week as any)[day];
            const recipe = dayPlan?.meals?.[mealIndex];
            if (recipe) {
              meals.push({
                date: dateStr,
                day,
                mealType,
                recipeId: recipe.id.toString(),
                recipeName: recipe.title,
                recipeImage: `https://spoonacular.com/recipeImages/${recipe.id}-312x231.jpg`,
                readyInMinutes: recipe.readyInMinutes,
                servings: recipe.servings,
                sourceUrl: recipe.sourceUrl,
                source: 'ai_suggest',
                isUserMeal: false,
              });
            }
          }
        } else {
          // AI SUGGEST ONLY: Use Spoonacular API
          if (aiPlan) {
            const dayPlan = (aiPlan.week as any)[day];
            const recipe = dayPlan?.meals?.[mealIndex];
            if (recipe) {
              meals.push({
                date: dateStr,
                day,
                mealType,
                recipeId: recipe.id.toString(),
                recipeName: recipe.title,
                recipeImage: `https://spoonacular.com/recipeImages/${recipe.id}-312x231.jpg`,
                readyInMinutes: recipe.readyInMinutes,
                servings: recipe.servings,
                sourceUrl: recipe.sourceUrl,
                source: 'ai_suggest',
                isUserMeal: false,
              });
            }
          }
        }
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
        mealSuggestionMode,
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
      mealSuggestionMode,
    });
  } catch (err) {
    console.error('Error generating plan:', err);
    return error(500, 'Failed to generate meal plan');
  }
}
