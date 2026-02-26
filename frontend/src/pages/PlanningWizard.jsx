import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronRight, AlertTriangle, Activity, Info, Clock, Zap, Shield, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { caseApi } from '@/services/api';
import { toast } from 'sonner';
import { trackPlanningCompleted, trackRiskAnalysisRun } from '@/lib/analytics';

const PLANNING_STEPS = [
  {
    id: 'bone',
    title: 'Bone Assessment',
    description: 'Evaluate available bone for implant placement',
    fields: [
      {
        key: 'boneAvailability',
        label: 'Bone Availability',
        type: 'radio',
        options: [
          { value: 'adequate', label: 'Adequate', description: 'Sufficient bone in all dimensions' },
          { value: 'moderate', label: 'Moderate', description: 'Minor deficiencies present' },
          { value: 'limited', label: 'Limited', description: 'Significant deficiencies' },
          { value: 'insufficient', label: 'Insufficient', description: 'May require augmentation' },
        ],
      },
      {
        key: 'boneHeight',
        label: 'Approximate Bone Height',
        type: 'radio',
        options: [
          { value: '>10mm', label: '>10mm', description: 'Adequate for most implants' },
          { value: '8-10mm', label: '8-10mm', description: 'May limit implant length' },
          { value: '6-8mm', label: '6-8mm', description: 'Short implant territory' },
          { value: '<6mm', label: '<6mm', description: 'Consider augmentation' },
        ],
      },
      {
        key: 'boneWidth',
        label: 'Approximate Bone Width',
        type: 'radio',
        options: [
          { value: '>6mm', label: '>6mm', description: 'Adequate for standard diameter' },
          { value: '5-6mm', label: '5-6mm', description: 'May need narrow implant' },
          { value: '4-5mm', label: '4-5mm', description: 'Limited options' },
          { value: '<4mm', label: '<4mm', description: 'Augmentation likely needed' },
        ],
      },
    ],
  },
  {
    id: 'esthetics',
    title: 'Esthetic Considerations',
    description: 'Assess esthetic risk and soft tissue factors',
    fields: [
      {
        key: 'estheticZone',
        label: 'Esthetic Zone',
        type: 'radio',
        options: [
          { value: 'high', label: 'High', description: 'Visible during smile/speech' },
          { value: 'low', label: 'Low', description: 'Not visible (posterior)' },
        ],
      },
      {
        key: 'softTissueBiotype',
        label: 'Soft Tissue Biotype',
        type: 'radio',
        options: [
          { value: 'thick', label: 'Thick', description: 'More forgiving, lower recession risk' },
          { value: 'thin', label: 'Thin', description: 'Higher esthetic risk' },
        ],
      },
      {
        key: 'adjacentTeeth',
        label: 'Adjacent Teeth Condition',
        type: 'textarea',
        placeholder: 'Describe condition of adjacent teeth, papillae, restorations...',
      },
    ],
  },
  {
    id: 'systemic',
    title: 'Systemic Factors',
    description: 'Review patient health factors',
    fields: [
      {
        key: 'smokingStatus',
        label: 'Smoking Status',
        type: 'radio',
        options: [
          { value: 'never', label: 'Never Smoked' },
          { value: 'former', label: 'Former Smoker' },
          { value: 'current', label: 'Current Smoker' },
        ],
      },
      {
        key: 'diabetesStatus',
        label: 'Diabetes Status',
        type: 'radio',
        options: [
          { value: 'none', label: 'No Diabetes' },
          { value: 'controlled', label: 'Controlled Diabetes' },
          { value: 'uncontrolled', label: 'Uncontrolled Diabetes' },
        ],
      },
      {
        key: 'medications',
        label: 'Relevant Medications',
        type: 'checkbox',
        options: [
          { value: 'bisphosphonates', label: 'Bisphosphonates' },
          { value: 'anticoagulant', label: 'Anticoagulants / Blood Thinners' },
          { value: 'immunosuppressant', label: 'Immunosuppressants' },
          { value: 'steroids', label: 'Long-term Steroids' },
          { value: 'none', label: 'None of the above' },
        ],
      },
    ],
  },
  {
    id: 'restorative',
    title: 'Restorative Context',
    description: 'Plan the final restoration',
    fields: [
      {
        key: 'restorativeContext',
        label: 'Restoration Type',
        type: 'radio',
        options: [
          { value: 'single_crown', label: 'Single Crown' },
          { value: 'bridge_abutment', label: 'Bridge Abutment' },
          { value: 'overdenture', label: 'Overdenture Support' },
          { value: 'fixed_prosthesis', label: 'Fixed Full Arch' },
        ],
      },
      {
        key: 'occlusion',
        label: 'Occlusal Considerations',
        type: 'textarea',
        placeholder: 'Describe occlusion, parafunctional habits, opposing dentition...',
      },
      {
        key: 'additionalNotes',
        label: 'Additional Planning Notes',
        type: 'textarea',
        placeholder: 'Any other relevant clinical observations...',
      },
    ],
  },
];

const riskConfig = {
  low: { label: 'Low Risk', className: 'risk-badge-low', color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
  moderate: { label: 'Moderate', className: 'risk-badge-moderate', color: 'text-amber-600', bgColor: 'bg-amber-50' },
  high: { label: 'High Risk', className: 'risk-badge-high', color: 'text-red-600', bgColor: 'bg-red-50' },
};

const complexityConfig = {
  Simple: { color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
  Moderate: { color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
  Complex: { color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
};

export default function PlanningWizard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [planningData, setPlanningData] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [detailedMode, setDetailedMode] = useState(false);
  
  // Progressive flow state
  const [expandedSections, setExpandedSections] = useState({ 0: true }); // Start with first section expanded
  const [completedSections, setCompletedSections] = useState({});
  const fieldRefs = useRef({});
  const sectionRefs = useRef({});
  
  useEffect(() => {
    loadCase();
  }, [id]);
  
  const loadCase = async () => {
    try {
      const response = await caseApi.getById(id);
      setCaseData(response.data);
      if (response.data.planningData) {
        setPlanningData(response.data.planningData);
        // Check which sections are complete on load
        checkAllSections(response.data.planningData);
      }
      if (response.data.riskAssessment) {
        setShowResults(true);
      }
    } catch (error) {
      toast.error('Failed to load case');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };
  
  // Check if a field is filled
  const isFieldFilled = (field, data) => {
    const value = data[field.key];
    if (field.type === 'checkbox') {
      return Array.isArray(value) && value.length > 0;
    }
    if (field.type === 'textarea') {
      return value && value.trim().length > 0;
    }
    return value !== undefined && value !== '';
  };
  
  // Check if a section is complete
  const isSectionComplete = (sectionIndex, data) => {
    const section = PLANNING_STEPS[sectionIndex];
    return section.fields.every(field => isFieldFilled(field, data));
  };
  
  // Check all sections and update completion status
  const checkAllSections = (data) => {
    const completed = {};
    PLANNING_STEPS.forEach((_, index) => {
      completed[index] = isSectionComplete(index, data);
    });
    setCompletedSections(completed);
  };
  
  // Get the next unfilled field in a section
  const getNextUnfilledField = (sectionIndex, data) => {
    const section = PLANNING_STEPS[sectionIndex];
    return section.fields.find(field => !isFieldFilled(field, data));
  };
  
  // Scroll to element smoothly
  const scrollToElement = (ref) => {
    if (ref) {
      ref.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };
  
  // Focus on a field
  const focusField = (fieldKey) => {
    setTimeout(() => {
      const fieldRef = fieldRefs.current[fieldKey];
      if (fieldRef) {
        scrollToElement(fieldRef);
      }
    }, 300); // Delay to allow for expansion animation
  };
  
  // Auto-save progress
  const autoSaveProgress = async (newData) => {
    try {
      await caseApi.update(id, { planningData: newData });
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  };
  
  // Handle field change with progressive flow
  const handleFieldChange = async (sectionIndex, fieldKey, value) => {
    const newData = { ...planningData, [fieldKey]: value };
    setPlanningData(newData);
    
    // Auto-save
    autoSaveProgress(newData);
    
    // Check if this completes the section
    const sectionComplete = isSectionComplete(sectionIndex, newData);
    setCompletedSections(prev => ({ ...prev, [sectionIndex]: sectionComplete }));
    
    // Find next unfilled field in current section
    const nextField = getNextUnfilledField(sectionIndex, newData);
    
    if (nextField) {
      // Move to next field in same section
      focusField(nextField.key);
    } else {
      // Section complete! Collapse current, expand next
      if (sectionIndex < PLANNING_STEPS.length - 1) {
        setTimeout(() => {
          // Collapse current section
          setExpandedSections(prev => ({ ...prev, [sectionIndex]: false }));
          
          // Expand next section
          const nextSectionIndex = sectionIndex + 1;
          setExpandedSections(prev => ({ ...prev, [nextSectionIndex]: true }));
          
          // Scroll to next section and focus first field
          setTimeout(() => {
            const nextSectionRef = sectionRefs.current[nextSectionIndex];
            if (nextSectionRef) {
              scrollToElement(nextSectionRef);
              const firstField = PLANNING_STEPS[nextSectionIndex].fields[0];
              if (firstField) {
                focusField(firstField.key);
              }
            }
          }, 300);
        }, 500); // Small delay to show completion state
      } else {
        // All sections complete!
        toast.success('All fields completed! Ready to analyze.');
      }
    }
  };
  
  const handleCheckboxChange = (sectionIndex, key, value, checked) => {
    const currentValues = planningData[key] || [];
    const newValues = checked
      ? [...currentValues, value]
      : currentValues.filter(v => v !== value);
    
    handleFieldChange(sectionIndex, key, newValues);
  };
  
  const handleTextareaChange = (sectionIndex, key, value) => {
    handleFieldChange(sectionIndex, key, value);
  };
  
  const handleTextareaBlur = (sectionIndex, key) => {
    // On blur, check if section is complete and progress
    const newData = planningData;
    const sectionComplete = isSectionComplete(sectionIndex, newData);
    
    if (sectionComplete && sectionIndex < PLANNING_STEPS.length - 1) {
      setTimeout(() => {
        setExpandedSections(prev => ({ ...prev, [sectionIndex]: false }));
        const nextSectionIndex = sectionIndex + 1;
        setExpandedSections(prev => ({ ...prev, [nextSectionIndex]: true }));
        
        setTimeout(() => {
          const nextSectionRef = sectionRefs.current[nextSectionIndex];
          if (nextSectionRef) {
            scrollToElement(nextSectionRef);
          }
        }, 300);
      }, 500);
    }
  };
  
  const toggleSection = (sectionIndex) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionIndex]: !prev[sectionIndex]
    }));
  };
  
  const handleAnalyze = async () => {
    // Check if all sections are complete
    const allComplete = PLANNING_STEPS.every((_, index) => isSectionComplete(index, planningData));
    
    if (!allComplete) {
      toast.error('Please complete all required fields before analyzing');
      return;
    }
    
    setAnalyzing(true);
    try {
      await caseApi.update(id, { planningData });
      
      // Track planning completion
      trackPlanningCompleted(id, planningData);
      
      const response = await caseApi.analyze(id);
      setCaseData(prev => ({ ...prev, riskAssessment: response.data }));
      
      // Track risk analysis
      trackRiskAnalysisRun(id, response.data);
      
      setShowResults(true);
      toast.success('Assessment complete');
      
      // Scroll to top to show results
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      toast.error('Failed to analyze');
    } finally {
      setAnalyzing(false);
    }
  };
  
  // Calculate overall progress
  const calculateProgress = () => {
    if (showResults) return 100;
    
    const totalFields = PLANNING_STEPS.reduce((sum, step) => sum + step.fields.length, 0);
    const filledFields = PLANNING_STEPS.reduce((sum, step) => {
      const filled = step.fields.filter(field => isFieldFilled(field, planningData)).length;
      return sum + filled;
    }, 0);
    
    return Math.round((filledFields / totalFields) * 100);
  };
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{background: 'var(--bg)'}}>
        <div className="animate-pulse mono" style={{color: 'var(--t3)'}}>Loading...</div>
      </div>
    );
  }
  
  const progress = calculateProgress();
  const risk = caseData?.riskAssessment ? riskConfig[caseData.riskAssessment.overallRisk] : null;
  const allSectionsComplete = PLANNING_STEPS.every((_, index) => completedSections[index]);
  
  return (
    <div className="min-h-screen pb-32" style={{background: 'var(--bg)'}}>
      {/* Header */}
      <header className="glass-header sticky top-0 z-40 px-4 py-4">
        <div className="page-container">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/case/${id}`)}
              className="p-2 -ml-2 rounded-lg touch-target"
              style={{background: 'transparent', border: 'none'}}
              onMouseOver={(e) => e.currentTarget.style.background = 'var(--border)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              data-testid="back-btn"
            >
              <ArrowLeft className="h-5 w-5" style={{color: 'var(--t2)'}} />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold truncate" style={{fontFamily: "'Lora', serif", color: 'var(--t1)'}}>Planning Engine</h1>
              <p className="text-sm" style={{color: 'var(--t2)'}}>{caseData?.caseName}</p>
            </div>
          </div>
          
          {/* Progress */}
          {!showResults && (
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="mono" style={{color: 'var(--t2)', fontSize: '10px', textTransform: 'uppercase'}}>
                  Overall Progress
                </span>
                <span className="font-medium mono" style={{color: 'var(--t1)'}}>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </div>
      </header>
      
      <main className="page-container py-6">
        {/* Results View */}
        {showResults && caseData?.riskAssessment && (
          <div className="space-y-5 animate-fade-in">
            {/* Clinical Depth Toggle */}
            <div className="card-clinical">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    {detailedMode ? <Lightbulb className="h-5 w-5 text-primary" /> : <Zap className="h-5 w-5 text-primary" />}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Clinical Depth</p>
                    <p className="text-sm text-muted-foreground">
                      {detailedMode ? 'Detailed reasoning' : 'Standard summary'}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={detailedMode}
                  onCheckedChange={setDetailedMode}
                  data-testid="clinical-depth-toggle"
                />
              </div>
            </div>
            
            {/* === STANDARD MODE === */}
            {!detailedMode && (
              <div className="space-y-4">
                {/* Primary Issue + Complexity */}
                <div className="card-clinical">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Primary Clinical Issue</p>
                      <h3 className="text-lg font-semibold text-foreground">
                        {caseData.riskAssessment.primaryIssue || 'Standard Implant Placement'}
                      </h3>
                    </div>
                    <Badge 
                      className={`${complexityConfig[caseData.riskAssessment.caseComplexity]?.bgColor} ${complexityConfig[caseData.riskAssessment.caseComplexity]?.color} ${complexityConfig[caseData.riskAssessment.caseComplexity]?.borderColor} border`}
                    >
                      {caseData.riskAssessment.caseComplexity || 'Moderate'}
                    </Badge>
                  </div>
                  
                  {/* Implant Timing */}
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg mb-3">
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                    <p className="text-sm">
                      <span className="font-medium">Timing: </span>
                      {caseData.riskAssessment.implantTiming || 'Conventional placement protocol'}
                    </p>
                  </div>
                  
                  {/* Brief Rationale */}
                  <p className="text-sm text-muted-foreground italic">
                    {caseData.riskAssessment.briefRationale || caseData.riskAssessment.plainLanguageSummary}
                  </p>
                </div>
              </div>
            )}
            
            {/* === DETAILED MODE === */}
            {detailedMode && (
              <div className="space-y-4">
                {/* 1. Primary Clinical Issue (Expanded) */}
                <div className="card-clinical">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">1</div>
                    <h4 className="font-semibold text-foreground">Primary Clinical Issue</h4>
                  </div>
                  <p className="text-foreground leading-relaxed">
                    {caseData.riskAssessment.primaryIssueExpanded || caseData.riskAssessment.plainLanguageSummary}
                  </p>
                </div>
                
                {/* 2. Case Complexity + Drivers */}
                <div className="card-clinical">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">2</div>
                    <h4 className="font-semibold text-foreground">Case Complexity</h4>
                    <Badge 
                      className={`ml-auto ${complexityConfig[caseData.riskAssessment.caseComplexity]?.bgColor} ${complexityConfig[caseData.riskAssessment.caseComplexity]?.color} ${complexityConfig[caseData.riskAssessment.caseComplexity]?.borderColor} border`}
                    >
                      {caseData.riskAssessment.caseComplexity || 'Moderate'}
                    </Badge>
                  </div>
                  
                  {caseData.riskAssessment.complexityDrivers?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Contributing factors:</p>
                      <ul className="space-y-1.5">
                        {caseData.riskAssessment.complexityDrivers.map((driver, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm">
                            <span className="text-primary mt-1">•</span>
                            <span>{driver}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                
                {/* 3. Implant Timing Recommendation */}
                <div className="card-clinical">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">3</div>
                    <h4 className="font-semibold text-foreground">Implant Timing</h4>
                  </div>
                  
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg mb-3">
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                    <p className="text-sm font-medium">
                      {caseData.riskAssessment.implantTiming || 'Conventional placement protocol'}
                    </p>
                  </div>
                  
                  {/* Immediate Placement Eligibility */}
                  {caseData.riskAssessment.immediatePlacementEligible !== null && (
                    <div className={`p-3 rounded-lg border ${
                      caseData.riskAssessment.immediatePlacementEligible 
                        ? 'bg-emerald-50 border-emerald-200' 
                        : 'bg-amber-50 border-amber-200'
                    }`}>
                      <p className={`text-sm font-medium mb-2 ${
                        caseData.riskAssessment.immediatePlacementEligible 
                          ? 'text-emerald-700' 
                          : 'text-amber-700'
                      }`}>
                        {caseData.riskAssessment.immediatePlacementEligible 
                          ? '✓ Immediate placement may be considered'
                          : '⚠ Immediate placement not recommended'}
                      </p>
                      {caseData.riskAssessment.immediatePlacementReasons?.length > 0 && (
                        <ul className="space-y-1">
                          {caseData.riskAssessment.immediatePlacementReasons.map((reason, index) => (
                            <li key={index} className="text-sm text-slate-600 flex items-start gap-2">
                              <span className="mt-0.5">→</span>
                              <span>{reason}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
                
                {/* 4. Risk Modifiers Detected */}
                {caseData.riskAssessment.riskModifiers?.length > 0 && (
                  <div className="card-clinical">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">4</div>
                      <h4 className="font-semibold text-foreground">Risk Modifiers Detected</h4>
                    </div>
                    <div className="space-y-2">
                      {caseData.riskAssessment.riskModifiers.map((modifier, index) => (
                        <div key={index} className="flex items-start gap-2 text-sm p-2 bg-muted/30 rounded">
                          <Shield className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                          <span>{modifier}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* 5. Clinical Rationale */}
                {caseData.riskAssessment.clinicalRationale?.length > 0 && (
                  <div className="card-clinical">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">5</div>
                      <h4 className="font-semibold text-foreground">Clinical Rationale</h4>
                    </div>
                    <ul className="space-y-2">
                      {caseData.riskAssessment.clinicalRationale.map((rationale, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <span>{rationale}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* 6. Backup Awareness (Complex cases only) */}
                {caseData.riskAssessment.backupAwareness && (
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-start gap-2">
                      <Lightbulb className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                      <p className="text-sm text-slate-600 italic">
                        {caseData.riskAssessment.backupAwareness}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Disclaimer */}
            <div className="p-4 bg-muted/50 rounded-lg border border-border">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="disclaimer-text">
                  Decision support only. These considerations are suggestions based on the information provided. 
                  Final clinical judgment lies with the treating clinician.
                </p>
              </div>
            </div>
            
            <Button
              onClick={() => navigate(`/case/${id}/prosthetic-checklist`)}
              className="w-full btn-clinical bg-primary text-primary-foreground"
              data-testid="proceed-checklists-btn"
            >
              Continue to Treatment Blueprint
              <ChevronRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
        )}
        
        {/* Step Form */}
        {!showResults && currentStepData && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h2 className="text-2xl font-semibold mb-2">{currentStepData.title}</h2>
              <p className="text-muted-foreground">{currentStepData.description}</p>
            </div>
            
            {currentStepData.fields.map((field) => (
              <div key={field.key} className="space-y-3">
                <Label className="text-base font-medium">{field.label}</Label>
                
                {field.type === 'radio' && (
                  <RadioGroup
                    value={planningData[field.key] || ''}
                    onValueChange={(value) => handleFieldChange(field.key, value)}
                    className="space-y-2"
                  >
                    {field.options.map((option) => (
                      <label
                        key={option.value}
                        className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                          planningData[field.key] === option.value
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/30'
                        }`}
                        data-testid={`${field.key}-${option.value}`}
                      >
                        <RadioGroupItem value={option.value} className="mt-0.5" />
                        <div>
                          <p className="font-medium">{option.label}</p>
                          {option.description && (
                            <p className="text-sm text-muted-foreground">{option.description}</p>
                          )}
                        </div>
                      </label>
                    ))}
                  </RadioGroup>
                )}
                
                {field.type === 'checkbox' && (
                  <div className="space-y-2">
                    {field.options.map((option) => (
                      <label
                        key={option.value}
                        className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                          (planningData[field.key] || []).includes(option.value)
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/30'
                        }`}
                        data-testid={`${field.key}-${option.value}`}
                      >
                        <Checkbox
                          checked={(planningData[field.key] || []).includes(option.value)}
                          onCheckedChange={(checked) => handleCheckboxChange(field.key, option.value, checked)}
                        />
                        <span className="font-medium">{option.label}</span>
                      </label>
                    ))}
                  </div>
                )}
                
                {field.type === 'textarea' && (
                  <Textarea
                    value={planningData[field.key] || ''}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="min-h-[100px]"
                    data-testid={`${field.key}-textarea`}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </main>
      
      {/* Bottom Navigation */}
      {!showResults && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-border safe-area-pb">
          <div className="page-container">
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={goToPrev}
                disabled={currentStep === 0}
                className="flex-1 btn-clinical"
                data-testid="prev-btn"
              >
                <ChevronLeft className="h-5 w-5 mr-1" />
                Back
              </Button>
              
              <Button
                onClick={goToNext}
                disabled={analyzing}
                className="flex-1 btn-clinical bg-primary text-primary-foreground"
                data-testid="next-btn"
              >
                {analyzing ? 'Analyzing...' : currentStep === PLANNING_STEPS.length - 1 ? 'Analyze' : 'Next'}
                {!analyzing && <ChevronRight className="h-5 w-5 ml-1" />}
              </Button>
            </div>
            
            {/* Save progress link */}
            <button
              onClick={saveProgress}
              disabled={saving}
              className="w-full mt-3 text-sm text-muted-foreground hover:text-primary"
              data-testid="save-progress-btn"
            >
              {saving ? 'Saving...' : 'Save progress'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
