import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
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

import { trackPageView } from "@/lib/analytics";

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
      <Route path="/" element={<Dashboard />} />
      <Route path="/case/new" element={<NewCase />} />
      <Route path="/case/:id" element={<CaseDetail />} />
      <Route path="/case/:id/planning" element={<PlanningWizard />} />
      <Route path="/case/:id/checklists" element={<Checklists />} />
      <Route path="/case/:id/prosthetic-checklist" element={<ProstheticChecklist />} />
      <Route path="/case/:id/learning" element={<LearningLoop />} />
    </Routes>
  );
}

function App() {
  const [authSession, setAuthSession] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem('clinician_auth_session');
    if (stored) {
      setAuthSession(JSON.parse(stored));
    }
  }, []);

  const handleAuthenticated = (session) => {
    setAuthSession(session);
    localStorage.setItem('clinician_auth_session', JSON.stringify(session));
  };

  if (!authSession?.token) {
    return (
      <>
        <Login onAuthenticated={handleAuthenticated} />
        <Toaster position="top-center" richColors />
      </>
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
