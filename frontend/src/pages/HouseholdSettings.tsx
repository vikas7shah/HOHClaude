import { useState, useEffect } from 'react';
import { Users, UserPlus, LogOut, Mail, Crown, User, Trash2, Settings, Sparkles, UserCog, Wand2, Save, Clock, FileText, Baby, AlertTriangle } from 'lucide-react';
// Note: useNavigate removed as it was unused
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { householdApi, userApi, familyApi } from '../lib/api';
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
  cookingTime: 'quick' | 'medium' | 'elaborate';
  additionalPreferences: string;
}

interface FamilyMember {
  id: string;
  name: string;
  age?: number;
  dietaryRestrictions: string[];
  allergies: string[];
  sameAsAdults: boolean;
  mealPreferences?: {
    breakfast: string[];
    lunch: string[];
    dinner: string[];
  };
}

const COOKING_TIME_OPTIONS = [
  {
    value: 'quick',
    label: 'Quick (~15 mins)',
    description: 'Fast and easy meals',
  },
  {
    value: 'medium',
    label: 'Medium (~30 mins)',
    description: 'Moderate cooking time',
  },
  {
    value: 'elaborate',
    label: 'Elaborate (60+ mins)',
    description: 'More involved recipes',
  },
];

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
    cookingTime: 'medium',
    additionalPreferences: '',
  });
  const [breakfastInput, setBreakfastInput] = useState('');
  const [lunchInput, setLunchInput] = useState('');
  const [dinnerInput, setDinnerInput] = useState('');
  const [snacksInput, setSnacksInput] = useState('');
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);

  // Family members state
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberAge, setNewMemberAge] = useState('');
  const [newMemberRestrictions, setNewMemberRestrictions] = useState('');
  const [newMemberAllergies, setNewMemberAllergies] = useState('');
  const [newMemberSameAsAdults, setNewMemberSameAsAdults] = useState(true);
  const [newMemberMealTab, setNewMemberMealTab] = useState<'breakfast' | 'lunch' | 'dinner'>('breakfast');
  const [newMemberBreakfast, setNewMemberBreakfast] = useState<string[]>([]);
  const [newMemberLunch, setNewMemberLunch] = useState<string[]>([]);
  const [newMemberDinner, setNewMemberDinner] = useState<string[]>([]);
  const [newMemberMealInput, setNewMemberMealInput] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    async function loadData() {
      try {
        const [householdData, prefsData, familyData] = await Promise.all([
          householdApi.get(),
          userApi.getPreferences(),
          familyApi.getFamily(),
        ]);
        setHousehold(householdData.household);
        setFamilyMembers(familyData.members || []);
        if (prefsData.preferences) {
          setPreferences({
            typicalBreakfast: prefsData.preferences.typicalBreakfast || [],
            typicalLunch: prefsData.preferences.typicalLunch || [],
            typicalDinner: prefsData.preferences.typicalDinner || [],
            typicalSnacks: prefsData.preferences.typicalSnacks || [],
            mealSuggestionMode: prefsData.preferences.mealSuggestionMode || 'ai_and_user',
            cookingTime: prefsData.preferences.cookingTime || 'medium',
            additionalPreferences: prefsData.preferences.additionalPreferences || '',
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

  const handleAddMember = async () => {
    if (!newMemberName.trim()) return;
    setAddingMember(true);
    try {
      const restrictions = newMemberRestrictions.split(',').map(s => s.trim()).filter(Boolean);
      const allergies = newMemberAllergies.split(',').map(s => s.trim()).filter(Boolean);
      const age = newMemberAge ? parseInt(newMemberAge, 10) : undefined;
      const mealPreferences = !newMemberSameAsAdults ? {
        breakfast: newMemberBreakfast,
        lunch: newMemberLunch,
        dinner: newMemberDinner,
      } : undefined;

      const result = await familyApi.addMember({
        name: newMemberName.trim(),
        age,
        dietaryRestrictions: restrictions,
        allergies: allergies,
        sameAsAdults: newMemberSameAsAdults,
        mealPreferences,
      });
      setFamilyMembers(prev => [...prev, result.member]);
      setNewMemberName('');
      setNewMemberAge('');
      setNewMemberRestrictions('');
      setNewMemberAllergies('');
      setNewMemberSameAsAdults(true);
      setNewMemberBreakfast([]);
      setNewMemberLunch([]);
      setNewMemberDinner([]);
      setNewMemberMealInput('');
      setNewMemberMealTab('breakfast');
      setShowAddMember(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add family member');
    } finally {
      setAddingMember(false);
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    setDeletingMemberId(memberId);
    try {
      await familyApi.deleteMember(memberId);
      setFamilyMembers(prev => prev.filter(m => m.id !== memberId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete family member');
    } finally {
      setDeletingMemberId(null);
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

      {/* Family Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Baby className="h-5 w-5" />
            Family Members
          </CardTitle>
          <CardDescription>
            Add family members (like kids or toddlers) who may have different meal preferences.
            Their dietary restrictions and allergies will be considered when generating meal plans.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {familyMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No family members added yet. Add family members who have different dietary needs.
            </p>
          ) : (
            <div className="space-y-3">
              {familyMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-start justify-between p-4 rounded-lg border bg-muted/30"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Baby className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {member.name}
                        {member.age !== undefined && (
                          <span className="text-sm text-muted-foreground ml-2">
                            ({member.age} {member.age === 1 ? 'year' : 'years'} old)
                          </span>
                        )}
                      </p>
                      {member.dietaryRestrictions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {member.dietaryRestrictions.map((r) => (
                            <span key={r} className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                              {r}
                            </span>
                          ))}
                        </div>
                      )}
                      {member.allergies.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {member.allergies.map((a) => (
                            <span key={a} className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {a}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="mt-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          member.sameAsAdults
                            ? 'bg-green-100 text-green-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}>
                          {member.sameAsAdults ? '✓ Same meals as adults' : '★ Different meals'}
                        </span>
                      </div>
                      {/* Show meal preferences for members with different meals */}
                      {!member.sameAsAdults && member.mealPreferences && (
                        <div className="mt-2 space-y-1 text-xs">
                          {member.mealPreferences.breakfast?.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="font-medium text-orange-600">Breakfast:</span>
                              {member.mealPreferences.breakfast.map(item => (
                                <span key={item} className="px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded">{item}</span>
                              ))}
                            </div>
                          )}
                          {member.mealPreferences.lunch?.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="font-medium text-green-600">Lunch:</span>
                              {member.mealPreferences.lunch.map(item => (
                                <span key={item} className="px-1.5 py-0.5 bg-green-50 text-green-600 rounded">{item}</span>
                              ))}
                            </div>
                          )}
                          {member.mealPreferences.dinner?.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="font-medium text-blue-600">Dinner:</span>
                              {member.mealPreferences.dinner.map(item => (
                                <span key={item} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">{item}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteMember(member.id)}
                    disabled={deletingMemberId === member.id}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    {deletingMemberId === member.id ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {showAddMember ? (
            <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name *</label>
                  <Input
                    placeholder="e.g., Emma, Baby Jake"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Age</label>
                  <Input
                    type="number"
                    min="0"
                    max="120"
                    placeholder="e.g., 2"
                    value={newMemberAge}
                    onChange={(e) => setNewMemberAge(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Age helps us recommend appropriate food</p>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Dietary Restrictions</label>
                <Input
                  placeholder="e.g., vegetarian, no spicy food (comma-separated)"
                  value={newMemberRestrictions}
                  onChange={(e) => setNewMemberRestrictions(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Allergies</label>
                <Input
                  placeholder="e.g., peanuts, dairy (comma-separated)"
                  value={newMemberAllergies}
                  onChange={(e) => setNewMemberAllergies(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Meal Preference</label>
                <button
                  type="button"
                  onClick={() => setNewMemberSameAsAdults(!newMemberSameAsAdults)}
                  className={`w-full p-4 rounded-lg border text-left transition-colors flex items-center justify-between ${
                    newMemberSameAsAdults
                      ? 'bg-green-50 border-green-300'
                      : 'bg-purple-50 border-purple-300'
                  }`}
                >
                  <div>
                    <p className="font-medium">
                      {newMemberSameAsAdults ? 'Eats same food as adults' : 'Needs different meals'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {newMemberSameAsAdults
                        ? 'Will share the same meals as everyone else'
                        : 'Will have separate, age-appropriate meals in the plan'}
                    </p>
                  </div>
                  <div className={`h-6 w-11 rounded-full transition-colors ${
                    newMemberSameAsAdults ? 'bg-green-500' : 'bg-purple-500'
                  } relative`}>
                    <div className={`h-5 w-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                      newMemberSameAsAdults ? 'left-0.5' : 'left-5'
                    }`} />
                  </div>
                </button>
              </div>

              {/* Meal preferences for members with different meals */}
              {!newMemberSameAsAdults && (
                <div className="space-y-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-sm font-medium text-purple-800">
                    What does {newMemberName || 'this member'} typically eat?
                  </p>

                  {/* Tabs */}
                  <div className="flex gap-1 bg-purple-100 p-1 rounded-lg">
                    {(['breakfast', 'lunch', 'dinner'] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setNewMemberMealTab(tab)}
                        className={`flex-1 px-3 py-2 rounded-md text-sm font-medium capitalize transition-colors ${
                          newMemberMealTab === tab
                            ? 'bg-white text-purple-700 shadow-sm'
                            : 'text-purple-600 hover:text-purple-800'
                        }`}
                      >
                        {tab}
                        {(tab === 'breakfast' ? newMemberBreakfast : tab === 'lunch' ? newMemberLunch : newMemberDinner).length > 0 && (
                          <span className="ml-1 text-xs">({(tab === 'breakfast' ? newMemberBreakfast : tab === 'lunch' ? newMemberLunch : newMemberDinner).length})</span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Input for current tab */}
                  <div className="flex gap-2">
                    <Input
                      placeholder={`e.g., ${newMemberMealTab === 'breakfast' ? 'cereal, fruit, toast' : newMemberMealTab === 'lunch' ? 'mac and cheese, sandwiches' : 'pasta, chicken nuggets'}`}
                      value={newMemberMealInput}
                      onChange={(e) => setNewMemberMealInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newMemberMealInput.trim()) {
                          e.preventDefault();
                          const items = newMemberMealInput.split(',').map(v => v.trim()).filter(Boolean);
                          if (newMemberMealTab === 'breakfast') {
                            setNewMemberBreakfast(prev => [...new Set([...prev, ...items])]);
                          } else if (newMemberMealTab === 'lunch') {
                            setNewMemberLunch(prev => [...new Set([...prev, ...items])]);
                          } else {
                            setNewMemberDinner(prev => [...new Set([...prev, ...items])]);
                          }
                          setNewMemberMealInput('');
                        }
                      }}
                      className="flex-1 bg-white"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (newMemberMealInput.trim()) {
                          const items = newMemberMealInput.split(',').map(v => v.trim()).filter(Boolean);
                          if (newMemberMealTab === 'breakfast') {
                            setNewMemberBreakfast(prev => [...new Set([...prev, ...items])]);
                          } else if (newMemberMealTab === 'lunch') {
                            setNewMemberLunch(prev => [...new Set([...prev, ...items])]);
                          } else {
                            setNewMemberDinner(prev => [...new Set([...prev, ...items])]);
                          }
                          setNewMemberMealInput('');
                        }
                      }}
                      className="bg-white"
                    >
                      Add
                    </Button>
                  </div>

                  {/* Tags for current tab */}
                  {(newMemberMealTab === 'breakfast' ? newMemberBreakfast : newMemberMealTab === 'lunch' ? newMemberLunch : newMemberDinner).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {(newMemberMealTab === 'breakfast' ? newMemberBreakfast : newMemberMealTab === 'lunch' ? newMemberLunch : newMemberDinner).map((item) => (
                        <span
                          key={item}
                          className={`px-3 py-1 rounded-full text-sm flex items-center gap-1 ${
                            newMemberMealTab === 'breakfast' ? 'bg-orange-100 text-orange-700' :
                            newMemberMealTab === 'lunch' ? 'bg-green-100 text-green-700' :
                            'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {item}
                          <button
                            type="button"
                            onClick={() => {
                              if (newMemberMealTab === 'breakfast') {
                                setNewMemberBreakfast(prev => prev.filter(i => i !== item));
                              } else if (newMemberMealTab === 'lunch') {
                                setNewMemberLunch(prev => prev.filter(i => i !== item));
                              } else {
                                setNewMemberDinner(prev => prev.filter(i => i !== item));
                              }
                            }}
                            className="hover:opacity-70"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-purple-600">
                    These preferences help us suggest appropriate meals or use them directly in "My Preferences Only" mode.
                  </p>
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddMember(false);
                    setNewMemberName('');
                    setNewMemberAge('');
                    setNewMemberRestrictions('');
                    setNewMemberAllergies('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddMember}
                  disabled={!newMemberName.trim() || addingMember}
                >
                  {addingMember ? 'Adding...' : 'Add Member'}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowAddMember(true)} className="w-full">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Family Member
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Family Meal Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Family Meal Preferences
          </CardTitle>
          <CardDescription>
            Tell us what the family typically eats so we can personalize your meal plans.
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

      {/* Cooking Time Preference */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Preferred Cooking Time
          </CardTitle>
          <CardDescription>
            How much time do you typically want to spend cooking?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {COOKING_TIME_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setPreferences(prev => ({ ...prev, cookingTime: option.value as any }))}
              className={`w-full p-4 rounded-lg border text-left transition-colors flex items-center justify-between ${
                preferences.cookingTime === option.value
                  ? 'bg-primary/5 border-primary'
                  : 'hover:bg-accent'
              }`}
            >
              <div>
                <p className="font-medium">{option.label}</p>
                <p className="text-sm text-muted-foreground">{option.description}</p>
              </div>
              {preferences.cookingTime === option.value && (
                <div className="h-4 w-4 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Additional Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Additional Preferences
          </CardTitle>
          <CardDescription>
            Any other preferences or notes we should consider when recommending meals?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <textarea
            value={preferences.additionalPreferences}
            onChange={(e) => setPreferences(prev => ({ ...prev, additionalPreferences: e.target.value }))}
            placeholder="e.g., We prefer low-sodium meals, try to include more vegetables, we like spicy food, avoid processed foods..."
            className="w-full min-h-[120px] p-3 rounded-lg border bg-background text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
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
