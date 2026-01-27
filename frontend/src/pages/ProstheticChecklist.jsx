import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronRight, CheckCircle2, Circle, FlaskConical, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const PHASE_COLORS = {
  phase1: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100' },
  phase2: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100' },
  phase3: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-100' },
  phase4: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100' },
};

export default function ProstheticChecklist() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [checklist, setChecklist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedPhases, setExpandedPhases] = useState({
    phase1: true,
    phase2: true,
    phase3: true,
    phase4: true,
  });
  const [expandedSections, setExpandedSections] = useState({});

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      // Load case data
      const caseResponse = await axios.get(`${BACKEND_URL}/api/cases/${id}`);
      setCaseData(caseResponse.data);

      // Load prosthetic checklist
      const checklistResponse = await axios.get(`${BACKEND_URL}/api/cases/${id}/prosthetic-checklist`);
      setChecklist(checklistResponse.data.prostheticChecklist);
      
      // Initialize all sections as expanded
      const sectionsState = {};
      Object.keys(checklistResponse.data.prostheticChecklist).forEach(phaseKey => {
        checklistResponse.data.prostheticChecklist[phaseKey].sections.forEach((_, sectionIndex) => {
          sectionsState[`${phaseKey}-${sectionIndex}`] = true;
        });
      });
      setExpandedSections(sectionsState);
    } catch (error) {
      toast.error('Failed to load checklist');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const togglePhase = (phaseKey) => {
    setExpandedPhases(prev => ({ ...prev, [phaseKey]: !prev[phaseKey] }));
  };

  const toggleSection = (phaseKey, sectionIndex) => {
    const key = `${phaseKey}-${sectionIndex}`;
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleItem = async (phaseKey, sectionIndex, itemIndex) => {
    const updatedChecklist = { ...checklist };
    const item = updatedChecklist[phaseKey].sections[sectionIndex].items[itemIndex];
    item.completed = !item.completed;
    item.completedAt = item.completed ? new Date().toISOString() : null;
    
    setChecklist(updatedChecklist);
    await saveChecklist(updatedChecklist);
  };

  const saveChecklist = async (updatedChecklist) => {
    setSaving(true);
    try {
      await axios.put(`${BACKEND_URL}/api/cases/${id}/prosthetic-checklist`, updatedChecklist);
      toast.success('Progress saved');
    } catch (error) {
      toast.error('Failed to save');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const calculateProgress = (phase) => {
    if (!phase) return { completed: 0, total: 0, percentage: 0 };
    
    let completed = 0;
    let total = 0;
    
    phase.sections.forEach(section => {
      section.items.forEach(item => {
        total++;
        if (item.completed) completed++;
      });
    });
    
    return {
      completed,
      total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  };

  const calculateOverallProgress = () => {
    if (!checklist) return { completed: 0, total: 0, percentage: 0 };
    
    let completed = 0;
    let total = 0;
    
    Object.values(checklist).forEach(phase => {
      phase.sections.forEach(section => {
        section.items.forEach(item => {
          total++;
          if (item.completed) completed++;
        });
      });
    });
    
    return {
      completed,
      total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading checklist...</div>
      </div>
    );
  }

  const overallProgress = calculateOverallProgress();

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="glass-header sticky top-0 z-40 px-4 py-4 border-b">
        <div className="page-container">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => navigate(`/case/${id}`)}
              className="p-2 -ml-2 hover:bg-slate-100 rounded-lg touch-target"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-semibold text-foreground">Prosthetic Checklist</h1>
              <p className="text-sm text-muted-foreground">{caseData?.caseName}</p>
            </div>
            {saving && (
              <div className="text-sm text-muted-foreground animate-pulse">Saving...</div>
            )}
          </div>
          
          {/* Overall Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Overall Progress</span>
              <span className="text-muted-foreground">
                {overallProgress.completed} / {overallProgress.total} items
              </span>
            </div>
            <Progress value={overallProgress.percentage} className="h-3" />
            <p className="text-xs text-muted-foreground text-center">
              {overallProgress.percentage}% Complete
            </p>
          </div>
        </div>
      </header>

      <main className="page-container py-6 space-y-4">
        {checklist && Object.keys(checklist).map((phaseKey) => {
          const phase = checklist[phaseKey];
          const progress = calculateProgress(phase);
          const colors = PHASE_COLORS[phaseKey];
          const isExpanded = expandedPhases[phaseKey];

          return (
            <div key={phaseKey} className={`rounded-lg border-2 ${colors.border} overflow-hidden`}>
              {/* Phase Header */}
              <button
                onClick={() => togglePhase(phaseKey)}
                className={`w-full p-4 ${colors.bg} flex items-center justify-between touch-target`}
              >
                <div className="flex items-center gap-3 flex-1 text-left">
                  <div className={`p-2 rounded-lg bg-white shadow-sm`}>
                    {isExpanded ? (
                      <ChevronDown className={`h-5 w-5 ${colors.text}`} />
                    ) : (
                      <ChevronRight className={`h-5 w-5 ${colors.text}`} />
                    )}
                  </div>
                  <div className="flex-1">
                    <h2 className={`font-bold text-lg ${colors.text}`}>{phase.title}</h2>
                    <p className="text-sm text-slate-600">{phase.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`px-3 py-1 rounded-full ${colors.badge} text-sm font-semibold ${colors.text}`}>
                    {progress.percentage}%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {progress.completed}/{progress.total}
                  </div>
                </div>
              </button>

              {/* Phase Content */}
              {isExpanded && (
                <div className="bg-white">
                  {phase.sections.map((section, sectionIndex) => {
                    const sectionKey = `${phaseKey}-${sectionIndex}`;
                    const isSectionExpanded = expandedSections[sectionKey];
                    const completedItems = section.items.filter(item => item.completed).length;

                    return (
                      <div key={sectionIndex} className="border-t border-slate-200">
                        {/* Section Header */}
                        <button
                          onClick={() => toggleSection(phaseKey, sectionIndex)}
                          className={`w-full p-4 flex items-center justify-between hover:bg-slate-50 ${
                            section.isLabSection ? 'bg-green-50/50' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-1 text-left">
                            {section.isLabSection && (
                              <FlaskConical className="h-5 w-5 text-green-600 shrink-0" />
                            )}
                            <h3 className={`font-semibold ${section.isLabSection ? 'text-green-700' : 'text-slate-700'}`}>
                              {section.isLabSection && '🏥 '}
                              {section.title}
                            </h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {completedItems}/{section.items.length}
                            </span>
                            {isSectionExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </button>

                        {/* Section Items */}
                        {isSectionExpanded && (
                          <div className={`px-4 pb-4 ${section.isLabSection ? 'bg-green-50/30' : ''}`}>
                            {section.items.map((item, itemIndex) => (
                              <div
                                key={item.id}
                                className={`flex items-start gap-3 py-3 border-b border-slate-100 last:border-0 ${
                                  item.completed ? 'opacity-60' : ''
                                }`}
                              >
                                <button
                                  onClick={() => toggleItem(phaseKey, sectionIndex, itemIndex)}
                                  className="shrink-0 pt-0.5 touch-target"
                                >
                                  {item.completed ? (
                                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                  ) : (
                                    <Circle className="h-5 w-5 text-slate-300" />
                                  )}
                                </button>
                                <div className="flex-1">
                                  <p className={`text-sm ${item.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                    {item.text}
                                  </p>
                                  {item.completedAt && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Completed: {new Date(item.completedAt).toLocaleString()}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </main>

      {/* Disclaimer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-border">
        <div className="page-container">
          <p className="text-xs text-center text-muted-foreground">
            Workflow tracking only. Clinical judgment lies with the practitioner.
          </p>
        </div>
      </div>
    </div>
  );
}
