import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Dashboard from "@/pages/Dashboard";
import NewCase from "@/pages/NewCase";
import CaseDetail from "@/pages/CaseDetail";
import PlanningWizard from "@/pages/PlanningWizard";
import Checklists from "@/pages/Checklists";
import ProstheticChecklist from "@/pages/ProstheticChecklist";
import LearningLoop from "@/pages/LearningLoop";

function App() {
  return (
    <div className="min-h-screen bg-background">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/case/new" element={<NewCase />} />
          <Route path="/case/:id" element={<CaseDetail />} />
          <Route path="/case/:id/planning" element={<PlanningWizard />} />
          <Route path="/case/:id/checklists" element={<Checklists />} />
          <Route path="/case/:id/prosthetic-checklist" element={<ProstheticChecklist />} />
          <Route path="/case/:id/learning" element={<LearningLoop />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-center" richColors />
    </div>
  );
}

export default App;
