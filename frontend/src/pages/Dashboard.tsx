import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, ChefHat, Users, ShoppingCart, UserPlus, Sparkles, Clock, Heart, Zap } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { mealsApi, familyApi, householdApi } from '../lib/api';
import { useProfile } from '../hooks/useProfile';
import { getWeekStart, formatDate } from '../lib/utils';

const MOOD_OPTIONS = [
  { value: 'quick', label: 'Quick & Easy', icon: Zap, description: 'Under 30 minutes' },
  { value: 'comfort', label: 'Comfort Food', icon: Heart, description: 'Hearty & satisfying' },
  { value: 'healthy', label: 'Healthy', icon: Sparkles, description: 'Light & nutritious' },
  { value: 'elaborate', label: 'Something Special', icon: Clock, description: 'Worth the effort' },
];

export function Dashboard() {
  const navigate = useNavigate();
  const { profile, household } = useProfile();
  const [mealPlan, setMealPlan] = useState<any>(null);
  const [familyCount, setFamilyCount] = useState(0);
  const [userCount, setUserCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [planData, familyData, householdData] = await Promise.all([
          mealsApi.getPlan(),
          familyApi.getFamily(),
          householdApi.get(),
        ]);
        setMealPlan(planData.plan);
        setFamilyCount(familyData.members?.length || 0);
        setUserCount(householdData.household?.users?.length || 0);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleGeneratePlan = async () => {
    setGenerating(true);
    try {
      const startDate = formatDate(getWeekStart());
      const data = await mealsApi.generatePlan(startDate);
      setMealPlan({ meals: data.meals, startDate: data.startDate, endDate: data.endDate });
      setSelectedMood(null);
    } catch (err) {
      console.error('Failed to generate plan:', err);
    } finally {
      setGenerating(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const todayMeals = mealPlan?.meals?.filter((m: any) => m.date === today) || [];

  const isAdmin = profile?.role === 'admin';

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-3xl font-bold">
          Welcome back{household?.name ? `, ${household.name}` : ''}! 👋
        </h1>
        <p className="text-muted-foreground mt-2">
          Here's what's happening in your home today.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Household Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userCount}</div>
            <p className="text-xs text-muted-foreground">
              {isAdmin ? (
                <Link to="/household" className="text-primary hover:underline">
                  Manage users
                </Link>
              ) : (
                'People with access'
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Family Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{familyCount}</div>
            <p className="text-xs text-muted-foreground">Dietary profiles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Meal Plan</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mealPlan ? '✓ Active' : 'None'}
            </div>
            {mealPlan && (
              <p className="text-xs text-muted-foreground">
                {mealPlan.startDate} to {mealPlan.endDate}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Today's Meals</CardTitle>
            <ChefHat className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayMeals.length}</div>
            <p className="text-xs text-muted-foreground">Planned for today</p>
          </CardContent>
        </Card>
      </div>

      {/* Today's Meals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChefHat className="h-5 w-5" />
            Today's Menu
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : todayMeals.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-3">
              {todayMeals.map((meal: any, index: number) => (
                <div key={index} className="flex gap-3 p-3 rounded-lg border">
                  {meal.recipeImage && (
                    <img
                      src={meal.recipeImage}
                      alt={meal.recipeName}
                      className="w-16 h-16 rounded object-cover"
                    />
                  )}
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">
                      {meal.mealType}
                    </p>
                    <p className="font-medium">{meal.recipeName}</p>
                    <p className="text-xs text-muted-foreground">
                      {meal.readyInMinutes} min
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                No meal plan for today. Generate one to get started!
              </p>
              <Link to="/meal-plan">
                <Button>Create Meal Plan</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link to="/meal-plan">
              <Button variant="outline" className="gap-2">
                <CalendarDays className="h-4 w-4" />
                View Meal Plan
              </Button>
            </Link>
            <Button variant="outline" className="gap-2" disabled>
              <ShoppingCart className="h-4 w-4" />
              Shopping List (coming soon)
            </Button>
            {isAdmin && (
              <Link to="/household">
                <Button variant="outline" className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Invite Family
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
