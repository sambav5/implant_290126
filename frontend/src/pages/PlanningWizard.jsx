import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, ChevronLeft, AlertTriangle, Activity, Info, Clock, Zap, Shield, Lightbulb } from 'lucide-react';
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
          { value: 'moderate', label: 'Moderate', description: 'Partially visible' },
          { value: 'low', label: 'Low', description: 'Not visible (posterior)' },
        ],
      },
      {
        key: 'softTissueBiotype',
        label: 'Soft Tissue Biotype',
        type: 'radio',
        options: [
          { value: 'thick', label: 'Thick', description: 'More forgiving, lower recession risk' },
          { value: 'moderate', label: 'Moderate', description: 'Average characteristics' },
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
  const [currentStep, setCurrentStep] = useState(0);
  const [planningData, setPlanningData] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [detailedMode, setDetailedMode] = useState(false);
  
  useEffect(() => {
    loadCase();
  }, [id]);
  
  const loadCase = async () => {
    try {
      const response = await caseApi.getById(id);
      setCaseData(response.data);
      if (response.data.planningData) {
        setPlanningData(response.data.planningData);
      }
      if (response.data.riskAssessment) {
        setShowResults(true);
        setCurrentStep(PLANNING_STEPS.length);
      }
    } catch (error) {
      toast.error('Failed to load case');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };
  
  const handleFieldChange = (key, value) => {
    setPlanningData(prev => ({ ...prev, [key]: value }));
  };
  
  const handleCheckboxChange = (key, value, checked) => {
    setPlanningData(prev => {
      const currentValues = prev[key] || [];
      if (checked) {
        return { ...prev, [key]: [...currentValues, value] };
      } else {
        return { ...prev, [key]: currentValues.filter(v => v !== value) };
      }
    });
  };
  
  const saveProgress = async () => {
    setSaving(true);
    try {
      await caseApi.update(id, { planningData });
      toast.success('Progress saved');
    } catch (error) {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };
  
  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      await caseApi.update(id, { planningData });
      const response = await caseApi.analyze(id);
      setCaseData(prev => ({ ...prev, riskAssessment: response.data }));
      setShowResults(true);
      toast.success('Assessment complete');
    } catch (error) {
      toast.error('Failed to analyze');
    } finally {
      setAnalyzing(false);
    }
  };
  
  const goToNext = () => {
    if (currentStep < PLANNING_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleAnalyze();
    }
  };
  
  const goToPrev = () => {
    if (showResults) {
      setShowResults(false);
      setCurrentStep(PLANNING_STEPS.length - 1);
    } else if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }
  
  const progress = showResults ? 100 : Math.round(((currentStep + 1) / PLANNING_STEPS.length) * 100);
  const currentStepData = PLANNING_STEPS[currentStep];
  const risk = caseData?.riskAssessment ? riskConfig[caseData.riskAssessment.overallRisk] : null;
  
  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <header className="glass-header sticky top-0 z-40 px-4 py-4">
        <div className="page-container">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/case/${id}`)}
              className="p-2 -ml-2 hover:bg-slate-100 rounded-lg touch-target"
              data-testid="back-btn"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold text-foreground truncate">Planning Engine</h1>
              <p className="text-sm text-muted-foreground">{caseData?.caseName}</p>
            </div>
          </div>
          
          {/* Progress */}
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">
                {showResults ? 'Assessment Complete' : `Step ${currentStep + 1} of ${PLANNING_STEPS.length}`}
              </span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>
      </header>
      
      <main className="page-container py-6">
        {/* Results View */}
        {showResults && caseData?.riskAssessment && (
          <div className="space-y-6 animate-fade-in">
            <div className="card-clinical">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  risk.className.replace('badge', 'bg').replace('text', 'bg')
                } bg-opacity-20`}>
                  <Activity className={`h-6 w-6 ${risk.color}`} />
                </div>
                <div>
                  <Badge className={risk.className}>{risk.label}</Badge>
                  <p className="text-sm text-muted-foreground mt-1">Risk Assessment</p>
                </div>
              </div>
              
              <p className="text-foreground mb-4">
                {caseData.riskAssessment.plainLanguageSummary}
              </p>
              
              {/* Factors */}
              {caseData.riskAssessment.factors?.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Identified Factors:</p>
                  <div className="flex flex-wrap gap-2">
                    {caseData.riskAssessment.factors.map((factor, index) => (
                      <Badge key={index} variant="secondary">{factor}</Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Considerations */}
              {caseData.riskAssessment.considerations?.length > 0 && (
                <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium">Considerations:</p>
                  {caseData.riskAssessment.considerations.map((consideration, index) => (
                    <div key={index} className="flex items-start gap-2 text-sm">
                      <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{consideration}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
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
              onClick={() => navigate(`/case/${id}/checklists`)}
              className="w-full btn-clinical bg-primary text-primary-foreground"
              data-testid="proceed-checklists-btn"
            >
              Proceed to Checklists
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
