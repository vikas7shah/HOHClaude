import { fetchAuthSession } from 'aws-amplify/auth';
import { API_BASE_URL } from './aws-config';

async function getAuthHeaders() {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  };
}

async function apiRequest(method: string, path: string, body?: any) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

// User API
export const userApi = {
  getProfile: () => apiRequest('GET', '/users/profile'),
  saveProfile: (data: { displayName?: string }) => apiRequest('POST', '/users/profile', data),
  getPreferences: () => apiRequest('GET', '/users/preferences'),
  updatePreferences: (data: {
    cuisines?: string[];
    cookingTime?: 'quick' | 'medium' | 'elaborate';
    mealsToInclude?: string[];
    budget?: 'low' | 'medium' | 'high';
    typicalBreakfast?: string[];
    typicalLunch?: string[];
    typicalDinner?: string[];
    typicalSnacks?: string[];
    mealSuggestionMode?: 'user_preference' | 'ai_suggest' | 'ai_and_user';
    additionalPreferences?: string;
  }) => apiRequest('PUT', '/users/preferences', data),
};

// Household API
export const householdApi = {
  get: () => apiRequest('GET', '/household'),
  create: (data: { name: string }) => apiRequest('POST', '/household', data),
  leave: () => apiRequest('DELETE', '/household'),
  invite: (data: { email: string }) => apiRequest('POST', '/household/invite', data),
  getInvites: () => apiRequest('GET', '/household/invites'),
  acceptInvite: (data: { householdId: string }) => apiRequest('POST', '/household/accept', data),
};

// Family API
export const familyApi = {
  getFamily: () => apiRequest('GET', '/family'),
  addMember: (data: {
    name: string;
    age?: number;
    dietaryRestrictions?: string[];
    allergies?: string[];
    likes?: string[];
    dislikes?: string[];
    sameAsAdults?: boolean;
  }) => apiRequest('POST', '/family', data),
  deleteMember: (memberId: string) => apiRequest('DELETE', `/family/${memberId}`),
};

// Meals API
export const mealsApi = {
  generatePlan: (startDate: string) => apiRequest('POST', '/meals/generate', { startDate }),
  getPlan: (startDate?: string) => 
    apiRequest('GET', startDate ? `/meals/plan?startDate=${startDate}` : '/meals/plan'),
};
