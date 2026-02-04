import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Onboarding } from './pages/Onboarding';
import { MealPlan } from './pages/MealPlan';
import { MealAgent } from './pages/MealAgent';
import { HouseholdSettings } from './pages/HouseholdSettings';
import { useProfile } from './hooks/useProfile';

function AuthenticatedApp() {
  const { hasHousehold, loading } = useProfile();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to onboarding if no household
  if (!hasHousehold) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/onboarding/*" element={<Onboarding />} />
          <Route path="*" element={<Navigate to="/onboarding" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/meal-plan" element={<MealPlan />} />
          <Route path="/meal-agent" element={<MealAgent />} />
          <Route path="/household" element={<HouseholdSettings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <Authenticator
      signUpAttributes={['email']}
      components={{
        Header() {
          return (
            <div className="text-center py-8">
              <h1 className="text-3xl font-bold text-primary">🏠 HOH</h1>
              <p className="text-muted-foreground mt-2">Home Operations Hub</p>
            </div>
          );
        },
      }}
    >
      {() => (
        <AuthenticatedApp />
      )}
    </Authenticator>
  );
}
