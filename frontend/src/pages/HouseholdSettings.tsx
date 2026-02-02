import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserPlus, LogOut, Mail, Crown, User, Trash2, Settings, Sparkles, UserCog, Wand2, Save } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { householdApi, userApi } from '../lib/api';
import { useProfile } from '../hooks/useProfile';

interface HouseholdUser {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'member';
  isCurrentUser: boolean;
}

interface HouseholdData {
  id: string;
  name: string;
  createdAt: string;
  users: HouseholdUser[];
}

interface Preferences {
  typicalBreakfast: string[];
  typicalLunch: string[];
  typicalDinner: string[];
  typicalSnacks: string[];
  mealSuggestionMode: 'user_preference' | 'ai_suggest' | 'ai_and_user';
}

const SUGGESTION_MODES = [
  {
    value: 'user_preference',
    label: 'My Preferences Only',
    description: 'Generate meals based only on what I typically eat',
    icon: UserCog,
  },
  {
    value: 'ai_suggest',
    label: 'AI Suggestions',
    description: 'Let AI suggest new and varied meals for me',
    icon: Sparkles,
  },
  {
    value: 'ai_and_user',
    label: 'Mix of Both',
    description: 'Combine my preferences with AI suggestions',
    icon: Wand2,
  },
];

export function HouseholdSettings() {
  const navigate = useNavigate();
  const { profile, refetch } = useProfile();
  const [household, setHousehold] = useState<HouseholdData | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // Preferences state
  const [preferences, setPreferences] = useState<Preferences>({
    typicalBreakfast: [],
    typicalLunch: [],
    typicalDinner: [],
    typicalSnacks: [],
    mealSuggestionMode: 'ai_and_user',
  });
  const [breakfastInput, setBreakfastInput] = useState('');
  const [lunchInput, setLunchInput] = useState('');
  const [dinnerInput, setDinnerInput] = useState('');
  const [snacksInput, setSnacksInput] = useState('');
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    async function loadData() {
      try {
        const [householdData, prefsData] = await Promise.all([
          householdApi.get(),
          userApi.getPreferences(),
        ]);
        setHousehold(householdData.household);
        if (prefsData.preferences) {
          setPreferences({
            typicalBreakfast: prefsData.preferences.typicalBreakfast || [],
            typicalLunch: prefsData.preferences.typicalLunch || [],
            typicalDinner: prefsData.preferences.typicalDinner || [],
            typicalSnacks: prefsData.preferences.typicalSnacks || [],
            mealSuggestionMode: prefsData.preferences.mealSuggestionMode || 'ai_and_user',
          });
        }
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(null);
    try {
      await householdApi.invite({ email: inviteEmail.trim() });
      setInviteSuccess(`Invite sent to ${inviteEmail}`);
      setInviteEmail('');
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  };

  const handleLeave = async () => {
    setLeaving(true);
    try {
      await householdApi.leave();
      await refetch();
      window.location.href = '/';
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to leave household');
      setLeaving(false);
      setShowLeaveConfirm(false);
    }
  };

  const addMealItem = (type: keyof Pick<Preferences, 'typicalBreakfast' | 'typicalLunch' | 'typicalDinner' | 'typicalSnacks'>, value: string) => {
    if (!value.trim()) return;
    const items = value.split(',').map(v => v.trim()).filter(Boolean);
    setPreferences(prev => ({
      ...prev,
      [type]: [...new Set([...prev[type], ...items])],
    }));
  };

  const removeMealItem = (type: keyof Pick<Preferences, 'typicalBreakfast' | 'typicalLunch' | 'typicalDinner' | 'typicalSnacks'>, item: string) => {
    setPreferences(prev => ({
      ...prev,
      [type]: prev[type].filter(i => i !== item),
    }));
  };

  const handleSavePreferences = async () => {
    setSavingPrefs(true);
    setPrefsSaved(false);
    try {
      await userApi.updatePreferences(preferences);
      setPrefsSaved(true);
      setTimeout(() => setPrefsSaved(false), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save preferences');
    } finally {
      setSavingPrefs(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!household) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">No household found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Household Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your household members and meal preferences.
        </p>
      </div>

      {/* Household Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {household.name}
          </CardTitle>
          <CardDescription>
            {household.users.length} member{household.users.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {household.users.map((user) => (
              <div
                key={user.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  user.isCurrentUser ? 'bg-primary/5 border-primary/20' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    {user.role === 'admin' ? (
                      <Crown className="h-4 w-4 text-amber-500" />
                    ) : (
                      <User className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">
                      {user.displayName || user.email.split('@')[0]}
                      {user.isCurrentUser && (
                        <span className="text-muted-foreground text-sm ml-2">(you)</span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    user.role === 'admin'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {user.role}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Meal Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Meal Preferences
          </CardTitle>
          <CardDescription>
            Tell us what you typically eat so we can personalize your meal plans.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Typical Breakfast */}
          <div className="space-y-2">
            <label className="text-sm font-medium">What do you typically eat for Breakfast?</label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g., eggs, oatmeal, toast (comma-separated)"
                value={breakfastInput}
                onChange={(e) => setBreakfastInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    addMealItem('typicalBreakfast', breakfastInput);
                    setBreakfastInput('');
                  }
                }}
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={() => {
                  addMealItem('typicalBreakfast', breakfastInput);
                  setBreakfastInput('');
                }}
              >
                Add
              </Button>
            </div>
            {preferences.typicalBreakfast.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {preferences.typicalBreakfast.map((item) => (
                  <span
                    key={item}
                    className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm flex items-center gap-1"
                  >
                    {item}
                    <button
                      onClick={() => removeMealItem('typicalBreakfast', item)}
                      className="hover:text-orange-900"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Typical Lunch */}
          <div className="space-y-2">
            <label className="text-sm font-medium">What do you typically eat for Lunch?</label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g., salad, sandwich, soup (comma-separated)"
                value={lunchInput}
                onChange={(e) => setLunchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    addMealItem('typicalLunch', lunchInput);
                    setLunchInput('');
                  }
                }}
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={() => {
                  addMealItem('typicalLunch', lunchInput);
                  setLunchInput('');
                }}
              >
                Add
              </Button>
            </div>
            {preferences.typicalLunch.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {preferences.typicalLunch.map((item) => (
                  <span
                    key={item}
                    className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm flex items-center gap-1"
                  >
                    {item}
                    <button
                      onClick={() => removeMealItem('typicalLunch', item)}
                      className="hover:text-green-900"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Typical Dinner */}
          <div className="space-y-2">
            <label className="text-sm font-medium">What do you typically eat for Dinner?</label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g., pasta, chicken, stir fry (comma-separated)"
                value={dinnerInput}
                onChange={(e) => setDinnerInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    addMealItem('typicalDinner', dinnerInput);
                    setDinnerInput('');
                  }
                }}
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={() => {
                  addMealItem('typicalDinner', dinnerInput);
                  setDinnerInput('');
                }}
              >
                Add
              </Button>
            </div>
            {preferences.typicalDinner.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {preferences.typicalDinner.map((item) => (
                  <span
                    key={item}
                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm flex items-center gap-1"
                  >
                    {item}
                    <button
                      onClick={() => removeMealItem('typicalDinner', item)}
                      className="hover:text-blue-900"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Typical Snacks */}
          <div className="space-y-2">
            <label className="text-sm font-medium">What do you typically eat for Snacks?</label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g., fruits, nuts, yogurt (comma-separated)"
                value={snacksInput}
                onChange={(e) => setSnacksInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    addMealItem('typicalSnacks', snacksInput);
                    setSnacksInput('');
                  }
                }}
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={() => {
                  addMealItem('typicalSnacks', snacksInput);
                  setSnacksInput('');
                }}
              >
                Add
              </Button>
            </div>
            {preferences.typicalSnacks.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {preferences.typicalSnacks.map((item) => (
                  <span
                    key={item}
                    className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm flex items-center gap-1"
                  >
                    {item}
                    <button
                      onClick={() => removeMealItem('typicalSnacks', item)}
                      className="hover:text-purple-900"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Meal Suggestion Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            How should we generate your meals?
          </CardTitle>
          <CardDescription>
            Choose how you'd like your meal plans to be created.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {SUGGESTION_MODES.map((mode) => {
            const Icon = mode.icon;
            return (
              <button
                key={mode.value}
                onClick={() => setPreferences(prev => ({ ...prev, mealSuggestionMode: mode.value as any }))}
                className={`w-full p-4 rounded-lg border text-left transition-colors flex items-start gap-4 ${
                  preferences.mealSuggestionMode === mode.value
                    ? 'bg-primary/5 border-primary'
                    : 'hover:bg-accent'
                }`}
              >
                <div className={`p-2 rounded-lg ${
                  preferences.mealSuggestionMode === mode.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">{mode.label}</p>
                  <p className="text-sm text-muted-foreground">{mode.description}</p>
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {/* Save Preferences Button */}
      <div className="flex justify-end gap-3">
        {prefsSaved && (
          <p className="text-sm text-green-600 flex items-center gap-2 self-center">
            ✓ Preferences saved!
          </p>
        )}
        <Button onClick={handleSavePreferences} disabled={savingPrefs}>
          <Save className="h-4 w-4 mr-2" />
          {savingPrefs ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>

      {/* Invite Members (Admin only) */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Invite Family Members
            </CardTitle>
            <CardDescription>
              Send an invite to add someone to your household.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Input
                placeholder="Email address"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleInvite} disabled={!inviteEmail.trim() || inviting}>
                <Mail className="h-4 w-4 mr-2" />
                {inviting ? 'Sending...' : 'Send Invite'}
              </Button>
            </div>
            {inviteSuccess && (
              <p className="text-sm text-green-600 flex items-center gap-2">
                ✓ {inviteSuccess}
              </p>
            )}
            {inviteError && (
              <p className="text-sm text-destructive">{inviteError}</p>
            )}
            <p className="text-sm text-muted-foreground">
              They'll see the invite when they sign up or log in to HOH.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Leave Household */}
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <LogOut className="h-5 w-5" />
            Leave Household
          </CardTitle>
          <CardDescription>
            Leave this household. You can join or create a new one after.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showLeaveConfirm ? (
            <div className="space-y-4">
              <p className="text-sm">
                Are you sure? {isAdmin && household.users.length > 1 && (
                  <span className="text-destructive font-medium">
                    You're the admin. You'll need to promote someone else first, or be the last one to leave.
                  </span>
                )}
              </p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowLeaveConfirm(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleLeave} disabled={leaving}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {leaving ? 'Leaving...' : 'Yes, Leave'}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowLeaveConfirm(true)}>
              Leave Household
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
