import { docClient, USERS_TABLE, MEAL_PLANS_TABLE, getUserId, requireHouseholdId, success, error, GetCommand, PutCommand, QueryCommand } from '../shared/dynamo';
import { searchRecipes, mapDietaryRestrictions, mapAllergiesToExclude } from '../shared/spoonacular';

export async function handler(event: any) {
  try {
    const userId = getUserId(event);
    const body = JSON.parse(event.body || '{}');

    const { startDate, date, mealType, action, customMealName, forMemberId } = body;

    if (!startDate || !date || !mealType || !action) {
      return error(400, 'startDate, date, mealType, and action are required', event);
    }

    if (action !== 'swap' && action !== 'custom') {
      return error(400, 'action must be "swap" or "custom"', event);
    }

    if (action === 'custom' && !customMealName) {
      return error(400, 'customMealName is required for custom action', event);
    }

    // Require user to be in a household
    let householdId: string;
    try {
      householdId = await requireHouseholdId(userId);
    } catch {
      return error(400, 'You must be part of a household', event);
    }

    // Get the current meal plan
    const planResult = await docClient.send(new GetCommand({
      TableName: MEAL_PLANS_TABLE,
      Key: { PK: `HOUSEHOLD#${householdId}`, SK: `PLAN#${startDate}` },
    }));

    if (!planResult.Item) {
      return error(404, 'Meal plan not found', event);
    }

    const plan = planResult.Item;
    const meals = plan.meals || [];

    // Find the meal to update
    const mealIndex = meals.findIndex((m: any) =>
      m.date === date &&
      m.mealType === mealType &&
      (forMemberId ? m.forMemberId === forMemberId : !m.forMemberId)
    );

    if (mealIndex === -1) {
      return error(404, 'Meal not found in plan', event);
    }

    const currentMeal = meals[mealIndex];
    let updatedMeal: any;

    if (action === 'custom') {
      // Replace with user's custom meal
      updatedMeal = {
        ...currentMeal,
        recipeId: `custom-${Date.now()}`,
        recipeName: customMealName,
        recipeImage: null,
        readyInMinutes: null,
        servings: null,
        sourceUrl: null,
        source: 'user_preference',
        isUserMeal: true,
        updatedAt: new Date().toISOString(),
        updatedBy: userId,
      };
    } else {
      // Swap: Get a different recipe
      // First, get household preferences to check the mode
      const prefsResult = await docClient.send(new GetCommand({
        TableName: USERS_TABLE,
        Key: { PK: `HOUSEHOLD#${householdId}`, SK: 'PREFERENCES' },
      }));

      const preferences = prefsResult.Item || {};
      const mealSuggestionMode = preferences.mealSuggestionMode || 'ai_and_user';
      const typicalBreakfast: string[] = preferences.typicalBreakfast || [];
      const typicalLunch: string[] = preferences.typicalLunch || [];
      const typicalDinner: string[] = preferences.typicalDinner || [];

      console.log('Swap meal - mode:', mealSuggestionMode);

      // If user_preference mode, pick from user's typical meals
      if (mealSuggestionMode === 'user_preference') {
        // Get the appropriate meal list based on meal type
        let userMeals: string[] = [];
        if (mealType === 'breakfast') {
          userMeals = typicalBreakfast;
        } else if (mealType === 'lunch') {
          userMeals = typicalLunch;
        } else if (mealType === 'dinner') {
          userMeals = typicalDinner;
        }

        // Filter out the current meal
        const alternatives = userMeals.filter(m => m !== currentMeal.recipeName);

        if (alternatives.length === 0) {
          return error(404, `No other ${mealType} options in your preferences. Add more options in Household Settings or use "Enter My Own".`, event);
        }

        // Pick a random meal from user's preferences
        const newMealName = alternatives[Math.floor(Math.random() * alternatives.length)];

        updatedMeal = {
          ...currentMeal,
          recipeId: `user-${newMealName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
          recipeName: newMealName,
          recipeImage: null,
          readyInMinutes: null,
          servings: null,
          sourceUrl: null,
          source: 'user_preference',
          isUserMeal: true,
          updatedAt: new Date().toISOString(),
          updatedBy: userId,
        };
      } else {
        // AI mode - use Spoonacular API
        let diet: string | undefined;
        let excludeIngredients: string | undefined;

        // Get family members to aggregate dietary restrictions and allergies
        const familyResult = await docClient.send(new QueryCommand({
          TableName: USERS_TABLE,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          ExpressionAttributeValues: {
            ':pk': `HOUSEHOLD#${householdId}`,
            ':sk': 'MEMBER#',
          },
        }));

        const familyMembers = familyResult.Items || [];

        // Get the current user's profile for their dietary restrictions
        const userProfileResult = await docClient.send(new GetCommand({
          TableName: USERS_TABLE,
          Key: {
            PK: `USER#${userId}`,
            SK: 'PROFILE',
          },
        }));

        const userProfile = userProfileResult.Item;

        // Aggregate all dietary restrictions and allergies
        const allRestrictions = new Set<string>();
        const allAllergies = new Set<string>();

        // From family members (who eat same as adults or if it's their specific meal)
        for (const member of familyMembers) {
          // If swapping a specific member's meal, only use their restrictions
          if (forMemberId && member.SK === `MEMBER#${forMemberId}`) {
            (member.dietaryRestrictions || []).forEach((r: string) => allRestrictions.add(r));
            (member.allergies || []).forEach((a: string) => allAllergies.add(a));
          } else if (!forMemberId && member.sameAsAdults !== false) {
            // For adult meals, include restrictions from members who eat same as adults
            (member.dietaryRestrictions || []).forEach((r: string) => allRestrictions.add(r));
            (member.allergies || []).forEach((a: string) => allAllergies.add(a));
          }
        }

        // From current user's profile (for adult meals)
        if (!forMemberId && userProfile) {
          (userProfile.dietaryRestrictions || []).forEach((r: string) => allRestrictions.add(r));
          (userProfile.allergies || []).forEach((a: string) => allAllergies.add(a));
        }

        // Convert to Spoonacular parameters
        diet = mapDietaryRestrictions([...allRestrictions]);
        excludeIngredients = mapAllergiesToExclude([...allAllergies]) || undefined;

        console.log('Swap meal - dietary restrictions:', [...allRestrictions]);
        console.log('Swap meal - allergies:', [...allAllergies]);
        console.log('Swap meal - diet param:', diet);
        console.log('Swap meal - exclude param:', excludeIngredients);

        // Use a random offset to get different results
        const offset = Math.floor(Math.random() * 50);

        // Search for recipes considering dietary preferences
        const searchResults = await searchRecipes({
          query: mealType === 'breakfast' ? 'breakfast' : mealType === 'lunch' ? 'lunch' : 'dinner',
          diet,
          excludeIngredients,
          number: 5,
          offset,
          addRecipeInformation: true,
        });

        if (!searchResults.results || searchResults.results.length === 0) {
          return error(404, 'No alternative recipes found matching your dietary preferences', event);
        }

        // Pick a random recipe from results that's different from current
        const alternatives = searchResults.results.filter(
          (r: any) => r.id.toString() !== currentMeal.recipeId
        );

        if (alternatives.length === 0) {
          return error(404, 'No different recipes available', event);
        }

        const newRecipe = alternatives[Math.floor(Math.random() * alternatives.length)];

        updatedMeal = {
          ...currentMeal,
          recipeId: newRecipe.id.toString(),
          recipeName: newRecipe.title,
          recipeImage: newRecipe.image || `https://spoonacular.com/recipeImages/${newRecipe.id}-312x231.jpg`,
          readyInMinutes: newRecipe.readyInMinutes,
          servings: newRecipe.servings,
          sourceUrl: newRecipe.sourceUrl,
          source: 'ai_suggest',
          isUserMeal: false,
          updatedAt: new Date().toISOString(),
          updatedBy: userId,
        };
      }
    }

    // Update the meals array
    meals[mealIndex] = updatedMeal;

    // Save back to DynamoDB
    await docClient.send(new PutCommand({
      TableName: MEAL_PLANS_TABLE,
      Item: {
        ...plan,
        meals,
        lastUpdated: new Date().toISOString(),
        lastUpdatedBy: userId,
      },
    }));

    return success({
      message: action === 'custom' ? 'Meal updated with your custom choice' : 'Meal swapped successfully',
      meal: updatedMeal,
    }, event);
  } catch (err: any) {
    console.error('Error updating meal:', err);

    // Check for Spoonacular quota exceeded (402)
    if (err.message?.includes('402')) {
      return error(429, 'Daily recipe quota exceeded. Please try again tomorrow or use "Enter My Own" to add your custom meal.', event);
    }

    return error(500, 'Failed to update meal', event);
  }
}
