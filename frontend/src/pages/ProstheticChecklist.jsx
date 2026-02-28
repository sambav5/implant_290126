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
  healing: ['immediate_post_delivery'],
  restoration: ['prosthetic_rehab', 'clinical_tryin'],
  finalization: ['delivery'],
  review: ['follow_up', 'maintenance']
};

const PHASE_CONFIG = [
  { id: 'preparation', label: 'Preparation', icon: '📋' },
  { id: 'placement', label: 'Placement', icon: '🦷' },
  { id: 'healing', label: 'Healing', icon: '🔄' },
  { id: 'restoration', label: 'Restoration', icon: '🎨' },
  { id: 'finalization', label: 'Finalization', icon: '✓' },
  { id: 'review', label: 'Review', icon: '👁️' }
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
      <header className="glass-header sticky top-0 z-40 px-4 py-4 border-b">
        <div className="page-container">
          <div className="flex items-center gap-3 mb-3">
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
              <h1 className="text-xl font-semibold" style={{fontFamily: "'Lora', serif", color: 'var(--t1)'}}>Treatment Blueprint</h1>
              <p className="text-sm" style={{color: 'var(--t2)'}}>{caseData?.caseName}</p>
            </div>
            
            {/* Role Switcher */}
            {caseData?.caseTeam && (
              <RoleSwitcher caseTeam={caseData.caseTeam} />
            )}
            
            {saving && (
              <div className="text-sm animate-pulse mono" style={{color: 'var(--t3)'}}>Saving...</div>
            )}
          </div>
          
          {/* Scope Toggle */}
          <div className="mb-4 p-3 rounded-lg" style={{background: 'var(--card)', border: '1.5px solid var(--border)'}}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <button
                  onClick={() => setShowFullProtocol(false)}
                  className="text-sm font-medium transition-colors"
                  style={{color: !showFullProtocol ? 'var(--green)' : 'var(--t3)'}}
                >
                  {!showFullProtocol && '✓ '}Essential Checklist ({getVisibleItemsCount().essential} items)
                </button>
              </div>
              
              {/* Toggle Switch - EndoPilot Style */}
              <button
                onClick={() => setShowFullProtocol(!showFullProtocol)}
                className={`toggle-endo ${showFullProtocol ? 'on' : ''}`}
              >
                <span className="toggle-thumb" />
              </button>
              
              <div className="flex-1 text-right">
                <button
                  onClick={() => setShowFullProtocol(true)}
                  className="text-sm font-medium transition-colors"
                  style={{color: showFullProtocol ? 'var(--blue)' : 'var(--t3)'}}
                >
                  {showFullProtocol && '✓ '}Full Protocol ({getVisibleItemsCount().total} items)
                </button>
              </div>
            </div>
            <p className="text-xs text-center mt-2" style={{color: 'var(--t3)'}}>
              {showFullProtocol 
                ? 'Showing complete protocol - all essential and advanced steps'
                : 'Showing essential items only - steps that prevent failure (Recommended)'}
            </p>
          </div>
          
          {/* My Tasks Only Toggle */}
          <div className="mb-4 p-3 rounded-lg" style={{background: 'var(--blue-1)', border: '1.5px solid var(--blue-b)'}}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" style={{color: 'var(--blue)'}} />
                <Label htmlFor="myTasksToggle" className="text-sm font-medium cursor-pointer" style={{color: 'var(--blue)'}}>
                  Show My Tasks Only
                </Label>
              </div>
              <Switch
                id="myTasksToggle"
                checked={showMyTasksOnly}
                onCheckedChange={setShowMyTasksOnly}
              />
            </div>
            {showMyTasksOnly && (
              <p className="text-xs mt-2 mono" style={{color: 'var(--blue)', textTransform: 'uppercase', fontSize: '10px'}}>
                Filtering items assigned to {getRoleName(caseData?.caseTeam, activeRole)}
              </p>
            )}
          </div>
          
          {/* Overall Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium label-endo">Overall Progress</span>
              <span className="mono" style={{color: 'var(--t3)', fontSize: '11px'}}>
                {overallProgress.completed} / {overallProgress.total} items
              </span>
            </div>
            <Progress value={overallProgress.percentage} className="h-3" />
            <p className="text-xs text-center mono" style={{color: 'var(--t3)'}}>
              {overallProgress.percentage}% Complete
            </p>
          </div>
        </div>
      </header>

      <main className="page-container py-6 space-y-4">
        {/* Dynamic Checklist Notice */}
        {isDynamic && (
          <div className="rounded-lg p-4 animate-fade-in" style={{background: 'var(--blue-1)', borderLeft: '3px solid var(--blue)'}}>
            <div className="flex items-start gap-3">
              <TrendingUp className="h-5 w-5 shrink-0 mt-0.5" style={{color: 'var(--blue)'}} />
              <div className="flex-1">
                <p className="text-sm font-medium" style={{color: 'var(--blue)'}}>
                  Checklist customized based on case planning
                </p>
                <p className="text-xs mt-1 mono" style={{color: 'var(--blue)', opacity: 0.8}}>
                  Only clinically relevant items for this specific case are shown. 
                  {planningConditions && (
                    <span className="block mt-1">
                      Active conditions: {Object.keys(planningConditions).filter(k => planningConditions[k]).length} detected
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {checklist && Object.keys(checklist).map((phaseKey) => {
          const phase = checklist[phaseKey];
          const progress = calculateProgress(phase);
          const colors = PHASE_COLORS[phaseKey] || DEFAULT_PHASE_COLOR; // Fallback for undefined phases
          const isExpanded = expandedPhases[phaseKey];

          return (
            <div key={phaseKey} className="rounded-xl overflow-hidden" style={{border: `2px solid ${colors.border}`}}>
              {/* Phase Header */}
              <button
                onClick={() => togglePhase(phaseKey)}
                className="w-full p-4 flex items-center justify-between touch-target"
                style={{background: colors.bg}}
              >
                <div className="flex items-center gap-3 flex-1 text-left">
                  <div className="p-2 rounded-lg" style={{background: 'white', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'}}>
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5" style={{color: colors.text}} />
                    ) : (
                      <ChevronRight className="h-5 w-5" style={{color: colors.text}} />
                    )}
                  </div>
                  <div className="flex-1">
                    <h2 className="font-bold text-lg" style={{color: colors.text, fontFamily: "'Lora', serif"}}>{phase.title}</h2>
                    <p className="text-sm" style={{color: 'var(--t2)'}}>{phase.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="px-3 py-1 rounded-full text-sm font-semibold mono" style={{background: colors.badge, color: colors.text}}>
                    {progress.percentage}%
                  </div>
                  <div className="text-xs mono" style={{color: 'var(--t3)'}}>
                    {progress.completed}/{progress.total}
                  </div>
                </div>
              </button>

              {/* Phase Content */}
              {isExpanded && (
                <div style={{background: 'var(--card)'}}>
                  {phase.sections.map((section, sectionIndex) => {
                    const sectionKey = `${phaseKey}-${sectionIndex}`;
                    const isSectionExpanded = expandedSections[sectionKey];
                    const completedItems = section.items.filter(item => {
                      const isVisible = showFullProtocol || item.importance === 'essential';
                      return isVisible && item.completed;
                    }).length;
                    const totalVisibleItems = section.items.filter(item => 
                      showFullProtocol || item.importance === 'essential'
                    ).length;

                    return (
                      <div key={sectionIndex} style={{borderTop: '1.5px solid var(--border)'}}>
                        {/* Section Header */}
                        <button
                          onClick={() => toggleSection(phaseKey, sectionIndex)}
                          className="w-full p-4 flex items-center justify-between transition-colors"
                          style={{
                            background: section.isLabSection ? 'var(--green-1)' : 'transparent'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.background = section.isLabSection ? 'var(--green-1)' : 'var(--border)'}
                          onMouseOut={(e) => e.currentTarget.style.background = section.isLabSection ? 'var(--green-1)' : 'transparent'}
                        >
                          <div className="flex items-center gap-3 flex-1 text-left">
                            {section.isLabSection && (
                              <FlaskConical className="h-5 w-5 shrink-0" style={{color: 'var(--green)'}} />
                            )}
                            <h3 className="font-semibold" style={{color: section.isLabSection ? 'var(--green)' : 'var(--t1)'}}>
                              {section.isLabSection && '🏥 '}
                              {section.title}
                              {!showFullProtocol && totalVisibleItems < section.items.length && (
                                <span className="ml-2 text-xs font-normal mono" style={{color: 'var(--blue)'}}>
                                  (+{section.items.length - totalVisibleItems} more)
                                </span>
                              )}
                            </h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs mono" style={{color: 'var(--t3)'}}>
                              {completedItems}/{totalVisibleItems}
                            </span>
                            {isSectionExpanded ? (
                              <ChevronDown className="h-4 w-4" style={{color: 'var(--t3)'}} />
                            ) : (
                              <ChevronRight className="h-4 w-4" style={{color: 'var(--t3)'}} />
                            )}
                          </div>
                        </button>

                        {/* Section Items */}
                        {isSectionExpanded && (
                          <div className="px-4 pb-4" style={{background: section.isLabSection ? 'rgba(235, 245, 240, 0.3)' : 'transparent'}}>
                            {/* Select All Button */}
                            <div className="py-2 mb-2" style={{borderBottom: '1px solid var(--border)'}}>
                              <button
                                onClick={() => toggleSelectAllInSection(phaseKey, sectionIndex)}
                                className="text-xs font-medium mono transition-colors"
                                style={{color: 'var(--green)'}}
                                onMouseOver={(e) => e.currentTarget.style.opacity = '0.8'}
                                onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                              >
                                {(() => {
                                  const visibleItems = section.items.filter(item => showFullProtocol || item.importance === 'essential');
                                  const editableItems = visibleItems.filter(item => {
                                    const itemRole = item.assignedRole || 'clinician';
                                    return canEditItem(itemRole, activeRole);
                                  });
                                  const allEditableCompleted = editableItems.length > 0 && editableItems.every(item => item.completed);
                                  
                                  return allEditableCompleted ? '☑ Uncheck My Items' : '☐ Select My Items';
                                })()}
                              </button>
                            </div>
                            {section.items
                              .filter(item => {
                                // Filter by protocol scope
                                const isVisibleByScope = showFullProtocol || item.importance === 'essential';
                                
                                // Filter by "My Tasks Only"
                                if (showMyTasksOnly) {
                                  const itemRole = item.assignedRole || 'clinician';
                                  return isVisibleByScope && itemRole === activeRole;
                                }
                                
                                return isVisibleByScope;
                              })
                              .map((item, itemIndex) => {
                                const isAdvanced = item.importance === 'advanced';
                                const itemRole = item.assignedRole || 'clinician';
                                const canEdit = canEditItem(itemRole, activeRole);
                                
                                return (
                                <div
                                  key={item.id}
                                  className={`flex items-start gap-3 py-3 last:border-0 ${
                                    item.completed ? 'opacity-60' : ''
                                  } ${!canEdit ? 'opacity-70' : ''}`}
                                  style={{
                                    borderBottom: '1px solid var(--border)',
                                    background: isAdvanced && showFullProtocol ? 'rgba(227, 224, 216, 0.2)' : 'transparent'
                                  }}
                                >
                                  <button
                                    onClick={() => canEdit && toggleItem(phaseKey, sectionIndex, section.items.indexOf(item))}
                                    className="shrink-0 pt-0.5 touch-target"
                                    disabled={!canEdit}
                                    title={!canEdit ? `Assigned to ${itemRole}` : ''}
                                  >
                                    {item.completed ? (
                                      <CheckCircle2 className="h-5 w-5" style={{color: canEdit ? 'var(--green)' : 'rgba(26, 107, 74, 0.4)'}} />
                                    ) : (
                                      <Circle className="h-5 w-5" style={{color: canEdit ? 'var(--border2)' : 'var(--border)'}} />
                                    )}
                                  </button>
                                  <div className="flex-1">
                                    <div className="flex items-start gap-2 flex-wrap">
                                      <p className={`text-sm flex-1 ${item.completed ? 'line-through' : ''}`} 
                                         style={{color: item.completed ? 'var(--t3)' : 'var(--t1)'}}>
                                        {item.text}
                                      </p>
                                      
                                      {/* Role Badge */}
                                      <RoleBadge role={itemRole} />
                                      
                                      {item.importance === 'essential' && (
                                        <span className="shrink-0 px-2 py-1 text-xs rounded-md mono" style={{
                                          background: 'var(--green-1)',
                                          color: 'var(--green)',
                                          border: '1px solid var(--green-b)',
                                          fontSize: '9px',
                                          textTransform: 'uppercase',
                                          fontWeight: 500
                                        }}>
                                          Essential
                                        </span>
                                      )}
                                      {isAdvanced && showFullProtocol && (
                                        <span className="shrink-0 px-2 py-1 rounded mono" style={{
                                          background: 'var(--border)',
                                          color: 'var(--t2)',
                                          fontSize: '9px',
                                          textTransform: 'uppercase',
                                          fontWeight: 500
                                        }}>
                                          Advanced
                                        </span>
                                      )}
                                      {item.autoCompleted && (
                                        <span className="shrink-0 px-2 py-1 rounded mono" style={{
                                          background: 'var(--blue-1)',
                                          color: 'var(--blue)',
                                          fontSize: '9px',
                                          textTransform: 'uppercase',
                                          fontWeight: 500
                                        }}>
                                          Auto-completed
                                        </span>
                                      )}
                                      {!showFullProtocol && item.importance !== 'essential' && (
                                        <TrendingUp className="h-4 w-4 shrink-0" style={{color: 'var(--blue)'}} title="High Impact" />
                                      )}
                                    </div>
                                    {item.completedAt && (
                                      <p className="text-xs mt-1 mono" style={{color: 'var(--t3)'}}>
                                        {item.autoCompleted && item.autoCompleteReason ? (
                                          <span className="italic" style={{color: 'var(--blue)'}}>
                                            {item.autoCompleteReason} • {new Date(item.completedAt).toLocaleString()}
                                          </span>
                                        ) : (
                                          <span>
                                            Completed: {new Date(item.completedAt).toLocaleString()}
                                            {item.completedByName && ` by ${item.completedByName}`}
                                          </span>
                                        )}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )})}
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
