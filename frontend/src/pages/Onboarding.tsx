import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Check, Plus, UserPlus, Mail } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { userApi, familyApi, householdApi } from '../lib/api';

const DIETARY_OPTIONS = [
  'Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Keto', 'Paleo', 'Halal', 'Kosher'
];

const CUISINE_OPTIONS = [
  'Italian', 'Mexican', 'Chinese', 'Indian', 'Japanese', 'Thai', 'Mediterranean', 'American', 'French'
];

interface Invite {
  householdId: string;
  householdName: string;
  invitedBy: string;
  invitedAt: string;
}

// Step 0: Choose to create or join
function StepChoose() {
  const navigate = useNavigate();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);

  useEffect(() => {
    async function loadInvites() {
      try {
        const data = await householdApi.getInvites();
        setInvites(data.invites || []);
      } catch (err) {
        console.error('Failed to load invites:', err);
      } finally {
        setLoading(false);
      }
    }
    loadInvites();
  }, []);

  const handleAcceptInvite = async (invite: Invite) => {
    setAccepting(invite.householdId);
    try {
      await householdApi.acceptInvite({ householdId: invite.householdId });
      // Refresh to load dashboard
      window.location.href = '/';
    } catch (err) {
      console.error('Failed to accept invite:', err);
      setAccepting(null);
    }
  };

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>Welcome to HOH! 🏠</CardTitle>
        <CardDescription>Let's get you set up with a household.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Pending Invites */}
        {loading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
          </div>
        ) : invites.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm font-medium flex items-center gap-2">
              <Mail className="h-4 w-4" />
              You have {invites.length} pending invite{invites.length > 1 ? 's' : ''}:
            </p>
            {invites.map((invite) => (
              <div
                key={invite.householdId}
                className="flex items-center justify-between p-4 rounded-lg border bg-accent/50"
              >
                <div>
                  <p className="font-medium">{invite.householdName}</p>
                  <p className="text-sm text-muted-foreground">
                    Invited by {invite.invitedBy}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleAcceptInvite(invite)}
                  disabled={accepting === invite.householdId}
                >
                  {accepting === invite.householdId ? 'Joining...' : 'Join'}
                </Button>
              </div>
            ))}
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or</span>
              </div>
            </div>
          </div>
        ) : null}

        {/* Create New Household */}
        <Button
          onClick={() => navigate('/onboarding/create')}
          className="w-full gap-2"
          size="lg"
        >
          <Plus className="h-4 w-4" />
          Create New Household
        </Button>

        {invites.length === 0 && (
          <p className="text-sm text-muted-foreground text-center">
            No invites yet? Create your own household and invite family members later.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Step 1: Create Household
function StepCreateHousehold() {
  const navigate = useNavigate();
  const [householdName, setHouseholdName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!householdName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await householdApi.create({ name: householdName.trim() });
      navigate('/onboarding/family');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create household');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>Create Your Household 🏡</CardTitle>
        <CardDescription>Give your household a name.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Input
          label="Household Name"
          placeholder="e.g., The Smith Family"
          value={householdName}
          onChange={(e) => setHouseholdName(e.target.value)}
        />
        
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <div className="flex gap-3">
          <Button onClick={() => navigate('/onboarding')} variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button 
            onClick={handleCreate} 
            disabled={!householdName.trim() || saving} 
            className="flex-1 gap-2"
          >
            {saving ? 'Creating...' : 'Create'} <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Step 2: Add Family Members
function StepFamily() {
  const navigate = useNavigate();
  const [members, setMembers] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [allergies, setAllergies] = useState('');
  const [sameAsAdults, setSameAsAdults] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load existing family members
  useEffect(() => {
    async function loadFamily() {
      try {
        const data = await familyApi.getFamily();
        setMembers(data.members || []);
      } catch (err) {
        console.error('Failed to load family:', err);
      }
    }
    loadFamily();
  }, []);

  const addMember = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const ageNum = age ? parseInt(age, 10) : undefined;
      const result = await familyApi.addMember({
        name: name.trim(),
        age: ageNum,
        dietaryRestrictions: restrictions,
        allergies: allergies.split(',').map(a => a.trim()).filter(Boolean),
        sameAsAdults: sameAsAdults,
      });
      setMembers([...members, result.member]);
      setName('');
      setAge('');
      setRestrictions([]);
      setAllergies('');
      setSameAsAdults(true);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const toggleRestriction = (r: string) => {
    setRestrictions(prev =>
      prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]
    );
  };

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>Who's in your household?</CardTitle>
        <CardDescription>
          Add family members and their dietary needs. You can add more later.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {members.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Added members:</p>
            <div className="flex flex-wrap gap-2">
              {members.map((m, i) => (
                <span key={i} className={`px-3 py-1 rounded-full text-sm ${
                  m.sameAsAdults === false
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-primary/10 text-primary'
                }`}>
                  {m.name}{m.age !== undefined && ` (${m.age}y)`}
                  {m.sameAsAdults === false && ' ★'}
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">★ = different meals</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Name"
            placeholder="e.g., Emma"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div>
            <Input
              label="Age"
              type="number"
              min="0"
              max="120"
              placeholder="e.g., 2"
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">Helps recommend appropriate food</p>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Dietary Restrictions</p>
          <div className="flex flex-wrap gap-2">
            {DIETARY_OPTIONS.map(opt => (
              <button
                key={opt}
                onClick={() => toggleRestriction(opt.toLowerCase())}
                className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                  restrictions.includes(opt.toLowerCase())
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-input hover:bg-accent'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <Input
          label="Allergies (comma-separated)"
          placeholder="e.g., peanuts, shellfish"
          value={allergies}
          onChange={(e) => setAllergies(e.target.value)}
        />

        <div>
          <p className="text-sm font-medium mb-2">Meal Preference</p>
          <button
            type="button"
            onClick={() => setSameAsAdults(!sameAsAdults)}
            className={`w-full p-4 rounded-lg border text-left transition-colors flex items-center justify-between ${
              sameAsAdults
                ? 'bg-green-50 border-green-300'
                : 'bg-purple-50 border-purple-300'
            }`}
          >
            <div>
              <p className="font-medium">
                {sameAsAdults ? 'Eats same food as adults' : 'Needs different meals'}
              </p>
              <p className="text-sm text-muted-foreground">
                {sameAsAdults
                  ? 'Will share the same meals as everyone'
                  : 'Will have separate, age-appropriate meals'}
              </p>
            </div>
            <div className={`h-6 w-11 rounded-full transition-colors ${
              sameAsAdults ? 'bg-green-500' : 'bg-purple-500'
            } relative`}>
              <div className={`h-5 w-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                sameAsAdults ? 'left-0.5' : 'left-5'
              }`} />
            </div>
          </button>
        </div>

        <Button onClick={addMember} disabled={!name.trim() || saving} variant="outline" className="w-full">
          <UserPlus className="h-4 w-4 mr-2" />
          Add Member
        </Button>

        <div className="flex gap-3">
          <Button onClick={() => navigate('/onboarding/create')} variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button
            onClick={() => navigate('/onboarding/preferences')}
            disabled={members.length === 0}
            className="flex-1 gap-2"
          >
            Next <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const MEAL_OPTIONS = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
];

// Step 3: Preferences
function StepPreferences() {
  const navigate = useNavigate();
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [cookingTime, setCookingTime] = useState<'quick' | 'medium' | 'elaborate'>('medium');
  const [mealsToInclude, setMealsToInclude] = useState<string[]>(['breakfast', 'lunch', 'dinner']);
  const [saving, setSaving] = useState(false);

  const toggleCuisine = (c: string) => {
    setCuisines(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    );
  };

  const toggleMeal = (meal: string) => {
    setMealsToInclude(prev =>
      prev.includes(meal) ? prev.filter(x => x !== meal) : [...prev, meal]
    );
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      await userApi.updatePreferences({
        cuisines,
        cookingTime,
        mealsToInclude,
      });
      // Refresh the page to re-check household status
      window.location.href = '/';
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>Your Preferences</CardTitle>
        <CardDescription>Help us personalize your meal plans.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <p className="text-sm font-medium mb-2">Favorite Cuisines</p>
          <div className="flex flex-wrap gap-2">
            {CUISINE_OPTIONS.map(opt => (
              <button
                key={opt}
                onClick={() => toggleCuisine(opt.toLowerCase())}
                className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                  cuisines.includes(opt.toLowerCase())
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-input hover:bg-accent'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Meals to Plan</p>
          <div className="flex gap-2">
            {MEAL_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => toggleMeal(opt.value)}
                className={`px-4 py-2 rounded-md text-sm border transition-colors flex-1 ${
                  mealsToInclude.includes(opt.value)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-input hover:bg-accent'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Select which meals you want planned</p>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Typical Cooking Time</p>
          <div className="flex gap-2">
            {[
              { value: 'quick', label: 'Quick (< 30 min)' },
              { value: 'medium', label: 'Medium (30-60 min)' },
              { value: 'elaborate', label: 'Elaborate (60+ min)' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setCookingTime(opt.value as any)}
                className={`px-4 py-2 rounded-md text-sm border transition-colors flex-1 ${
                  cookingTime === opt.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-input hover:bg-accent'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <Button onClick={() => navigate('/onboarding/family')} variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button onClick={handleFinish} disabled={saving || mealsToInclude.length === 0} className="flex-1 gap-2">
            <Check className="h-4 w-4" /> {saving ? 'Finishing...' : 'Finish Setup'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Progress indicator
function ProgressIndicator({ step }: { step: number }) {
  const steps = ['Setup', 'Family', 'Preferences'];
  return (
    <div className="flex justify-center gap-2 mb-8">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              i < step
                ? 'bg-primary text-primary-foreground'
                : i === step
                ? 'bg-primary/20 text-primary border-2 border-primary'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {i < step ? <Check className="h-4 w-4" /> : i + 1}
          </div>
          {i < steps.length - 1 && (
            <div className={`w-12 h-0.5 mx-1 ${i < step ? 'bg-primary' : 'bg-muted'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export function Onboarding() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b p-4">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <span className="text-2xl">🏠</span>
          <span className="font-bold text-xl">HOH</span>
        </div>
      </header>
      <main className="flex-1 flex flex-col justify-center p-4">
        <Routes>
          <Route path="/" element={
            <>
              <ProgressIndicator step={0} />
              <StepChoose />
            </>
          } />
          <Route path="/create" element={
            <>
              <ProgressIndicator step={0} />
              <StepCreateHousehold />
            </>
          } />
          <Route path="/family" element={
            <>
              <ProgressIndicator step={1} />
              <StepFamily />
            </>
          } />
          <Route path="/preferences" element={
            <>
              <ProgressIndicator step={2} />
              <StepPreferences />
            </>
          } />
          <Route path="*" element={<Navigate to="/onboarding" replace />} />
        </Routes>
      </main>
    </div>
  );
}
