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

// Remove undefined/null values from an object for DynamoDB compatibility
function cleanMealObject(meal: any): any {
  const cleaned: any = {};
  for (const [key, value] of Object.entries(meal)) {
    if (value !== undefined && value !== null) {
      cleaned[key] = value;
    }
  }
  return cleaned;
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
    const cookingTime = preferences.cookingTime || 'medium';
    const additionalPreferences: string = preferences.additionalPreferences || '';
    const typicalBreakfast: string[] = preferences.typicalBreakfast || [];
    const typicalLunch: string[] = preferences.typicalLunch || [];
    const typicalDinner: string[] = preferences.typicalDinner || [];
    const typicalSnacks: string[] = preferences.typicalSnacks || [];

    // Log the mode being used
    console.log('Generating meal plan with mode:', mealSuggestionMode);
    console.log('Preferences from DB:', JSON.stringify(preferences));

    // Map cooking time to max ready time in minutes
    const maxReadyTime = cookingTime === 'quick' ? 20 : cookingTime === 'medium' ? 45 : 120;

    // Get family members to aggregate dietary restrictions
    const familyResult = await docClient.send(new QueryCommand({
      TableName: USERS_TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `HOUSEHOLD#${householdId}`,
        ':sk': 'MEMBER#',
      },
    }));

    // Separate family members into two groups: same as adults and different meals
    const familyMembers = familyResult.Items || [];
    const membersWithSameMeals = familyMembers.filter(m => m.sameAsAdults !== false);
    const membersWithDifferentMeals = familyMembers.filter(m => m.sameAsAdults === false);

    console.log('Members eating same as adults:', membersWithSameMeals.map((m: any) => m.name));
    console.log('Members needing different meals:', membersWithDifferentMeals.map((m: any) => m.name));

    // Aggregate all dietary restrictions and allergies for adults/same-meal members
    const allRestrictions = new Set<string>();
    const allAllergies = new Set<string>();

    for (const member of membersWithSameMeals) {
      (member.dietaryRestrictions || []).forEach((r: string) => allRestrictions.add(r));
      (member.allergies || []).forEach((a: string) => allAllergies.add(a));
    }

    const diet = mapDietaryRestrictions([...allRestrictions]);
    const exclude = mapAllergiesToExclude([...allAllergies]);

    // Get restrictions/allergies for members with different meals (for kid-friendly meals)
    const kidRestrictions = new Set<string>();
    const kidAllergies = new Set<string>();

    for (const member of membersWithDifferentMeals) {
      (member.dietaryRestrictions || []).forEach((r: string) => kidRestrictions.add(r));
      (member.allergies || []).forEach((a: string) => kidAllergies.add(a));
    }

    const kidDiet = mapDietaryRestrictions([...kidRestrictions]);
    const kidExclude = mapAllergiesToExclude([...kidAllergies]);

    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const meals: any[] = [];
    const start = new Date(startDate);

    // Check if user_preference mode has any meals defined
    const hasAnyTypicalMeals = typicalBreakfast.length > 0 ||
                               typicalLunch.length > 0 ||
                               typicalDinner.length > 0 ||
                               typicalSnacks.length > 0;

    if (mealSuggestionMode === 'user_preference' && !hasAnyTypicalMeals) {
      return error(400, 'You have "My Preferences Only" mode selected but no typical meals saved. Please go to Household Settings and add your typical breakfast, lunch, dinner, or snack options first. Or switch to "AI Suggestions" mode.');
    }

    // Only call Spoonacular API if mode is 'ai_suggest' or 'ai_and_user'
    let aiPlan: any = null;
    let kidAiPlan: any = null;

    if (mealSuggestionMode === 'ai_suggest' || mealSuggestionMode === 'ai_and_user') {
      console.log('Calling Spoonacular API for AI suggestions...');
      aiPlan = await generateMealPlan({
        timeFrame: 'week',
        diet,
        exclude: exclude || undefined,
      });
      console.log('Spoonacular API response received:', aiPlan ? 'success' : 'null');

      // Generate separate meal plan for kids with different meals
      if (membersWithDifferentMeals.length > 0) {
        console.log('Calling Spoonacular API for kid-friendly meals...');
        kidAiPlan = await generateMealPlan({
          timeFrame: 'week',
          diet: kidDiet,
          exclude: kidExclude || undefined,
        });
        console.log('Kid Spoonacular API response received:', kidAiPlan ? 'success' : 'null');
      }
    } else {
      console.log('Skipping Spoonacular API - user_preference mode');
    }

    // Helper to build member names list for "Adults" group
    const adultMemberNames = ['Adults', ...membersWithSameMeals.map((m: any) => m.name)];
    const kidMemberData = membersWithDifferentMeals.map((m: any) => ({
      id: m.SK.replace('MEMBER#', ''),
      name: m.name,
      mealPreferences: m.mealPreferences || null,
    }));

    // Build the meal plan
    days.forEach((day, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const dateStr = date.toISOString().split('T')[0];

      const mealTypes = ['breakfast', 'lunch', 'dinner', 'snacks'];

      mealTypes.forEach((mealType, mealIndex) => {
        // Get user's typical meals for this meal type
        const userMeals =
          mealType === 'breakfast' ? typicalBreakfast :
          mealType === 'lunch' ? typicalLunch :
          mealType === 'dinner' ? typicalDinner : typicalSnacks;

        // Determine who this meal is for (only set if there are members with different meals)
        const forMembers = membersWithDifferentMeals.length > 0
          ? adultMemberNames
          : null; // If no one has different meals, set to null (DynamoDB accepts null but not undefined)

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
              forMembers,
            });
          }
          // If no user meals for this type, skip (don't fill with AI)
        } else if (mealSuggestionMode === 'ai_and_user') {
          // MIX OF BOTH: Alternate between user meals and AI suggestions
          const useUserMeal = index % 2 === 0 && userMeals.length > 0;

          // Snacks always use user preferences if available (Spoonacular doesn't include snacks)
          if (mealType === 'snacks') {
            if (userMeals.length > 0) {
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
                forMembers,
              });
            }
          } else if (useUserMeal) {
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
              forMembers,
            });
          } else if (aiPlan) {
            const dayPlan = (aiPlan.week as any)[day];
            // Spoonacular only returns 3 meals (breakfast, lunch, dinner) per day
            const aiMealIndex = mealType === 'breakfast' ? 0 : mealType === 'lunch' ? 1 : 2;
            const recipe = dayPlan?.meals?.[aiMealIndex];
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
                forMembers,
              });
            }
          }
        } else {
          // AI SUGGEST ONLY: Use Spoonacular API
          // Snacks use user preferences if available (Spoonacular doesn't include snacks)
          if (mealType === 'snacks') {
            if (userMeals.length > 0) {
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
                forMembers,
              });
            }
          } else if (aiPlan) {
            const dayPlan = (aiPlan.week as any)[day];
            // Spoonacular only returns 3 meals (breakfast, lunch, dinner) per day
            const aiMealIndex = mealType === 'breakfast' ? 0 : mealType === 'lunch' ? 1 : 2;
            const recipe = dayPlan?.meals?.[aiMealIndex];
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
                forMembers,
              });
            }
          }
        }

        // Now add separate meals for kids who need different meals
        if (kidMemberData.length > 0 && mealType !== 'snacks') {
          // For each kid with different meals, add a separate meal entry
          kidMemberData.forEach((kid) => {
            // Get this kid's meal preferences for this meal type
            const kidMealPrefs = kid.mealPreferences;
            const kidMealsForType = kidMealPrefs ?
              (mealType === 'breakfast' ? kidMealPrefs.breakfast :
               mealType === 'lunch' ? kidMealPrefs.lunch :
               kidMealPrefs.dinner) || [] : [];

            // In user_preference mode, use kid's specific meal preferences
            if (mealSuggestionMode === 'user_preference') {
              if (kidMealsForType.length > 0) {
                // Use kid's own meal preferences
                const mealName = pickRandom(kidMealsForType);
                meals.push({
                  date: dateStr,
                  day,
                  mealType,
                  recipeId: `kid-${kid.id}-${generateMealId(mealName)}`,
                  recipeName: mealName,
                  recipeImage: null,
                  readyInMinutes: null,
                  servings: 1,
                  sourceUrl: null,
                  source: 'user_preference',
                  isUserMeal: true,
                  forMembers: [kid.name],
                  forMemberId: kid.id,
                });
              } else if (userMeals.length > 0) {
                // Fall back to family preferences if kid has none
                const mealName = pickRandom(userMeals);
                meals.push({
                  date: dateStr,
                  day,
                  mealType,
                  recipeId: `kid-${kid.id}-${generateMealId(mealName)}`,
                  recipeName: mealName,
                  recipeImage: null,
                  readyInMinutes: null,
                  servings: 1,
                  sourceUrl: null,
                  source: 'user_preference',
                  isUserMeal: true,
                  forMembers: [kid.name],
                  forMemberId: kid.id,
                });
              }
            } else if (mealSuggestionMode === 'ai_and_user') {
              // Mix mode: alternate between kid's preferences and AI
              const useKidMeal = index % 2 === 0 && kidMealsForType.length > 0;

              if (useKidMeal) {
                const mealName = pickRandom(kidMealsForType);
                meals.push({
                  date: dateStr,
                  day,
                  mealType,
                  recipeId: `kid-${kid.id}-${generateMealId(mealName)}`,
                  recipeName: mealName,
                  recipeImage: null,
                  readyInMinutes: null,
                  servings: 1,
                  sourceUrl: null,
                  source: 'user_preference',
                  isUserMeal: true,
                  forMembers: [kid.name],
                  forMemberId: kid.id,
                });
              } else if (kidAiPlan) {
                const dayPlan = (kidAiPlan.week as any)[day];
                const aiMealIndex = mealType === 'breakfast' ? 0 : mealType === 'lunch' ? 1 : 2;
                const recipe = dayPlan?.meals?.[aiMealIndex];
                if (recipe) {
                  meals.push({
                    date: dateStr,
                    day,
                    mealType,
                    recipeId: `kid-${kid.id}-${recipe.id}`,
                    recipeName: recipe.title,
                    recipeImage: `https://spoonacular.com/recipeImages/${recipe.id}-312x231.jpg`,
                    readyInMinutes: recipe.readyInMinutes,
                    servings: 1,
                    sourceUrl: recipe.sourceUrl,
                    source: 'ai_suggest',
                    isUserMeal: false,
                    forMembers: [kid.name],
                    forMemberId: kid.id,
                  });
                }
              }
            } else {
              // AI suggest only mode
              if (kidAiPlan) {
                const dayPlan = (kidAiPlan.week as any)[day];
                const aiMealIndex = mealType === 'breakfast' ? 0 : mealType === 'lunch' ? 1 : 2;
                const recipe = dayPlan?.meals?.[aiMealIndex];
                if (recipe) {
                  meals.push({
                    date: dateStr,
                    day,
                    mealType,
                    recipeId: `kid-${kid.id}-${recipe.id}`,
                    recipeName: recipe.title,
                    recipeImage: `https://spoonacular.com/recipeImages/${recipe.id}-312x231.jpg`,
                    readyInMinutes: recipe.readyInMinutes,
                    servings: 1,
                    sourceUrl: recipe.sourceUrl,
                    source: 'ai_suggest',
                    isUserMeal: false,
                    forMembers: [kid.name],
                    forMemberId: kid.id,
                  });
                }
              }
            }
          });
        }
      });
    });

    // Calculate end date
    const endDate = new Date(start);
    endDate.setDate(start.getDate() + 6);

    // Clean meal objects to remove undefined/null values for DynamoDB
    const cleanedMeals = meals.map(cleanMealObject);

    // Save to DynamoDB (keyed by household, not user)
    await docClient.send(new PutCommand({
      TableName: MEAL_PLANS_TABLE,
      Item: {
        PK: `HOUSEHOLD#${householdId}`,
        SK: `PLAN#${startDate}`,
        startDate,
        endDate: endDate.toISOString().split('T')[0],
        meals: cleanedMeals,
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
  } catch (err: any) {
    console.error('Error generating plan:', err);

    // Check for Spoonacular quota exceeded (402)
    if (err.message?.includes('402')) {
      return error(429, 'Daily recipe quota exceeded. Please try again tomorrow or switch to "My Preferences Only" mode in Household Settings.');
    }

    return error(500, 'Failed to generate meal plan');
  }
}
