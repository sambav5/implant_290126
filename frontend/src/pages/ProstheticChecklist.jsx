import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Circle, FlaskConical, TrendingUp, Home, Lightbulb, Filter, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import axios from 'axios';
import { toast } from 'sonner';
import { trackTreatmentBlueprintCompleted } from '@/lib/analytics';
import { RoleSwitcher } from '@/components/RoleSwitcher';
import { RoleBadge } from '@/components/RoleBadge';
import { useActiveRole } from '@/hooks/useActiveRole';
import { canEditItem, getRoleName } from '@/utils/rolePermissions';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

// Phase mapping configuration - maps backend phases to UI tabs
const PHASE_MAPPING = {
  preparation: ['pre_surgical_planning'],
  placement: ['surgical_treatment'],
  review: ['maintenance']
};

const PHASE_CONFIG = [
  { id: 'preparation', label: 'Preparation', icon: '📋' },
  { id: 'placement', label: 'Placement', icon: '🦷' },
  { id: 'review', label: 'Follow-up', icon: '👁️' }
];

// Phase colors configuration
const PHASE_COLORS = {
  pre_surgical_planning: { bg: 'var(--blue-1)', border: 'var(--blue-b)', text: 'var(--blue)', badge: 'var(--blue-2)' },
  surgical_treatment: { bg: 'var(--red-1)', border: 'var(--red-b)', text: 'var(--red)', badge: 'var(--red-2)' },
  immediate_post_delivery: { bg: 'var(--orange-1)', border: 'var(--orange-b)', text: 'var(--orange)', badge: 'var(--orange-2)' },
  prosthetic_rehab: { bg: 'var(--purple-1)', border: 'var(--purple-b)', text: 'var(--purple)', badge: 'var(--purple-2)' },
  clinical_tryin: { bg: 'var(--purple-1)', border: 'var(--purple-b)', text: 'var(--purple)', badge: 'var(--purple-2)' },
  delivery: { bg: 'var(--green-1)', border: 'var(--green-b)', text: 'var(--green)', badge: 'var(--green-2)' },
  follow_up: { bg: 'var(--teal-1)', border: 'var(--teal-b)', text: 'var(--teal)', badge: 'var(--teal-2)' },
  maintenance: { bg: 'var(--teal-1)', border: 'var(--teal-b)', text: 'var(--teal)', badge: 'var(--teal-2)' }
};

const DEFAULT_PHASE_COLOR = { bg: 'var(--card)', border: 'var(--border)', text: 'var(--t1)', badge: 'var(--border)' };

export default function ProstheticChecklist() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [checklist, setChecklist] = useState(null);
  const [isDynamic, setIsDynamic] = useState(false);
  const [planningConditions, setPlanningConditions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showFullProtocol, setShowFullProtocol] = useState(() => {
    const saved = localStorage.getItem(`checklistScope_${id}`);
    return saved === 'full' ? true : false;
  });
  const [showMasterChecklist, setShowMasterChecklist] = useState(false);
  
  // Tab-based navigation
  const [activePhase, setActivePhase] = useState('preparation');
  const [completedPhases, setCompletedPhases] = useState({});
  const [showPhaseCompleteAnimation, setShowPhaseCompleteAnimation] = useState(null);
  const checklistRef = useRef(null);
  
  // Role-based collaboration state
  const [activeRole] = useActiveRole();
  const [showMyTasksOnly, setShowMyTasksOnly] = useState(false);
  
  // Phase and section expansion state
  const [expandedPhases, setExpandedPhases] = useState({});
  const [expandedSections, setExpandedSections] = useState({});

  // Persist toggle state to localStorage
  useEffect(() => {
    if (id) {
      localStorage.setItem(`checklistScope_${id}`, showFullProtocol ? 'full' : 'essential');
    }
  }, [showFullProtocol, id]);

  useEffect(() => {
    loadData();
  }, [id]);
  
  // Check phase completion whenever checklist changes
  useEffect(() => {
    if (checklist) {
      checkPhaseCompletion();
    }
  }, [checklist, showFullProtocol, showMyTasksOnly, activeRole]);

  const loadData = async () => {
    try {
      const caseResponse = await axios.get(`${BACKEND_URL}/api/cases/${id}`);
      setCaseData(caseResponse.data);

      const checklistResponse = await axios.get(`${BACKEND_URL}/api/cases/${id}/prosthetic-checklist`);
      setChecklist(checklistResponse.data.prostheticChecklist);
      setIsDynamic(checklistResponse.data.isDynamic || false);
      setPlanningConditions(checklistResponse.data.planningConditions || null);
    } catch (error) {
      toast.error('Failed to load checklist');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };
  
  // Get all backend phases for a UI phase
  const getBackendPhasesForUIPhase = (uiPhase) => {
    return PHASE_MAPPING[uiPhase] || [];
  };
  
  // Get all visible items for a UI phase
  const getVisibleItemsForPhase = (uiPhase) => {
    const backendPhases = getBackendPhasesForUIPhase(uiPhase);
    const items = [];
    
    backendPhases.forEach(backendPhase => {
      const phase = checklist[backendPhase];
      if (phase) {
        phase.sections.forEach(section => {
          section.items.forEach(item => {
            const isVisibleByScope = showFullProtocol || item.importance === 'essential';
            const itemRole = item.assignedRole || 'clinician';
            const isVisibleByRole = !showMyTasksOnly || itemRole === activeRole;
            
            if (isVisibleByScope && isVisibleByRole) {
              items.push({ ...item, phaseKey: backendPhase, section });
            }
          });
        });
      }
    });
    
    return items;
  };
  
  // Check if a phase is complete
  const isPhaseComplete = (uiPhase) => {
    const items = getVisibleItemsForPhase(uiPhase);
    if (items.length === 0) return true;
    return items.every(item => item.completed);
  };
  
  // Check completion of all phases
  const checkPhaseCompletion = () => {
    const completed = {};
    PHASE_CONFIG.forEach(phase => {
      completed[phase.id] = isPhaseComplete(phase.id);
    });
    setCompletedPhases(completed);
  };
  
  // Check if user is near bottom of page
  const isNearBottom = () => {
    if (!checklistRef.current) return false;
    const rect = checklistRef.current.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const distanceFromBottom = rect.bottom - windowHeight;
    return distanceFromBottom <= 120;
  };
  
  // Get next incomplete item in current phase
  const getNextIncompleteItem = (phaseId) => {
    const items = getVisibleItemsForPhase(phaseId);
    return items.find(item => !item.completed);
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
    
    // Toggle completion
    item.completed = !item.completed;
    item.completedAt = item.completed ? new Date().toISOString() : null;
    
    // Track who completed it
    if (item.completed) {
      item.completedByRole = activeRole;
      item.completedByName = getRoleName(caseData?.caseTeam, activeRole);
    } else {
      item.completedByRole = null;
      item.completedByName = null;
    }
    
    setChecklist(updatedChecklist);
    
    // Auto-save
    saveChecklist(updatedChecklist);
    
    // If item was just completed, check for next actions
    if (item.completed) {
      // Find next incomplete item in current phase
      const nextItem = getNextIncompleteItem(activePhase);
      
      if (nextItem) {
        // Scroll to next incomplete item
        setTimeout(() => {
          const element = document.getElementById(`item-${nextItem.id}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300);
      } else {
        // Phase is complete!
        // Show completion animation in tab
        setShowPhaseCompleteAnimation(activePhase);
        
        setTimeout(() => {
          setShowPhaseCompleteAnimation(null);
        }, 2000);
        
        // If user is near bottom, auto-advance to next phase
        if (isNearBottom()) {
          const currentIndex = PHASE_CONFIG.findIndex(p => p.id === activePhase);
          if (currentIndex < PHASE_CONFIG.length - 1) {
            setTimeout(() => {
              const nextPhase = PHASE_CONFIG[currentIndex + 1];
              setActivePhase(nextPhase.id);
              window.scrollTo({ top: 0, behavior: 'smooth' });
              toast.success(`${PHASE_CONFIG[currentIndex].label} complete! Moving to ${nextPhase.label}.`);
            }, 500);
          }
        }
      }
    }
  };

  const toggleSelectAllInSection = async (phaseKey, sectionIndex) => {
    const updatedChecklist = { ...checklist };
    const section = updatedChecklist[phaseKey].sections[sectionIndex];
    
    // Filter visible items based on showFullProtocol state
    const visibleItems = section.items.filter(item => showFullProtocol || item.importance === 'essential');
    
    // Filter editable items (only items the active role can edit)
    const editableItems = visibleItems.filter(item => {
      const itemRole = item.assignedRole || 'clinician';
      return canEditItem(itemRole, activeRole);
    });
    
    // If no editable items, show warning and return
    if (editableItems.length === 0) {
      toast.error('No items in this section are assigned to your role');
      return;
    }
    
    // Check if all editable items are completed
    const allCompleted = editableItems.every(item => item.completed);
    
    // Toggle only editable items
    editableItems.forEach(item => {
      item.completed = !allCompleted;
      item.completedAt = !allCompleted ? new Date().toISOString() : null;
      
      // Track who completed it
      if (!allCompleted) {
        item.completedByRole = activeRole;
        item.completedByName = getRoleName(caseData?.caseTeam, activeRole);
      } else {
        item.completedByRole = null;
        item.completedByName = null;
      }
    });
    
    setChecklist(updatedChecklist);
    await saveChecklist(updatedChecklist);
    
    const message = allCompleted 
      ? `Unchecked ${editableItems.length} items` 
      : `Checked ${editableItems.length} items`;
    toast.success(message);
  };

  const saveChecklist = async (updatedChecklist) => {
    setSaving(true);
    try {
      await axios.put(`${BACKEND_URL}/api/cases/${id}/prosthetic-checklist`, updatedChecklist);
      
      // Calculate progress and track if 100% complete
      const progress = calculateOverallProgress();
      if (progress.percentage === 100) {
        trackTreatmentBlueprintCompleted(id, {
          totalItems: progress.total,
          completedItems: progress.completed,
          percentage: progress.percentage
        });
      }
      
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
        // Only count visible items based on toggle state
        const isVisible = showFullProtocol || item.importance === 'essential';
        if (isVisible) {
          total++;
          if (item.completed) completed++;
        }
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
          // Only count visible items based on toggle state
          const isVisible = showFullProtocol || item.importance === 'essential';
          if (isVisible) {
            total++;
            if (item.completed) completed++;
          }
        });
      });
    });
    
    return {
      completed,
      total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  };

  const renderPhaseContent = () => {
    const backendPhases = getBackendPhasesForUIPhase(activePhase);
    
    return (
      <div className="space-y-4">
        {backendPhases.map(phaseKey => {
          const phase = checklist[phaseKey];
          if (!phase) return null;
          
          return (
            <div key={phaseKey}>
              {phase.sections.map((section, sectionIndex) => {
                // Filter visible items
                const visibleItems = section.items.filter(item => {
                  const isVisibleByScope = showFullProtocol || item.importance === 'essential';
                  const itemRole = item.assignedRole || 'clinician';
                  const isVisibleByRole = !showMyTasksOnly || itemRole === activeRole;
                  return isVisibleByScope && isVisibleByRole;
                });
                
                if (visibleItems.length === 0) return null;
                
                return (
                  <div key={sectionIndex} className="mb-6">
                    {/* Section Header */}
                    <div className="mb-3">
                      <h3 className="text-base font-semibold flex items-center gap-2" style={{color: 'var(--t1)'}}>
                        {section.isLabSection && <FlaskConical className="h-4 w-4" style={{color: 'var(--green)'}} />}
                        {section.title}
                      </h3>
                    </div>
                    
                    {/* Items */}
                    <div className="space-y-2">
                      {visibleItems.map(item => {
                        const itemRole = item.assignedRole || 'clinician';
                        const canEdit = canEditItem(itemRole, activeRole);
                        
                        return (
                          <div
                            key={item.id}
                            id={`item-${item.id}`}
                            className="flex items-start gap-3 p-3 rounded-lg transition-all"
                            style={{
                              background: item.completed ? 'var(--card)' : 'var(--card)',
                              border: '1px solid var(--border)',
                              opacity: item.completed ? 0.6 : 1
                            }}
                          >
                            <button
                              onClick={() => canEdit && toggleItem(phaseKey, sectionIndex, section.items.indexOf(item))}
                              className="shrink-0 pt-0.5"
                              disabled={!canEdit}
                            >
                              {item.completed ? (
                                <CheckCircle2 className="h-5 w-5" style={{color: 'var(--green)'}} />
                              ) : (
                                <Circle className="h-5 w-5" style={{color: 'var(--border2)'}} />
                              )}
                            </button>
                            
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm ${item.completed ? 'line-through' : ''}`} style={{color: item.completed ? 'var(--t3)' : 'var(--t1)'}}>
                                {item.text}
                              </p>
                              
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <RoleBadge role={itemRole} />
                                
                                {item.importance === 'essential' && (
                                  <span className="px-2 py-0.5 rounded mono" style={{background: 'var(--green-1)', color: 'var(--green)', fontSize: '9px', textTransform: 'uppercase'}}>
                                    Essential
                                  </span>
                                )}
                                
                                {item.completedAt && (
                                  <span className="text-xs mono" style={{color: 'var(--t3)'}}>
                                    {item.completedByName && `by ${item.completedByName}`}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Separator between sections */}
                    {sectionIndex < phase.sections.length - 1 && (
                      <div className="h-px my-6" style={{background: 'var(--border)'}} />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  const getVisibleItemsCount = () => {
    if (!checklist) return { essential: 0, total: 0 };
    
    let essential = 0;
    let total = 0;
    
    Object.values(checklist).forEach(phase => {
      phase.sections.forEach(section => {
        section.items.forEach(item => {
          total++;
          if (item.importance === 'essential') essential++;
        });
      });
    });
    
    return { essential, total };
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
    <div className="min-h-screen pb-24" style={{background: 'var(--bg)'}}>
      {/* Header */}
      <header className="glass-header sticky top-0 z-40 px-4 py-3 border-b">
        <div className="page-container">
          {/* Top Row: Back button, Title, Role Switcher */}
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => navigate(`/case/${id}`)}
              className="p-2 -ml-2 rounded-lg touch-target"
              style={{background: 'transparent', border: 'none'}}
              onMouseOver={(e) => e.currentTarget.style.background = 'var(--border)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <ArrowLeft className="h-5 w-5" style={{color: 'var(--t2)'}} />
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-semibold" style={{fontFamily: "'Lora', serif", color: 'var(--t1)'}}>Treatment Blueprint</h1>
              <p className="text-xs" style={{color: 'var(--t3)'}}>{caseData?.caseName}</p>
            </div>
            
            {caseData?.caseTeam && <RoleSwitcher caseTeam={caseData.caseTeam} />}
            {saving && <div className="text-xs animate-pulse mono" style={{color: 'var(--t3)'}}>Saving...</div>}
          </div>
          
          {/* Phase Tabs */}
          <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
            {PHASE_CONFIG.map((phase, index) => {
              const isActive = activePhase === phase.id;
              const isComplete = completedPhases[phase.id];
              const showAnimation = showPhaseCompleteAnimation === phase.id;
              
              return (
                <button
                  key={phase.id}
                  onClick={() => setActivePhase(phase.id)}
                  className="flex-shrink-0 px-4 py-2 text-sm font-medium transition-all rounded-t-lg relative"
                  style={{
                    background: isActive ? 'var(--card)' : 'transparent',
                    color: isComplete ? 'var(--green)' : isActive ? 'var(--t1)' : 'var(--t3)',
                    borderBottom: isActive ? '2px solid var(--green)' : '2px solid transparent',
                    fontWeight: isActive ? 600 : 400
                  }}
                >
                  <div className="flex items-center gap-2">
                    {isComplete && <Check className="h-3 w-3" style={{color: 'var(--green)'}} />}
                    {phase.icon && <span>{phase.icon}</span>}
                    <span>{phase.label}</span>
                    {showAnimation && (
                      <span className="inline-block animate-pulse" style={{color: 'var(--green)'}}>✓</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </header>
      
      
      <main className="page-container py-4" ref={checklistRef}>
        {/* Scope Toggle */}
        <div className="mb-4 p-3 rounded-lg" style={{background: 'var(--card)', border: '1px solid var(--border)'}}>
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setShowFullProtocol(false)}
              className="text-sm transition-colors"
              style={{color: !showFullProtocol ? 'var(--green)' : 'var(--t3)', fontWeight: !showFullProtocol ? 600 : 400}}
            >
              {!showFullProtocol && '✓ '}Essential
            </button>
            
            <button
              onClick={() => setShowFullProtocol(!showFullProtocol)}
              className={`toggle-endo ${showFullProtocol ? 'on' : ''}`}
            >
              <span className="toggle-thumb" />
            </button>
            
            <button
              onClick={() => setShowFullProtocol(true)}
              className="text-sm transition-colors"
              style={{color: showFullProtocol ? 'var(--blue)' : 'var(--t3)', fontWeight: showFullProtocol ? 600 : 400}}
            >
              {showFullProtocol && '✓ '}Full Protocol
            </button>
          </div>
        </div>
        
        {/* My Tasks Filter */}
        {caseData?.caseTeam && (
          <div className="mb-4 p-3 rounded-lg flex items-center justify-between" style={{background: 'var(--blue-1)', border: '1px solid var(--blue-b)'}}>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" style={{color: 'var(--blue)'}} />
              <span className="text-sm font-medium" style={{color: 'var(--blue)'}}>My Tasks Only</span>
            </div>
            <Switch
              checked={showMyTasksOnly}
              onCheckedChange={setShowMyTasksOnly}
            />
          </div>
        )}
        
        {/* Dynamic Notice */}
        {isDynamic && (
          <div className="mb-4 p-3 rounded-lg" style={{background: 'var(--blue-1)', borderLeft: '3px solid var(--blue)'}}>
            <div className="flex items-start gap-2">
              <TrendingUp className="h-4 w-4 shrink-0 mt-0.5" style={{color: 'var(--blue)'}} />
              <p className="text-sm" style={{color: 'var(--blue)'}}>
                Customized checklist based on case planning
              </p>
            </div>
          </div>
        )}
        
        {/* Active Phase Content */}
        {checklist && renderPhaseContent()}
        
        {/* Overall Progress */}
        <div className="mt-6 p-4 rounded-lg" style={{background: 'var(--card)', border: '1px solid var(--border)'}}>
          <div className="flex justify-between text-sm mb-2">
            <span className="label-endo">Overall Progress</span>
            <span className="mono" style={{color: 'var(--t1)'}}>{overallProgress.completed}/{overallProgress.total}</span>
          </div>
          <Progress value={overallProgress.percentage} className="h-2" />
        </div>
      </main>
      {/* Completion Buttons - Show when progress is 100% */}
      {overallProgress.percentage === 100 && (
        <div className="page-container py-4 space-y-3">
          <div className="rounded-lg p-4 text-center" style={{background: 'var(--green-1)', border: '1.5px solid var(--green-b)'}}>
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2" style={{color: 'var(--green)'}} />
            <h3 className="font-semibold mb-1" style={{color: 'var(--green)', fontFamily: "'Lora', serif"}}>Treatment Blueprint Complete! 🎉</h3>
            <p className="text-sm" style={{color: 'var(--green)'}}>All workflow steps have been checked off</p>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => navigate('/')}
              variant="outline"
              className="w-full btn-clinical btn-secondary-endo"
            >
              <Home className="h-4 w-4 mr-2" />
              Go to Home
            </Button>
            <Button
              onClick={() => navigate(`/case/${id}/learning`)}
              className="w-full btn-clinical btn-green-endo"
            >
              <Lightbulb className="h-4 w-4 mr-2" />
              Learning Reflections
            </Button>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 border-t" style={{background: 'var(--card)', borderColor: 'var(--border)'}}>
        <div className="page-container">
          <p className="text-xs text-center disclaimer-text">
            Workflow tracking only. Clinical judgment lies with the practitioner.
          </p>
        </div>
      </div>
    </div>
  );
}
