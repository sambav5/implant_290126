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
import ProtectedRoute from "@/components/ProtectedRoute";

import { trackPageView } from "@/lib/analytics";

/* ---------------- Route Tracking Wrapper ---------------- */

function AnalyticsRouterWrapper() {
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
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/case/new" element={<ProtectedRoute><NewCase /></ProtectedRoute>} />
      <Route path="/case/:id" element={<ProtectedRoute><CaseDetail /></ProtectedRoute>} />
      <Route path="/case/:id/planning" element={<ProtectedRoute><PlanningWizard /></ProtectedRoute>} />
      <Route path="/case/:id/checklists" element={<ProtectedRoute><Checklists /></ProtectedRoute>} />
      <Route path="/case/:id/prosthetic-checklist" element={<ProtectedRoute><ProstheticChecklist /></ProtectedRoute>} />
      <Route path="/case/:id/learning" element={<ProtectedRoute><LearningLoop /></ProtectedRoute>} />
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
        const { token, exp } = JSON.parse(sessionData);
        const currentTime = Math.floor(Date.now() / 1000);
        
        if (token && (!exp || exp > currentTime)) {
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
        <AnalyticsRouterWrapper />
      </BrowserRouter>

      <Toaster position="top-center" richColors />
    </div>
  );
}

export default App;
