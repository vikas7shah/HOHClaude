import { useState, useEffect } from 'react';
import { RefreshCw, ChevronLeft, ChevronRight, ExternalLink, User, Sparkles } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { mealsApi } from '../lib/api';
import { formatDate, getWeekStart, addDays } from '../lib/utils';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'];

interface Meal {
  date: string;
  day: string;
  mealType: string;
  recipeId: string;
  recipeName: string;
  recipeImage: string | null;
  readyInMinutes: number | null;
  servings: number | null;
  sourceUrl: string | null;
  source?: 'user_preference' | 'ai_suggest';
  isUserMeal?: boolean;
}

export function MealPlan() {
  const [weekStart, setWeekStart] = useState(() => getWeekStart());
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);

  const loadPlan = async () => {
    setLoading(true);
    try {
      const data = await mealsApi.getPlan(formatDate(weekStart));
      setMeals(data.plan?.meals || []);
    } catch (err) {
      console.error('Failed to load meal plan:', err);
      setMeals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlan();
  }, [weekStart]);

  const generatePlan = async () => {
    setGenerating(true);
    try {
      const data = await mealsApi.generatePlan(formatDate(weekStart));
      setMeals(data.meals || []);
    } catch (err) {
      console.error('Failed to generate meal plan:', err);
    } finally {
      setGenerating(false);
    }
  };

  const getMeal = (dayIndex: number, mealType: string): Meal | undefined => {
    const date = formatDate(addDays(weekStart, dayIndex));
    return meals.find(m => m.date === date && m.mealType === mealType);
  };

  const prevWeek = () => setWeekStart(addDays(weekStart, -7));
  const nextWeek = () => setWeekStart(addDays(weekStart, 7));
  const thisWeek = () => setWeekStart(getWeekStart());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Meal Plan</h1>
          <p className="text-muted-foreground">
            Week of {weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={thisWeek}>Today</Button>
          <Button variant="outline" size="sm" onClick={prevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={nextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button onClick={generatePlan} disabled={generating} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
            {meals.length > 0 ? 'Regenerate' : 'Generate Plan'}
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : meals.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground mb-4">No meal plan for this week.</p>
              <Button onClick={generatePlan} disabled={generating}>Generate Meal Plan</Button>
            </div>
          ) : (
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b">
                  <th className="p-3 text-left text-sm font-medium text-muted-foreground w-24"></th>
                  {DAYS.map((day, i) => {
                    const date = addDays(weekStart, i);
                    const isToday = formatDate(date) === formatDate(new Date());
                    return (
                      <th key={day} className={`p-3 text-center border-l ${isToday ? 'bg-primary/5' : ''}`}>
                        <div className="text-sm font-medium">{day}</div>
                        <div className={`text-xs ${isToday ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                          {date.getDate()}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {MEAL_TYPES.map(mealType => (
                  <tr key={mealType} className="border-b last:border-b-0">
                    <td className="p-3 text-sm font-medium capitalize text-muted-foreground">
                      {mealType}
                    </td>
                    {DAYS.map((_, dayIndex) => {
                      const meal = getMeal(dayIndex, mealType);
                      const date = addDays(weekStart, dayIndex);
                      const isToday = formatDate(date) === formatDate(new Date());
                      const isUserMeal = meal?.isUserMeal || meal?.source === 'user_preference';
                      return (
                        <td
                          key={dayIndex}
                          className={`p-2 border-l ${isToday ? 'bg-primary/5' : ''}`}
                        >
                          {meal ? (
                            <button
                              onClick={() => setSelectedMeal(meal)}
                              className={`w-full text-left p-2 rounded-md hover:bg-accent transition-colors ${
                                isUserMeal ? 'border-2 border-dashed border-primary/30' : ''
                              }`}
                            >
                              {meal.recipeImage ? (
                                <img
                                  src={meal.recipeImage}
                                  alt={meal.recipeName}
                                  className="w-full h-20 object-cover rounded mb-2"
                                />
                              ) : (
                                <div className="w-full h-20 bg-gradient-to-br from-primary/10 to-primary/5 rounded mb-2 flex items-center justify-center">
                                  <User className="h-8 w-8 text-primary/40" />
                                </div>
                              )}
                              <p className="text-sm font-medium line-clamp-2">{meal.recipeName}</p>
                              {meal.readyInMinutes ? (
                                <p className="text-xs text-muted-foreground">{meal.readyInMinutes} min</p>
                              ) : isUserMeal ? (
                                <p className="text-xs text-primary/60 flex items-center gap-1">
                                  <User className="h-3 w-3" /> Your meal
                                </p>
                              ) : null}
                            </button>
                          ) : (
                            <div className="h-28 flex items-center justify-center text-muted-foreground text-xs">
                              —
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Recipe Detail Modal */}
      {selectedMeal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedMeal(null)}
        >
          <Card className="max-w-md w-full" onClick={e => e.stopPropagation()}>
            <CardHeader>
              <div className="flex items-center gap-2">
                {selectedMeal.isUserMeal || selectedMeal.source === 'user_preference' ? (
                  <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full flex items-center gap-1">
                    <User className="h-3 w-3" /> Your Preference
                  </span>
                ) : (
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> AI Suggested
                  </span>
                )}
              </div>
              <CardTitle className="mt-2">{selectedMeal.recipeName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedMeal.recipeImage ? (
                <img
                  src={selectedMeal.recipeImage}
                  alt={selectedMeal.recipeName}
                  className="w-full h-48 object-cover rounded-lg"
                />
              ) : (
                <div className="w-full h-48 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <User className="h-16 w-16 text-primary/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Your saved meal</p>
                  </div>
                </div>
              )}

              {(selectedMeal.readyInMinutes || selectedMeal.servings) && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {selectedMeal.readyInMinutes && (
                    <div>
                      <p className="text-muted-foreground">Cook Time</p>
                      <p className="font-medium">{selectedMeal.readyInMinutes} minutes</p>
                    </div>
                  )}
                  {selectedMeal.servings && (
                    <div>
                      <p className="text-muted-foreground">Servings</p>
                      <p className="font-medium">{selectedMeal.servings}</p>
                    </div>
                  )}
                </div>
              )}

              {selectedMeal.isUserMeal && (
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                  This is one of your typical meals. You can search for recipes online or use your own favorite recipe!
                </p>
              )}

              <div className="flex gap-2">
                {selectedMeal.sourceUrl && (
                  <a
                    href={selectedMeal.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1"
                  >
                    <Button variant="outline" className="w-full gap-2">
                      <ExternalLink className="h-4 w-4" />
                      View Recipe
                    </Button>
                  </a>
                )}
                <Button variant="ghost" onClick={() => setSelectedMeal(null)}>
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
