import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronRight, ChevronLeft, AlertTriangle, Activity, Info, Clock, Zap, Shield, Lightbulb, CheckCircle2 } from 'lucide-react';
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
import ContentContainer from '@/components/ui/ContentContainer';
import AppLayout from '@/layout/AppLayout';

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
  low: { label: 'Low Risk', className: 'risk-badge-low', color: 'var(--green)', bgColor: 'var(--green-1)' },
  moderate: { label: 'Moderate', className: 'risk-badge-moderate', color: 'var(--amber)', bgColor: 'var(--amber-1)' },
  high: { label: 'High Risk', className: 'risk-badge-high', color: 'var(--red)', bgColor: 'var(--red-1)' },
};

const complexityConfig = {
  Simple: { color: 'var(--green)', bgColor: 'var(--green-1)', borderColor: 'var(--green-b)' },
  Moderate: { color: 'var(--amber)', bgColor: 'var(--amber-1)', borderColor: 'var(--amber-b)' },
  Complex: { color: 'var(--red)', bgColor: 'var(--red-1)', borderColor: 'var(--red-b)' },
};

export default function PlanningWizard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [planningData, setPlanningData] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [detailedMode, setDetailedMode] = useState(false);
  
  // Stepper state
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState({});
  const [showCompletionAnimation, setShowCompletionAnimation] = useState(false);
  const fieldRefs = useRef({});
  
  useEffect(() => {
    loadCase();
  }, [id]);
  
  const loadCase = async () => {
    try {
      const response = await caseApi.getById(id);
      setCaseData(response.data);
      
      const savedPlanningData = response.data.planningData || {};
      setPlanningData(savedPlanningData);
      
      // Check which steps are complete
      if (savedPlanningData && Object.keys(savedPlanningData).length > 0) {
        const completed = {};
        PLANNING_STEPS.forEach((_, index) => {
          completed[index] = isStepComplete(index, savedPlanningData);
        });
        setCompletedSteps(completed);
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
    if (field.type === 'textarea') return true; // Optional
    
    const value = data[field.key];
    if (field.type === 'checkbox') {
      return Array.isArray(value) && value.length > 0;
    }
    return value !== undefined && value !== null && value !== '';
  };
  
  // Check if a step is complete
  const isStepComplete = (stepIndex, data) => {
    if (!data || Object.keys(data).length === 0) return false;
    const step = PLANNING_STEPS[stepIndex];
    return step.fields.every(field => isFieldFilled(field, data));
  };
  
  // Get next unfilled field in current step
  const getNextUnfilledField = (stepIndex, data) => {
    const step = PLANNING_STEPS[stepIndex];
    return step.fields.find(field => !isFieldFilled(field, data));
  };
  
  // Auto-save
  const autoSaveProgress = async (newData) => {
    try {
      await caseApi.update(id, { planningData: newData });
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  };
  
  // Focus field
  const focusField = (fieldKey) => {
    setTimeout(() => {
      const fieldRef = fieldRefs.current[fieldKey];
      if (fieldRef) {
        fieldRef.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };
  
  // Handle field change with auto-progression
  const handleFieldChange = async (fieldKey, value) => {
    const newData = { ...planningData, [fieldKey]: value };
    setPlanningData(newData);
    
    // Auto-save
    autoSaveProgress(newData);
    
    // Check if current step is now complete
    const stepComplete = isStepComplete(currentStep, newData);
    setCompletedSteps(prev => ({ ...prev, [currentStep]: stepComplete }));
    
    if (stepComplete) {
      // Step completed! Show animation and auto-advance
      setShowCompletionAnimation(true);
      
      setTimeout(() => {
        setShowCompletionAnimation(false);
        if (currentStep < PLANNING_STEPS.length - 1) {
          setCurrentStep(prev => prev + 1);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          // All steps complete
          toast.success('All sections complete! Ready to analyze.');
        }
      }, 500);
    } else {
      // Find and focus next unfilled field
      const nextField = getNextUnfilledField(currentStep, newData);
      if (nextField) {
        focusField(nextField.key);
      }
    }
  };
  
  const handleCheckboxChange = (key, value, checked) => {
    const currentValues = planningData[key] || [];
    const newValues = checked
      ? [...currentValues, value]
      : currentValues.filter(v => v !== value);
    handleFieldChange(key, newValues);
  };
  
  const handleTextareaChange = (key, value) => {
    handleFieldChange(key, value);
  };
  
  const goToNextStep = () => {
    if (currentStep < PLANNING_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      handleAnalyze();
    }
  };
  
  const goToPrevStep = () => {
    if (showResults) {
      setShowResults(false);
      setCurrentStep(PLANNING_STEPS.length - 1);
    } else if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  
  const handleAnalyze = async () => {
    const allComplete = PLANNING_STEPS.every((_, index) => isStepComplete(index, planningData));
    
    if (!allComplete) {
      toast.error('Please complete all required fields before analyzing');
      return;
    }
    
    setAnalyzing(true);
    try {
      await caseApi.update(id, { planningData });
      trackPlanningCompleted(id, planningData);
      
      const response = await caseApi.analyze(id);
      setCaseData(prev => ({ ...prev, riskAssessment: response.data }));
      trackRiskAnalysisRun(id, response.data);
      
      setShowResults(true);
      toast.success('Assessment complete');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      toast.error('Failed to analyze');
    } finally {
      setAnalyzing(false);
    }
  };
  
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
  const currentStepData = PLANNING_STEPS[currentStep];
  const risk = caseData?.riskAssessment ? riskConfig[caseData.riskAssessment.overallRisk] : null;
  const isCurrentStepComplete = completedSteps[currentStep];
  
  const footerActions = !showResults ? (
    <ContentContainer>
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={goToPrevStep}
          disabled={currentStep === 0}
          className="flex-1 btn-clinical btn-secondary-endo min-h-[44px]"
          data-testid="prev-btn"
        >
          <ChevronLeft className="h-5 w-5 mr-1" />
          Back
        </Button>

        <Button
          onClick={goToNextStep}
          disabled={analyzing}
          className="flex-1 btn-clinical btn-primary-endo min-h-[44px]"
          data-testid="next-btn"
        >
          {analyzing ? 'Analyzing...' : currentStep === PLANNING_STEPS.length - 1 ? 'Analyze' : 'Next'}
          {!analyzing && <ChevronRight className="h-5 w-5 ml-1" />}
        </Button>
      </div>

      <p className="text-center mt-2 text-xs mono" style={{color: 'var(--t3)'}}>
        Auto-saves on every change • {progress}% complete
      </p>
    </ContentContainer>
  ) : null;

  return (
    <AppLayout
      headerContent={
        <div className="px-4 py-4" style={{background: 'var(--card)'}}>
        <ContentContainer>
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
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold truncate" style={{fontFamily: "'Lora', serif", color: 'var(--t1)'}}>
                Planning Engine
              </h1>
              <p className="text-sm" style={{color: 'var(--t2)'}}>{caseData?.caseName}</p>
            </div>
          </div>
          
          {/* Step Progress Indicator */}
          {!showResults && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                {PLANNING_STEPS.map((step, index) => {
                  const isCompleted = completedSteps[index];
                  const isActive = index === currentStep;
                  const isPending = index > currentStep && !isCompleted;
                  
                  return (
                    <div key={step.id} className="flex items-center flex-1">
                      <div className="flex flex-col items-center">
                        {/* Step Indicator */}
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all"
                          style={{
                            background: isCompleted ? 'var(--green)' : isActive ? 'var(--blue)' : 'var(--border)',
                            color: isCompleted || isActive ? 'var(--color-champagne)' : 'var(--t3)',
                            border: isActive ? '2px solid var(--blue)' : 'none',
                            boxShadow: isActive ? '0 0 0 4px var(--blue-1)' : 'none'
                          }}
                        >
                          {isCompleted ? '✓' : index + 1}
                        </div>
                        
                        {/* Step Label */}
                        <span 
                          className="text-xs mt-2 text-center mono hidden sm:block"
                          style={{
                            color: isCompleted ? 'var(--green)' : isActive ? 'var(--blue)' : 'var(--t3)',
                            fontWeight: isActive ? 600 : 400,
                            maxWidth: '80px'
                          }}
                        >
                          {step.id.replace(/_/g, ' ').substring(0, 10)}
                        </span>
                      </div>
                      
                      {/* Connector Line */}
                      {index < PLANNING_STEPS.length - 1 && (
                        <div 
                          className="flex-1 h-[2px] mx-2"
                          style={{
                            background: isCompleted ? 'var(--green)' : 'var(--border)',
                            marginTop: '-24px'
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* Overall Progress Bar */}
              <div className="mt-4">
                <div className="flex justify-between text-xs mb-2">
                  <span className="mono" style={{color: 'var(--t2)', textTransform: 'uppercase'}}>
                    Step {currentStep + 1} of {PLANNING_STEPS.length}
                  </span>
                  <span className="font-medium mono" style={{color: 'var(--t1)'}}>{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            </div>
          )}
        </ContentContainer>
      </div>
      }
      footerActions={footerActions}
    >
      <ContentContainer className="py-6">
        {/* Results View */}
        {showResults && caseData?.riskAssessment && (
          <div className="space-y-5 animate-fade-in">
            {/* Clinical Depth Toggle */}
            <div className="card-clinical">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{background: 'var(--green-1)'}}>
                    {detailedMode ? <Lightbulb className="h-5 w-5" style={{color: 'var(--green)'}} /> : <Zap className="h-5 w-5" style={{color: 'var(--green)'}} />}
                  </div>
                  <div>
                    <p className="font-semibold" style={{color: 'var(--t1)'}}>Clinical Depth</p>
                    <p className="text-sm" style={{color: 'var(--t2)'}}>
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
                      <p className="text-sm mb-1 label-endo">Primary Clinical Issue</p>
                      <h3 className="text-lg font-semibold" style={{fontFamily: "'Lora', serif", color: 'var(--t1)'}}>
                        {caseData.riskAssessment.primaryIssue || 'Standard Implant Placement'}
                      </h3>
                    </div>
                    <span 
                      className="px-2 py-1 rounded text-xs font-medium"
                      style={{
                        background: complexityConfig[caseData.riskAssessment.caseComplexity]?.bgColor,
                        color: complexityConfig[caseData.riskAssessment.caseComplexity]?.color,
                        border: `1px solid ${complexityConfig[caseData.riskAssessment.caseComplexity]?.borderColor}`
                      }}
                    >
                      {caseData.riskAssessment.caseComplexity || 'Moderate'}
                    </span>
                  </div>
                  
                  {/* Implant Timing */}
                  <div className="flex items-center gap-2 p-3 rounded-lg mb-3" style={{background: 'var(--card)', border: '1px solid var(--border)'}}>
                    <Clock className="h-4 w-4 shrink-0" style={{color: 'var(--t3)'}} />
                    <p className="text-sm" style={{color: 'var(--t1)'}}>
                      <span className="font-medium">Timing: </span>
                      {caseData.riskAssessment.implantTiming || 'Conventional placement protocol'}
                    </p>
                  </div>
                  
                  {/* Brief Rationale */}
                  <p className="text-sm italic" style={{color: 'var(--t2)'}}>
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
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold" style={{background: 'var(--green-1)', color: 'var(--green)'}}>1</div>
                    <h4 className="font-semibold" style={{color: 'var(--t1)'}}>Primary Clinical Issue</h4>
                  </div>
                  <p className="leading-relaxed" style={{color: 'var(--t1)'}}>
                    {caseData.riskAssessment.primaryIssueExpanded || caseData.riskAssessment.plainLanguageSummary}
                  </p>
                </div>
                
                {/* 2. Case Complexity + Drivers */}
                <div className="card-clinical">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold" style={{background: 'var(--green-1)', color: 'var(--green)'}}>2</div>
                    <h4 className="font-semibold" style={{color: 'var(--t1)'}}>Case Complexity</h4>
                    <span 
                      className="ml-auto px-2 py-1 rounded text-xs font-medium"
                      style={{
                        background: complexityConfig[caseData.riskAssessment.caseComplexity]?.bgColor,
                        color: complexityConfig[caseData.riskAssessment.caseComplexity]?.color,
                        border: `1px solid ${complexityConfig[caseData.riskAssessment.caseComplexity]?.borderColor}`
                      }}
                    >
                      {caseData.riskAssessment.caseComplexity || 'Moderate'}
                    </span>
                  </div>
                  
                  {caseData.riskAssessment.complexityDrivers?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm" style={{color: 'var(--t2)'}}>Contributing factors:</p>
                      <ul className="space-y-1.5">
                        {caseData.riskAssessment.complexityDrivers.map((driver, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm">
                            <span style={{color: 'var(--green)'}} className="mt-1">•</span>
                            <span style={{color: 'var(--t1)'}}>{driver}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                
                {/* 3. Implant Timing Recommendation */}
                <div className="card-clinical">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold" style={{background: 'var(--green-1)', color: 'var(--green)'}}>3</div>
                    <h4 className="font-semibold" style={{color: 'var(--t1)'}}>Implant Timing</h4>
                  </div>
                  
                  <div className="flex items-center gap-2 p-3 rounded-lg mb-3" style={{background: 'var(--card)', border: '1px solid var(--border)'}}>
                    <Clock className="h-4 w-4 shrink-0" style={{color: 'var(--t3)'}} />
                    <p className="text-sm font-medium" style={{color: 'var(--t1)'}}>
                      {caseData.riskAssessment.implantTiming || 'Conventional placement protocol'}
                    </p>
                  </div>
                  
                  {/* Immediate Placement Eligibility */}
                  {caseData.riskAssessment.immediatePlacementEligible !== null && (
                    <div className="p-3 rounded-lg" style={{
                      background: caseData.riskAssessment.immediatePlacementEligible ? 'var(--green-1)' : 'var(--amber-1)',
                      border: `1px solid ${caseData.riskAssessment.immediatePlacementEligible ? 'var(--green-b)' : 'var(--amber-b)'}`
                    }}>
                      <p className="text-sm font-medium mb-2" style={{
                        color: caseData.riskAssessment.immediatePlacementEligible ? 'var(--green)' : 'var(--amber)'
                      }}>
                        {caseData.riskAssessment.immediatePlacementEligible 
                          ? '✓ Immediate placement may be considered'
                          : '⚠ Immediate placement not recommended'}
                      </p>
                      {caseData.riskAssessment.immediatePlacementReasons?.length > 0 && (
                        <ul className="space-y-1">
                          {caseData.riskAssessment.immediatePlacementReasons.map((reason, index) => (
                            <li key={index} className="text-sm flex items-start gap-2" style={{color: 'var(--t2)'}}>
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
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold" style={{background: 'var(--green-1)', color: 'var(--green)'}}>4</div>
                      <h4 className="font-semibold" style={{color: 'var(--t1)'}}>Risk Modifiers Detected</h4>
                    </div>
                    <div className="space-y-2">
                      {caseData.riskAssessment.riskModifiers.map((modifier, index) => (
                        <div key={index} className="flex items-start gap-2 text-sm p-2 rounded" style={{background: 'var(--amber-1)'}}>
                          <Shield className="h-4 w-4 shrink-0 mt-0.5" style={{color: 'var(--amber)'}} />
                          <span style={{color: 'var(--t1)'}}>{modifier}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* 5. Clinical Rationale */}
                {caseData.riskAssessment.clinicalRationale?.length > 0 && (
                  <div className="card-clinical">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold" style={{background: 'var(--green-1)', color: 'var(--green)'}}>5</div>
                      <h4 className="font-semibold" style={{color: 'var(--t1)'}}>Clinical Rationale</h4>
                    </div>
                    <ul className="space-y-2">
                      {caseData.riskAssessment.clinicalRationale.map((rationale, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <Info className="h-4 w-4 shrink-0 mt-0.5" style={{color: 'var(--blue)'}} />
                          <span style={{color: 'var(--t1)'}}>{rationale}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* 6. Backup Awareness (Complex cases only) */}
                {caseData.riskAssessment.backupAwareness && (
                  <div className="p-4 rounded-lg" style={{background: 'var(--card)', border: '1.5px solid var(--border)'}}>
                    <div className="flex items-start gap-2">
                      <Lightbulb className="h-4 w-4 shrink-0 mt-0.5" style={{color: 'var(--t3)'}} />
                      <p className="text-sm italic" style={{color: 'var(--t2)'}}>
                        {caseData.riskAssessment.backupAwareness}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Disclaimer */}
            <div className="p-4 rounded-lg" style={{background: 'var(--card)', border: '1.5px solid var(--border)'}}>
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{color: 'var(--t3)'}} />
                <p className="disclaimer-text">
                  Decision support only. These considerations are suggestions based on the information provided. 
                  Final clinical judgment lies with the treating clinician.
                </p>
              </div>
            </div>
            
            <Button
              onClick={() => navigate(`/case/${id}/prosthetic-checklist`)}
              className="w-full btn-clinical btn-primary-endo"
              data-testid="proceed-checklists-btn"
            >
              Continue to Treatment Blueprint
              <ChevronRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
        )}
        
        {/* Current Step Content */}
        {!showResults && currentStepData && (
          <div className="animate-fade-in">
            {/* Step Header */}
            <div className="mb-8">
              <h2 className="text-3xl font-semibold mb-3" style={{fontFamily: "'Lora', serif", color: 'var(--t1)'}}>
                {currentStepData.title}
              </h2>
              <p className="text-base" style={{color: 'var(--t2)'}}>
                {currentStepData.description}
              </p>
            </div>
            
            {/* Divider */}
            <div className="flex items-center gap-4 mb-8">
              <div className="flex-1 h-[2px]" style={{background: 'var(--border2)'}}></div>
            </div>
            
            {/* Completion Animation Overlay */}
            {showCompletionAnimation && (
              <div className="fixed inset-0 z-50 flex items-center justify-center" style={{background: 'rgba(26, 25, 23, 0.5)'}}>
                <div className="card-clinical p-8 text-center animate-slide-up" style={{background: 'var(--green-1)', border: '2px solid var(--green)'}}>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{background: 'var(--green)'}}>
                    <CheckCircle2 className="h-10 w-10" style={{color: 'var(--color-champagne)'}} />
                  </div>
                  <h3 className="text-xl font-semibold mb-2" style={{color: 'var(--green)', fontFamily: "'Lora', serif"}}>
                    Step Complete!
                  </h3>
                  <p className="text-sm" style={{color: 'var(--green)'}}>Moving to next section...</p>
                </div>
              </div>
            )}
            
            {/* Fields */}
            <div className="space-y-8">
              {currentStepData.fields.map((field) => {
                const isFilled = isFieldFilled(field, planningData);
                
                return (
                  <div 
                    key={field.key} 
                    ref={el => fieldRefs.current[field.key] = el}
                    className="space-y-4"
                  >
                    {/* Field Label */}
                    <div className="flex items-center justify-between">
                      <Label className="text-lg font-medium flex items-center gap-3" style={{color: 'var(--t1)'}}>
                        {field.label}
                        {field.type === 'textarea' && (
                          <span className="text-xs mono" style={{color: 'var(--t3)', textTransform: 'none', fontWeight: 'normal'}}>
                            (Optional)
                          </span>
                        )}
                        {isFilled && field.type !== 'textarea' && (
                          <span className="text-sm" style={{color: 'var(--green)'}}>✓ Complete</span>
                        )}
                      </Label>
                    </div>
                    
                    {/* Radio Group */}
                    {field.type === 'radio' && (
                      <RadioGroup
                        value={planningData[field.key] || ''}
                        onValueChange={(value) => handleFieldChange(field.key, value)}
                        className="space-y-3"
                      >
                        {field.options.map((option) => (
                          <label
                            key={option.value}
                            className="flex items-start gap-4 p-5 rounded-lg cursor-pointer transition-all"
                            style={{
                              border: planningData[field.key] === option.value 
                                ? '2px solid var(--green)' 
                                : '1.5px solid var(--border)',
                              background: planningData[field.key] === option.value 
                                ? 'var(--green-1)' 
                                : 'var(--card)'
                            }}
                          >
                            <RadioGroupItem value={option.value} className="mt-0.5" />
                            <div className="flex-1">
                              <p className="font-semibold mb-1" style={{color: 'var(--t1)'}}>{option.label}</p>
                              {option.description && (
                                <p className="text-sm" style={{color: 'var(--t2)'}}>{option.description}</p>
                              )}
                            </div>
                          </label>
                        ))}
                      </RadioGroup>
                    )}
                    
                    {/* Checkbox Group */}
                    {field.type === 'checkbox' && (
                      <div className="space-y-3">
                        {field.options.map((option) => (
                          <label
                            key={option.value}
                            className="flex items-center gap-4 p-5 rounded-lg cursor-pointer transition-all"
                            style={{
                              border: (planningData[field.key] || []).includes(option.value)
                                ? '2px solid var(--green)'
                                : '1.5px solid var(--border)',
                              background: (planningData[field.key] || []).includes(option.value)
                                ? 'var(--green-1)'
                                : 'var(--card)'
                            }}
                          >
                            <Checkbox
                              checked={(planningData[field.key] || []).includes(option.value)}
                              onCheckedChange={(checked) => handleCheckboxChange(field.key, option.value, checked)}
                            />
                            <span className="font-semibold" style={{color: 'var(--t1)'}}>{option.label}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    
                    {/* Textarea */}
                    {field.type === 'textarea' && (
                      <Textarea
                        value={planningData[field.key] || ''}
                        onChange={(e) => handleTextareaChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="min-h-[120px] input-clinical text-base"
                      />
                    )}
                    
                    {/* Divider after each field */}
                    {currentStepData.fields.indexOf(field) < currentStepData.fields.length - 1 && (
                      <div className="pt-8">
                        <div className="h-[1px]" style={{background: 'var(--border)'}}></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </ContentContainer>
      
    </AppLayout>
  );
}
