const SPOONACULAR_BASE_URL = 'https://api.spoonacular.com';
const API_KEY = process.env.SPOONACULAR_API_KEY;

interface MealPlanRequest {
  timeFrame: 'day' | 'week';
  targetCalories?: number;
  diet?: string; // vegetarian, vegan, gluten-free, etc.
  exclude?: string; // comma-separated ingredients to exclude
}

interface SpoonacularMeal {
  id: number;
  title: string;
  readyInMinutes: number;
  servings: number;
  sourceUrl: string;
  image: string;
}

interface SpoonacularDayPlan {
  meals: SpoonacularMeal[];
  nutrients: {
    calories: number;
    protein: number;
    fat: number;
    carbohydrates: number;
  };
}

interface SpoonacularWeekPlan {
  week: {
    monday: SpoonacularDayPlan;
    tuesday: SpoonacularDayPlan;
    wednesday: SpoonacularDayPlan;
    thursday: SpoonacularDayPlan;
    friday: SpoonacularDayPlan;
    saturday: SpoonacularDayPlan;
    sunday: SpoonacularDayPlan;
  };
}

export async function generateMealPlan(options: MealPlanRequest): Promise<SpoonacularWeekPlan> {
  const params = new URLSearchParams({
    apiKey: API_KEY!,
    timeFrame: options.timeFrame,
  });

  if (options.targetCalories) {
    params.append('targetCalories', options.targetCalories.toString());
  }
  if (options.diet) {
    params.append('diet', options.diet);
  }
  if (options.exclude) {
    params.append('exclude', options.exclude);
  }

  const response = await fetch(`${SPOONACULAR_BASE_URL}/mealplanner/generate?${params}`);
  
  if (!response.ok) {
    throw new Error(`Spoonacular API error: ${response.status}`);
  }

  return response.json();
}

export async function getRecipeDetails(recipeId: number) {
  const params = new URLSearchParams({
    apiKey: API_KEY!,
  });

  const response = await fetch(`${SPOONACULAR_BASE_URL}/recipes/${recipeId}/information?${params}`);
  
  if (!response.ok) {
    throw new Error(`Spoonacular API error: ${response.status}`);
  }

  return response.json();
}

interface SearchRecipesOptions {
  query?: string;
  diet?: string;
  excludeIngredients?: string;
  number?: number;
  offset?: number;
  addRecipeInformation?: boolean;
  type?: string;
}

export async function searchRecipes(options: SearchRecipesOptions | string, diet?: string, excludeIngredients?: string) {
  // Support both old signature (query, diet, excludeIngredients) and new options object
  const opts: SearchRecipesOptions = typeof options === 'string'
    ? { query: options, diet, excludeIngredients }
    : options;

  const params = new URLSearchParams({
    apiKey: API_KEY!,
  });

  if (opts.query) params.append('query', opts.query);
  if (opts.diet) params.append('diet', opts.diet);
  if (opts.excludeIngredients) params.append('excludeIngredients', opts.excludeIngredients);
  if (opts.number) params.append('number', opts.number.toString());
  if (opts.offset) params.append('offset', opts.offset.toString());
  if (opts.addRecipeInformation) params.append('addRecipeInformation', 'true');
  if (opts.type) params.append('type', opts.type);

  // Default number if not specified
  if (!opts.number) params.append('number', '10');

  const response = await fetch(`${SPOONACULAR_BASE_URL}/recipes/complexSearch?${params}`);

  if (!response.ok) {
    throw new Error(`Spoonacular API error: ${response.status}`);
  }

  return response.json();
}

// Search for recipes based on user's typical meals with full recipe info
export async function searchRecipesWithInfo(
  query: string,
  options?: {
    diet?: string;
    excludeIngredients?: string;
    type?: 'breakfast' | 'main course' | 'snack';
    number?: number;
  }
): Promise<any[]> {
  const params = new URLSearchParams({
    apiKey: API_KEY!,
    query,
    number: (options?.number || 5).toString(),
    addRecipeInformation: 'true',
  });

  if (options?.diet) params.append('diet', options.diet);
  if (options?.excludeIngredients) params.append('excludeIngredients', options.excludeIngredients);
  if (options?.type) params.append('type', options.type);

  const response = await fetch(`${SPOONACULAR_BASE_URL}/recipes/complexSearch?${params}`);

  if (!response.ok) {
    throw new Error(`Spoonacular API error: ${response.status}`);
  }

  const data = await response.json();
  return data.results || [];
}

// Convert dietary restrictions to Spoonacular diet parameter
export function mapDietaryRestrictions(restrictions: string[]): string | undefined {
  const dietMap: Record<string, string> = {
    'vegetarian': 'vegetarian',
    'vegan': 'vegan',
    'gluten-free': 'gluten free',
    'dairy-free': 'dairy free',
    'keto': 'ketogenic',
    'paleo': 'paleo',
  };

  for (const restriction of restrictions) {
    const diet = dietMap[restriction.toLowerCase()];
    if (diet) return diet;
  }
  return undefined;
}

// Combine allergies into exclude string
export function mapAllergiesToExclude(allergies: string[]): string {
  return allergies.join(',');
}
