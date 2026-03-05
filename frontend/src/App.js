import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { usePostHog } from '@posthog/react';

import Dashboard from "@/pages/Dashboard";
import NewCase from "@/pages/NewCase";
import CaseDetail from "@/pages/CaseDetail";
import PlanningWizard from "@/pages/PlanningWizard";
import Checklists from "@/pages/Checklists";
import ProstheticChecklist from "@/pages/ProstheticChecklist";
import LearningLoop from "@/pages/LearningLoop";
import Login from "@/pages/Login";
import SetupProfile from "@/pages/SetupProfile";
import SetupTeam from "@/pages/SetupTeam";
import Profile from "@/pages/Profile";
import ClinicSettings from "@/pages/ClinicSettings";
import TeamManagement from "@/pages/TeamManagement";
import ProtectedRoute from "@/components/ProtectedRoute";
import OnboardingRoute from "@/components/OnboardingRoute";

import { trackPageView } from "@/lib/analytics";

/* ---------------- Route Tracking Wrapper ---------------- */

function AnalyticsRouterWrapper({ handleAuthenticated }) {
  const location = useLocation();
  const posthog = usePostHog();

  useEffect(() => {
    trackPageView(location.pathname);
  }, [location]);

  useEffect(() => {
    const sessionId =
      localStorage.getItem("session_id") ||
      crypto.randomUUID();

    localStorage.setItem("session_id", sessionId);
    
    if (posthog) {
      posthog.identify(sessionId);
      posthog.capture("session_started");
    }
  }, [posthog]);

  return (
    <Routes>
      <Route path="/login" element={<Login onAuthenticated={handleAuthenticated} />} />
      
      {/* Onboarding Routes */}
      <Route path="/setup-profile" element={<OnboardingRoute><SetupProfile /></OnboardingRoute>} />
      <Route path="/setup-team" element={<OnboardingRoute><SetupTeam /></OnboardingRoute>} />
      
      {/* Protected Routes */}
      <Route path="/" element={<OnboardingRoute><ProtectedRoute><Dashboard /></ProtectedRoute></OnboardingRoute>} />
      <Route path="/profile" element={<OnboardingRoute><ProtectedRoute><Profile /></ProtectedRoute></OnboardingRoute>} />
      <Route path="/clinic-settings" element={<OnboardingRoute><ProtectedRoute><ClinicSettings /></ProtectedRoute></OnboardingRoute>} />
      <Route path="/team" element={<OnboardingRoute><ProtectedRoute><TeamManagement /></ProtectedRoute></OnboardingRoute>} />
      <Route path="/case/new" element={<OnboardingRoute><ProtectedRoute><NewCase /></ProtectedRoute></OnboardingRoute>} />
      <Route path="/case/:id" element={<OnboardingRoute><ProtectedRoute><CaseDetail /></ProtectedRoute></OnboardingRoute>} />
      <Route path="/case/:id/planning" element={<OnboardingRoute><ProtectedRoute><PlanningWizard /></ProtectedRoute></OnboardingRoute>} />
      <Route path="/case/:id/checklists" element={<OnboardingRoute><ProtectedRoute><Checklists /></ProtectedRoute></OnboardingRoute>} />
      <Route path="/case/:id/prosthetic-checklist" element={<OnboardingRoute><ProtectedRoute><ProstheticChecklist /></ProtectedRoute></OnboardingRoute>} />
      <Route path="/case/:id/learning" element={<OnboardingRoute><ProtectedRoute><LearningLoop /></ProtectedRoute></OnboardingRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

/* ---------------- Main App ---------------- */

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const sessionData = localStorage.getItem('clinician_auth_session');
    if (sessionData) {
      try {
        const parsed = JSON.parse(sessionData);
        const { token } = parsed;
        
        if (token) {
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('clinician_auth_session');
          setIsAuthenticated(false);
        }
      } catch (error) {
        localStorage.removeItem('clinician_auth_session');
        setIsAuthenticated(false);
      }
    } else {
      setIsAuthenticated(false);
    }
    setIsLoading(false);
  }, []);

  const handleAuthenticated = (sessionData) => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('clinician_auth_session');
    setIsAuthenticated(false);
    window.location.href = '/login';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated && window.location.pathname !== '/login') {
    return (
      <div className="min-h-screen bg-background">
        <BrowserRouter>
          <Routes>
            <Route path="*" element={<Login onAuthenticated={handleAuthenticated} />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" richColors />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <BrowserRouter>
        <AnalyticsRouterWrapper handleAuthenticated={handleAuthenticated} />
      </BrowserRouter>

      <Toaster position="top-center" richColors />
    </div>
  );
}

export default App;
