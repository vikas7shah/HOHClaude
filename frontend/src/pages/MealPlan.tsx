import { useState, useEffect } from 'react';
import { RefreshCw, ChevronLeft, ChevronRight, ExternalLink, User, Sparkles, AlertCircle, Baby, Users, AlertTriangle, Shuffle, Pencil, X, Check, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { mealsApi, userApi, familyApi } from '../lib/api';
import { formatDate, getWeekStart, addDays } from '../lib/utils';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'];

interface FamilyMember {
  id: string;
  name: string;
  age?: number;
  dietaryRestrictions: string[];
  allergies: string[];
  sameAsAdults: boolean;
}

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
  forMembers?: string[];
  forMemberId?: string;
}

export function MealPlan() {
  const [weekStart, setWeekStart] = useState(() => getWeekStart());
  const [planStartDate, setPlanStartDate] = useState<string | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [currentPreferenceMode, setCurrentPreferenceMode] = useState<string | null>(null);
  const [planGeneratedMode, setPlanGeneratedMode] = useState<string | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);

  // Swap/Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [customMealName, setCustomMealName] = useState('');
  const [isSwapping, setIsSwapping] = useState(false);
  const [isSavingCustom, setIsSavingCustom] = useState(false);

  // Error state
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadPlan = async () => {
    setLoading(true);
    try {
      const data = await mealsApi.getPlan(formatDate(weekStart));
      setMeals(data.plan?.meals || []);
      setPlanGeneratedMode(data.plan?.mealSuggestionMode || null);
      setPlanStartDate(data.plan?.startDate || formatDate(weekStart));
    } catch (err) {
      console.error('Failed to load meal plan:', err);
      setMeals([]);
      setPlanGeneratedMode(null);
      setPlanStartDate(null);
    } finally {
      setLoading(false);
    }
  };

  const loadPreferences = async () => {
    try {
      const data = await userApi.getPreferences();
      setCurrentPreferenceMode(data.preferences?.mealSuggestionMode || 'ai_and_user');
    } catch (err) {
      console.error('Failed to load preferences:', err);
    }
  };

  const loadFamilyMembers = async () => {
    try {
      const data = await familyApi.getFamily();
      setFamilyMembers(data.members || []);
    } catch (err) {
      console.error('Failed to load family members:', err);
    }
  };

  useEffect(() => {
    loadPlan();
    loadPreferences();
    loadFamilyMembers();
  }, [weekStart]);

  // Check if preferences have changed since the plan was generated
  const preferencesChanged = currentPreferenceMode && planGeneratedMode && currentPreferenceMode !== planGeneratedMode;

  const generatePlan = async () => {
    setGenerating(true);
    setErrorMessage(null);
    try {
      const startDate = formatDate(weekStart);
      const data = await mealsApi.generatePlan(startDate);
      setMeals(data.meals || []);
      setPlanGeneratedMode(data.mealSuggestionMode || currentPreferenceMode);
      setPlanStartDate(startDate);
    } catch (err: any) {
      console.error('Failed to generate meal plan:', err);
      setErrorMessage(err.message || 'Failed to generate meal plan. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  // Handle swapping a meal with a new AI suggestion
  const handleSwapMeal = async () => {
    if (!selectedMeal || !planStartDate) return;

    setIsSwapping(true);
    try {
      const result = await mealsApi.updateMeal({
        startDate: planStartDate,
        date: selectedMeal.date,
        mealType: selectedMeal.mealType,
        action: 'swap',
        forMemberId: selectedMeal.forMemberId,
      });

      // Update the meals list with the new meal
      setMeals(prevMeals =>
        prevMeals.map(m =>
          m.date === selectedMeal.date &&
          m.mealType === selectedMeal.mealType &&
          m.forMemberId === selectedMeal.forMemberId
            ? result.meal
            : m
        )
      );

      // Update selected meal to show the new one
      setSelectedMeal(result.meal);
    } catch (err) {
      console.error('Failed to swap meal:', err);
    } finally {
      setIsSwapping(false);
    }
  };

  // Handle saving a custom meal name
  const handleSaveCustomMeal = async () => {
    if (!selectedMeal || !planStartDate || !customMealName.trim()) return;

    setIsSavingCustom(true);
    try {
      const result = await mealsApi.updateMeal({
        startDate: planStartDate,
        date: selectedMeal.date,
        mealType: selectedMeal.mealType,
        action: 'custom',
        customMealName: customMealName.trim(),
        forMemberId: selectedMeal.forMemberId,
      });

      // Update the meals list with the custom meal
      setMeals(prevMeals =>
        prevMeals.map(m =>
          m.date === selectedMeal.date &&
          m.mealType === selectedMeal.mealType &&
          m.forMemberId === selectedMeal.forMemberId
            ? result.meal
            : m
        )
      );

      // Update selected meal and exit edit mode
      setSelectedMeal(result.meal);
      setIsEditing(false);
      setCustomMealName('');
    } catch (err) {
      console.error('Failed to save custom meal:', err);
    } finally {
      setIsSavingCustom(false);
    }
  };

  // Reset edit state when modal closes
  const handleCloseModal = () => {
    setSelectedMeal(null);
    setIsEditing(false);
    setCustomMealName('');
  };

  const getModeLabel = (mode: string) => {
    switch (mode) {
      case 'user_preference': return 'My Preferences Only';
      case 'ai_suggest': return 'AI Suggestions';
      case 'ai_and_user': return 'Mix of Both';
      default: return mode;
    }
  };

  const getMeals = (dayIndex: number, mealType: string): Meal[] => {
    const date = formatDate(addDays(weekStart, dayIndex));
    return meals.filter(m => m.date === date && m.mealType === mealType);
  };

  // Check if there are any members with different meals
  const hasDifferentMeals = familyMembers.some(m => m.sameAsAdults === false);

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

      {/* Error Banner */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-red-800">Unable to generate meal plan</p>
              <p className="text-sm text-red-700 mt-1">{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="p-1 hover:bg-red-100 rounded-full transition-colors"
            >
              <X className="h-4 w-4 text-red-600" />
            </button>
          </div>
        </div>
      )}

      {/* Preferences Changed Banner */}
      {preferencesChanged && meals.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-amber-800">Your preferences have changed</p>
              <p className="text-sm text-amber-700">
                This plan was generated using "{getModeLabel(planGeneratedMode!)}" but you've switched to "{getModeLabel(currentPreferenceMode!)}".
              </p>
            </div>
          </div>
          <Button onClick={generatePlan} disabled={generating} size="sm" className="flex-shrink-0 gap-2">
            <RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
            Regenerate
          </Button>
        </div>
      )}

      {/* Family Members Summary */}
      {familyMembers.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Planning meals for {familyMembers.length + 1} people
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-3">
              {/* Household Adults (you) */}
              <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 rounded-lg border">
                <User className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">You</span>
              </div>

              {/* Family Members */}
              {familyMembers.map((member) => (
                <div
                  key={member.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                    member.sameAsAdults === false
                      ? 'bg-purple-50 border-purple-200'
                      : 'bg-muted/50'
                  }`}
                >
                  <Baby className={`h-4 w-4 ${member.sameAsAdults === false ? 'text-purple-500' : 'text-muted-foreground'}`} />
                  <span className="text-sm font-medium">
                    {member.name}
                    {member.age !== undefined && (
                      <span className="text-xs text-muted-foreground ml-1">({member.age}y)</span>
                    )}
                  </span>
                  {member.sameAsAdults === false && (
                    <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                      ★ Different meals
                    </span>
                  )}
                  {member.allergies.length > 0 && (
                    <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded flex items-center gap-0.5">
                      <AlertTriangle className="h-3 w-3" />
                      {member.allergies.length}
                    </span>
                  )}
                  {member.dietaryRestrictions.length > 0 && (
                    <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                      {member.dietaryRestrictions.length} restriction{member.dietaryRestrictions.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Show dietary notes if any member has restrictions */}
            {familyMembers.some(m => m.dietaryRestrictions.length > 0 || m.allergies.length > 0) && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>
                    Meal plans consider dietary restrictions and allergies for all family members.
                    {familyMembers.filter(m => m.allergies.length > 0).map(m => (
                      <span key={m.id} className="block mt-1">
                        <strong>{m.name}</strong>: Allergic to {m.allergies.join(', ')}
                      </span>
                    ))}
                  </span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
                      const dayMeals = getMeals(dayIndex, mealType);
                      const date = addDays(weekStart, dayIndex);
                      const isToday = formatDate(date) === formatDate(new Date());
                      return (
                        <td
                          key={dayIndex}
                          className={`p-2 border-l ${isToday ? 'bg-primary/5' : ''}`}
                        >
                          {dayMeals.length > 0 ? (
                            <div className="space-y-2">
                              {dayMeals.map((meal, mealIdx) => {
                                const isUserMeal = meal.isUserMeal || meal.source === 'user_preference';
                                const isKidMeal = meal.forMemberId != null;
                                return (
                                  <button
                                    key={mealIdx}
                                    onClick={() => setSelectedMeal(meal)}
                                    className={`w-full text-left p-2 rounded-md hover:bg-accent transition-colors ${
                                      isUserMeal ? 'border-2 border-dashed border-primary/30' : ''
                                    } ${isKidMeal ? 'border-2 border-purple-200 bg-purple-50/50' : ''}`}
                                  >
                                    {/* Show who this meal is for */}
                                    {meal.forMembers && hasDifferentMeals && (
                                      <div className="mb-1">
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                          isKidMeal
                                            ? 'bg-purple-100 text-purple-700'
                                            : 'bg-green-100 text-green-700'
                                        }`}>
                                          {meal.forMembers.length === 1
                                            ? meal.forMembers[0]
                                            : meal.forMembers.includes('Adults')
                                              ? `Adults${meal.forMembers.length > 1 ? ` +${meal.forMembers.length - 1}` : ''}`
                                              : meal.forMembers.join(', ')
                                          }
                                        </span>
                                      </div>
                                    )}
                                    {meal.recipeImage ? (
                                      <img
                                        src={meal.recipeImage}
                                        alt={meal.recipeName}
                                        className={`w-full object-cover rounded mb-2 ${
                                          dayMeals.length > 1 ? 'h-14' : 'h-20'
                                        }`}
                                      />
                                    ) : (
                                      <div className={`w-full bg-gradient-to-br from-primary/10 to-primary/5 rounded mb-2 flex items-center justify-center ${
                                        dayMeals.length > 1 ? 'h-14' : 'h-20'
                                      }`}>
                                        <User className={`text-primary/40 ${dayMeals.length > 1 ? 'h-6 w-6' : 'h-8 w-8'}`} />
                                      </div>
                                    )}
                                    <p className={`font-medium line-clamp-2 ${
                                      dayMeals.length > 1 ? 'text-xs' : 'text-sm'
                                    }`}>{meal.recipeName}</p>
                                    {meal.readyInMinutes ? (
                                      <p className="text-xs text-muted-foreground">{meal.readyInMinutes} min</p>
                                    ) : isUserMeal && !isKidMeal ? (
                                      <p className="text-xs text-primary/60 flex items-center gap-1">
                                        <User className="h-3 w-3" /> Your meal
                                      </p>
                                    ) : null}
                                  </button>
                                );
                              })}
                            </div>
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
          onClick={handleCloseModal}
        >
          <Card className="max-w-md w-full" onClick={e => e.stopPropagation()}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedMeal.isUserMeal || selectedMeal.source === 'user_preference' ? (
                    <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full flex items-center gap-1">
                      <User className="h-3 w-3" /> Your Preference
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> AI Suggested
                    </span>
                  )}
                  {selectedMeal.forMembers && (
                    <span className={`px-2 py-1 text-xs rounded-full flex items-center gap-1 ${
                      selectedMeal.forMemberId
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      <Users className="h-3 w-3" />
                      {selectedMeal.forMembers.join(', ')}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleCloseModal}
                  className="p-1 hover:bg-muted rounded-full transition-colors"
                >
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              {isEditing ? (
                <div className="mt-3 flex gap-2">
                  <Input
                    value={customMealName}
                    onChange={(e) => setCustomMealName(e.target.value)}
                    placeholder="Enter your meal name..."
                    className="flex-1"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveCustomMeal}
                    disabled={!customMealName.trim() || isSavingCustom}
                  >
                    {isSavingCustom ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsEditing(false);
                      setCustomMealName('');
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <CardTitle className="mt-2">{selectedMeal.recipeName}</CardTitle>
              )}
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

              {/* Swap & Edit Actions */}
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-muted-foreground mb-3">Don't like this meal?</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={handleSwapMeal}
                    disabled={isSwapping}
                  >
                    {isSwapping ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Shuffle className="h-4 w-4" />
                    )}
                    {isSwapping ? 'Finding...' : 'Swap for Another'}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={() => {
                      setIsEditing(true);
                      setCustomMealName(selectedMeal.recipeName);
                    }}
                    disabled={isEditing}
                  >
                    <Pencil className="h-4 w-4" />
                    Enter My Own
                  </Button>
                </div>
              </div>

              {selectedMeal.isUserMeal && !isEditing && (
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                  This is one of your typical meals. You can search for recipes online or use your own favorite recipe!
                </p>
              )}

              <div className="flex gap-2 border-t pt-4">
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
                <Button variant="ghost" onClick={handleCloseModal}>
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
