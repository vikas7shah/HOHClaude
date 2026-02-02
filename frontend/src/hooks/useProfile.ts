import { useState, useEffect, useCallback } from 'react';
import { userApi } from '../lib/api';

interface Profile {
  email: string;
  displayName: string | null;
  householdId: string | null;
  role: 'admin' | 'member' | null;
}

interface Household {
  id: string;
  name: string;
}

interface ProfileState {
  profile: Profile | null;
  household: Household | null;
  hasHousehold: boolean;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useProfile(): ProfileState {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [hasHousehold, setHasHousehold] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await userApi.getProfile();
      setProfile(data.profile || null);
      setHousehold(data.household || null);
      setHasHousehold(data.hasHousehold || false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, household, hasHousehold, loading, error, refetch: fetchProfile };
}
