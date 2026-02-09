import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";

import Dashboard from "@/pages/Dashboard";
import NewCase from "@/pages/NewCase";
import CaseDetail from "@/pages/CaseDetail";
import PlanningWizard from "@/pages/PlanningWizard";
import Checklists from "@/pages/Checklists";
import ProstheticChecklist from "@/pages/ProstheticChecklist";
import LearningLoop from "@/pages/LearningLoop";

import {
  initAnalytics,
  identifyUser,
  trackEvent,
  trackPageView
} from "@/lib/analytics";

/* ---------------- Route Tracking Wrapper ---------------- */

function AnalyticsRouterWrapper() {

  const location = useLocation();

  useEffect(() => {
    trackPageView(location.pathname);
  }, [location]);

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

/* ---------------- Main App ---------------- */

function App() {

  useEffect(() => {

    initAnalytics();

    const sessionId =
      localStorage.getItem("session_id") ||
      crypto.randomUUID();

    localStorage.setItem("session_id", sessionId);

    identifyUser(sessionId);

    trackEvent("session_started");

  }, []);

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
