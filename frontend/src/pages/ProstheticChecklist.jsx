import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Circle, FlaskConical, TrendingUp, Home, Lightbulb, Check, Lock } from 'lucide-react';
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
import { ROLES, ROLE_LABELS, getRoleName } from '@/utils/rolePermissions';
import ContentContainer from '@/components/ui/ContentContainer';
import AppLayout from '@/layout/AppLayout';

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

const normalizeRole = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

const getUserRoles = (user, activeRole) => {
  const roles = new Set();
  const addRole = (role) => {
    const normalizedRole = normalizeRole(role);
    if (normalizedRole) {
      roles.add(normalizedRole);
    }
  };

  addRole(user?.role);

  if (Array.isArray(user?.roles)) {
    user.roles.forEach(addRole);
  }

  addRole(activeRole);

  return Array.from(roles);
};

const isClinician = (user) => getUserRoles(user).includes(ROLES.CLINICIAN);

const getItemAssignment = (item) => {
  const assignedTo = item?.assignedTo;

  if (assignedTo && typeof assignedTo === 'object') {
    return {
      id: assignedTo.id || assignedTo.userId || null,
      role: normalizeRole(assignedTo.role || assignedTo.name || assignedTo.value),
      label: assignedTo.label || assignedTo.name || assignedTo.role || assignedTo.userId || null
    };
  }

  const assignedValue = typeof assignedTo === 'string' ? assignedTo.trim() : '';
  const normalizedAssignedValue = normalizeRole(assignedValue);
  const assignedRole = normalizeRole(item?.assignedRole);
  const resolvedRole = normalizedAssignedValue && ROLE_LABELS[normalizedAssignedValue]
    ? normalizedAssignedValue
    : assignedRole;

  return {
    id: assignedValue && !ROLE_LABELS[normalizedAssignedValue] ? assignedValue : null,
    role: resolvedRole || null,
    label: assignedValue || item?.assignedRole || null
  };
};

const isAssignedToUser = (item, user, activeRole) => {
  if (!item || !user) return false;

  const assignment = getItemAssignment(item);
  const userRoles = getUserRoles(user, activeRole);

  if (assignment.id && String(assignment.id) === String(user.id)) {
    return true;
  }

  if (assignment.role && userRoles.includes(assignment.role)) {
    return true;
  }

  return false;
};

const canEditItem = (item, user, activeRole) => {
  if (!item || !user) return false;
  if (isClinician({ ...user, roles: getUserRoles(user, activeRole) })) {
    return true;
  }

  const assignment = getItemAssignment(item);
  if (!assignment.id && !assignment.role) {
    return false;
  }

  return isAssignedToUser(item, user, activeRole);
};

const getAssignmentLabel = (item, caseTeam) => {
  const assignment = getItemAssignment(item);

  if (assignment.id && item?.assignedToName) {
    return item.assignedToName;
  }

  if (assignment.role) {
    return getRoleName(caseTeam, assignment.role);
  }

  if (assignment.id) {
    return item?.assignedToName || assignment.id;
  }

  return 'Clinician';
};

export default function ProstheticChecklist() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [checklist, setChecklist] = useState(null);
  const [isDynamic, setIsDynamic] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showFullProtocol, setShowFullProtocol] = useState(() => {
    const saved = localStorage.getItem(`checklistScope_${id}`);
    return saved === 'full' ? true : false;
  });
  
  // Tab-based navigation
  const [activePhase, setActivePhase] = useState('preparation');
  const [completedPhases, setCompletedPhases] = useState({});
  const [showPhaseCompleteAnimation, setShowPhaseCompleteAnimation] = useState(null);
  const checklistRef = useRef(null);
  
  // Role-based collaboration state
  const [activeRole] = useActiveRole();
  const [showAll, setShowAll] = useState(false);
  
  const currentUser = useMemo(() => ({
    ...(loggedInUser || {}),
    role: normalizeRole(loggedInUser?.role) || normalizeRole(activeRole) || ROLES.CLINICIAN,
    roles: getUserRoles(loggedInUser, activeRole),
  }), [loggedInUser, activeRole]);

  // Persist toggle state to localStorage
  useEffect(() => {
    if (id) {
      localStorage.setItem(`checklistScope_${id}`, showFullProtocol ? 'full' : 'essential');
    }
  }, [showFullProtocol, id]);

  useEffect(() => {
    loadData();
  }, [id]);

  useEffect(() => {
    if (isClinician(currentUser)) {
      setShowAll(true);
    }
  }, [currentUser]);
  
  // Check phase completion whenever checklist changes
  useEffect(() => {
    if (checklist) {
      checkPhaseCompletion();
    }
  }, [checklist, showFullProtocol, showAll, currentUser]);

  const loadData = async () => {
    try {
      const [caseResponse, checklistResponse, userResponse] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/cases/${id}`),
        axios.get(`${BACKEND_URL}/api/cases/${id}/prosthetic-checklist`),
        axios.get(`${BACKEND_URL}/api/user/me`)
      ]);

      setCaseData(caseResponse.data);
      setChecklist(checklistResponse.data.prostheticChecklist);
      setIsDynamic(checklistResponse.data.isDynamic || false);
      setLoggedInUser(userResponse.data);
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
    if (!checklist) return [];

    const backendPhases = getBackendPhasesForUIPhase(uiPhase);
    const items = [];
    const shouldShowAllItems = isClinician(currentUser) || showAll;

    backendPhases.forEach((backendPhase) => {
      const phase = checklist[backendPhase];
      if (!phase) return;

      phase.sections.forEach((section) => {
        section.items.forEach((item) => {
          const isVisibleByScope = showFullProtocol || item.importance === 'essential';
          const isVisibleByAssignment = shouldShowAllItems || isAssignedToUser(item, currentUser, activeRole);

          if (isVisibleByScope && isVisibleByAssignment) {
            items.push({ ...item, phaseKey: backendPhase, section });
          }
        });
      });
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

  const toggleItem = async (phaseKey, sectionIndex, itemIndex) => {
    const updatedChecklist = { ...checklist };
    const item = updatedChecklist[phaseKey].sections[sectionIndex].items[itemIndex];

    if (!canEditItem(item, currentUser, activeRole)) {
      return;
    }

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
    const shouldShowAllItems = isClinician(currentUser) || showAll;

    return (
      <div className="space-y-4">
        {backendPhases.map((phaseKey) => {
          const phase = checklist?.[phaseKey];
          if (!phase?.sections?.length) return null;

          return (
            <div key={phaseKey}>
              {phase.sections.map((section, sectionIndex) => {
                const visibleItems = (section.items || []).filter((item) => {
                  const isVisibleByScope = showFullProtocol || item.importance === 'essential';
                  const isVisibleByAssignment = shouldShowAllItems || isAssignedToUser(item, currentUser, activeRole);
                  return isVisibleByScope && isVisibleByAssignment;
                });

                if (visibleItems.length === 0) return null;

                return (
                  <div key={sectionIndex} className="mb-6">
                    <div className="mb-3">
                      <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: 'var(--t1)' }}>
                        {section.isLabSection && <FlaskConical className="h-4 w-4" style={{ color: 'var(--green)' }} />}
                        {section.title}
                      </h3>
                    </div>

                    <div className="space-y-2">
                      {visibleItems.map((item) => {
                        const itemIndex = section.items.findIndex((sectionItem) => sectionItem.id === item.id);
                        const editable = canEditItem(item, currentUser, activeRole);
                        const assignmentLabel = getAssignmentLabel(item, caseData?.caseTeam);

                        return (
                          <div
                            key={item.id}
                            id={`item-${item.id}`}
                            className="flex items-start gap-3 p-3 rounded-lg transition-all"
                            style={{
                              background: editable ? 'var(--card)' : 'var(--bg)',
                              border: '1px solid var(--border)',
                              opacity: editable ? (item.completed ? 0.7 : 1) : 0.6
                            }}
                          >
                            <button
                              onClick={() => toggleItem(phaseKey, sectionIndex, itemIndex)}
                              className="shrink-0 pt-0.5"
                              disabled={!editable}
                              aria-label={editable ? 'Toggle checklist item' : 'Checklist item is view only'}
                              title={editable ? 'Toggle checklist item' : 'View only'}
                            >
                              {item.completed ? (
                                <CheckCircle2 className="h-5 w-5" style={{ color: 'var(--green)' }} />
                              ) : (
                                <Circle className="h-5 w-5" style={{ color: editable ? 'var(--border2)' : 'var(--t3)' }} />
                              )}
                            </button>

                            <div className="flex-1 min-w-0">
                              <p className={`text-sm ${item.completed ? 'line-through' : ''}`} style={{ color: item.completed ? 'var(--t3)' : 'var(--t1)' }}>
                                {item.text}
                              </p>

                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <RoleBadge role={getItemAssignment(item).role || ROLES.CLINICIAN} />

                                <span
                                  className="px-2 py-0.5 rounded mono text-[10px]"
                                  style={{ background: 'var(--border)', color: 'var(--t2)' }}
                                >
                                  Assigned to: {assignmentLabel}
                                </span>

                                {item.importance === 'essential' && (
                                  <span className="px-2 py-0.5 rounded mono" style={{ background: 'var(--green-1)', color: 'var(--green)', fontSize: '9px', textTransform: 'uppercase' }}>
                                    Essential
                                  </span>
                                )}

                                {!editable && (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded mono text-[10px]"
                                    style={{ background: 'var(--orange-1)', color: 'var(--orange)' }}
                                  >
                                    <Lock className="h-3 w-3" />
                                    View Only
                                  </span>
                                )}

                                {item.completedAt && (
                                  <span className="text-xs mono" style={{ color: 'var(--t3)' }}>
                                    {item.completedByName && `by ${item.completedByName}`}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {sectionIndex < phase.sections.length - 1 && (
                      <div className="h-px my-6" style={{ background: 'var(--border)' }} />
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading checklist...</div>
      </div>
    );
  }

  const overallProgress = calculateOverallProgress();
  const footerActions = (
    <ContentContainer>
      <p className="text-xs text-center disclaimer-text">
        Workflow tracking only. Clinical judgment lies with the practitioner.
      </p>
    </ContentContainer>
  );

  return (
    <AppLayout
      headerContent={
        <div className="px-4 py-3" style={{background: 'var(--card)'}}>
        <ContentContainer>
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
        </ContentContainer>
      </div>
      }
      footerActions={footerActions}
    >
      <ContentContainer className="py-4" ref={checklistRef}>
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
        
        {/* Assignment Visibility Toggle */}
        {!isClinician(currentUser) && (
          <div className="mb-4 p-3 rounded-lg flex items-center justify-between gap-3" style={{ background: 'var(--blue-1)', border: '1px solid var(--blue-b)' }}>
            <div>
              <Label htmlFor="show-all-items" className="text-sm font-medium" style={{ color: 'var(--blue)' }}>
                Show All Items
              </Label>
              <p className="text-xs mt-1" style={{ color: 'var(--t3)' }}>
                Off shows only your assigned items. On shows all items, but only your assignments stay editable.
              </p>
            </div>
            <Switch
              id="show-all-items"
              checked={showAll}
              onCheckedChange={setShowAll}
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
      </ContentContainer>
      {/* Completion Buttons - Show when progress is 100% */}
      {overallProgress.percentage === 100 && (
        <ContentContainer className="py-4 space-y-3">
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
        </ContentContainer>
      )}

    </AppLayout>
  );
}
