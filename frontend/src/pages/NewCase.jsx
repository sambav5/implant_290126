import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ToothSelector from '@/components/ToothSelector';
import { caseApi } from '@/services/api';
import { toast } from 'sonner';
import { trackCaseCreated } from '@/lib/analytics';
import axios from 'axios';
import ContentContainer from '@/components/ui/ContentContainer';

const WORKFLOW_STAGES = [
  {
    key: 'DIAGNOSIS',
    title: 'Diagnosis Review',
    helper: 'Choose the dentist responsible for diagnosis validation and treatment readiness.',
  },
  {
    key: 'IMPLANT_PLANNING',
    title: 'Implant Planning',
    helper: 'Choose the dentist responsible for planning implant position and size.',
  },
  {
    key: 'SURGERY',
    title: 'Surgery',
    helper: 'Choose who is responsible for implant surgery and intra-operative decisions.',
  },
  {
    key: 'PROSTHETIC_DESIGN',
    title: 'Prosthetic Design',
    helper: 'Choose who is responsible for restoration design and final prosthetic planning.',
  },
  {
    key: 'ASSISTANT_SUPPORT',
    title: 'Assistant Support',
    helper: 'Choose the team member coordinating support tasks and stage readiness.',
  },
];

export default function NewCase() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [teamLoading, setTeamLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState([]);
  const [formData, setFormData] = useState({
    caseName: '',
    toothNumber: '',
    optionalAge: '',
    optionalSex: '',
    stageAssignments: {
      DIAGNOSIS: '',
      IMPLANT_PLANNING: '',
      SURGERY: '',
      PROSTHETIC_DESIGN: '',
      ASSISTANT_SUPPORT: '',
    },
  });

  useEffect(() => {
    loadTeamMembers();
  }, []);

  const loadTeamMembers = async () => {
    try {
      const response = await axios.get('/api/team');
      setTeamMembers(response.data);
    } catch (error) {
      console.error('Failed to load team members:', error);
    } finally {
      setTeamLoading(false);
    }
  };

  const handleStageAssignmentChange = (stageKey, value) => {
    setFormData((prev) => ({
      ...prev,
      stageAssignments: {
        ...prev.stageAssignments,
        [stageKey]: value === '_none' ? '' : value,
      },
    }));
  };

  const buildStageAssignmentsPayload = () => {
    return WORKFLOW_STAGES
      .map((stage) => ({ stage: stage.key, userId: formData.stageAssignments[stage.key] }))
      .filter((assignment) => assignment.userId);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.caseName.trim() || !formData.toothNumber) {
      toast.error('Please fill in required fields');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        caseName: formData.caseName.trim(),
        toothNumber: formData.toothNumber,
        optionalAge: formData.optionalAge ? parseInt(formData.optionalAge, 10) : null,
        optionalSex: formData.optionalSex || null,
        stageAssignments: buildStageAssignmentsPayload(),
      };

      const response = await caseApi.create(payload);
      trackCaseCreated(response.data);

      toast.success('Case created successfully');
      navigate(`/case/${response.data.id}`);
    } catch (error) {
      toast.error('Failed to create case');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const isValid = formData.caseName.trim() && formData.toothNumber;

  return (
    <div className="min-h-screen pb-24" style={{background: 'var(--bg)'}}>
      <header className="glass-header sticky top-0 z-40 px-4 py-4">
        <ContentContainer>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 rounded-lg touch-target"
              style={{background: 'transparent', border: 'none'}}
              onMouseOver={(e) => e.currentTarget.style.background = 'var(--border)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              data-testid="back-btn"
            >
              <ArrowLeft className="h-5 w-5" style={{color: 'var(--t2)'}} />
            </button>
            <div>
              <h1 className="text-xl font-semibold" style={{fontFamily: "'Lora', serif", color: 'var(--t1)'}}>New Case</h1>
              <p className="text-sm" style={{color: 'var(--t2)'}}>Quick case creation</p>
            </div>
          </div>
        </ContentContainer>
      </header>

      <ContentContainer className="pt-6 pb-8">
        <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
          <div className="card-clinical flex items-start gap-3">
            <Zap className="h-5 w-5 shrink-0 mt-0.5" style={{color: 'var(--blue)'}} />
            <p className="text-sm" style={{color: 'var(--t2)'}}>
              Create a case in seconds. Add details later in Planning Engine.
            </p>
          </div>

          <div className="card-clinical space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-4" style={{fontFamily: "'Lora', serif", color: 'var(--t1)'}}>
                Case Information
              </h2>

              <div className="space-y-2 mb-6">
                <Label htmlFor="caseName" className="text-sm font-medium" style={{color: 'var(--t1)'}}>
                  Case Name <span style={{color: 'var(--red)'}}>*</span>
                </Label>
                <Input
                  id="caseName"
                  placeholder="e.g., Upper Right Molar Replacement"
                  value={formData.caseName}
                  onChange={(e) => setFormData({ ...formData, caseName: e.target.value })}
                  className="input-clinical"
                  autoFocus
                  data-testid="case-name-input"
                />
                <p className="text-xs" style={{color: 'var(--t3)'}}>
                  A nickname to identify this case
                </p>
              </div>

              <ToothSelector
                value={formData.toothNumber}
                onChange={(value) => setFormData({ ...formData, toothNumber: value })}
                required
                multiple
              />
            </div>

            <div className="pt-4" style={{borderTop: '1.5px solid var(--border)'}}>
              <h3 className="text-lg font-semibold mb-1" style={{fontFamily: "'Lora', serif", color: 'var(--t1)'}}>
                Case Workflow
              </h3>
              <p className="text-sm mb-4" style={{color: 'var(--t2)'}}>
                Assign one responsible person per treatment stage. Dropdowns show all clinic team members.
              </p>

              <div className="space-y-4">
                {WORKFLOW_STAGES.map((stage) => (
                  <div key={stage.key} className="rounded-xl p-4" style={{border: '1.5px solid var(--border)', background: 'var(--card)'}}>
                    <div className="space-y-2">
                      <Label htmlFor={`stage-${stage.key}`} className="text-sm font-semibold" style={{color: 'var(--t1)'}}>
                        {stage.title}
                      </Label>
                      {teamLoading ? (
                        <Input disabled placeholder="Loading team..." className="input-clinical" />
                      ) : (
                        <Select
                          value={formData.stageAssignments[stage.key] || '_none'}
                          onValueChange={(value) => handleStageAssignmentChange(stage.key, value)}
                        >
                          <SelectTrigger id={`stage-${stage.key}`} className="input-clinical">
                            <SelectValue placeholder="Select responsible team member" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">-- Not assigned --</SelectItem>
                            {teamMembers.map((member) => (
                              <SelectItem key={member.id} value={member.id}>
                                {member.name} • {member.role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <p className="text-xs" style={{color: 'var(--t3)'}}>{stage.helper}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </form>
      </ContentContainer>

      <div className="fixed bottom-0 left-0 right-0 p-4 safe-area-pb" style={{background: 'var(--card)', borderTop: '1.5px solid var(--border)'}}>
        <ContentContainer>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || loading}
            className="w-full btn-clinical btn-primary-endo"
            data-testid="create-case-btn"
          >
            {loading ? 'Creating...' : 'Create Case'}
          </Button>
        </ContentContainer>
      </div>
    </div>
  );
}
