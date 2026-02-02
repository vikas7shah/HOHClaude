import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserPlus, LogOut, Mail, Crown, User, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { householdApi } from '../lib/api';
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

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    async function loadHousehold() {
      try {
        const data = await householdApi.get();
        setHousehold(data.household);
      } catch (err) {
        console.error('Failed to load household:', err);
      } finally {
        setLoading(false);
      }
    }
    loadHousehold();
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
          Manage your household members and settings.
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
