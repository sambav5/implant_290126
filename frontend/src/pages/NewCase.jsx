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
    helper: 'Choose the dentist responsible for initial diagnosis confirmation and treatment readiness.'
  },
  {
    key: 'IMPLANT_PLANNING',
    title: 'Implant Planning',
    helper: 'Choose the dentist responsible for planning implant position and size.'
  },
  {
    key: 'SURGERY',
    title: 'Surgery',
    helper: 'Choose the operator responsible for implant placement surgery.'
  },
  {
    key: 'PROSTHETIC_DESIGN',
    title: 'Prosthetic Design',
    helper: 'Choose the dentist responsible for restoration design and prosthetic decisions.'
  },
  {
    key: 'ASSISTANT_SUPPORT',
    title: 'Assistant Support',
    helper: 'Choose the team member coordinating assistance and chairside support.'
  }
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
    caseTeam: {
      teamName: '',
      clinician: 'Case Owner',
      implantologist: '',
      prosthodontist: '',
      assistant: '',
      periodontist: ''
    },
    workflowAssignments: {
      DIAGNOSIS: '',
      IMPLANT_PLANNING: '',
      SURGERY: '',
      PROSTHETIC_DESIGN: '',
      ASSISTANT_SUPPORT: ''
    }
  });

  useEffect(() => {
    loadTeamMembers();
  }, []);

  const loadTeamMembers = async () => {
    try {
      const response = await axios.get('/api/team');
      setTeamMembers(response.data || []);
    } catch (error) {
      console.error('Failed to load team members:', error);
    } finally {
      setTeamLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.caseName.trim() || !formData.toothNumber) {
      toast.error('Please fill in required fields');
      return;
    }

    setLoading(true);
    try {
      const stageAssignments = WORKFLOW_STAGES
        .filter((stage) => formData.workflowAssignments[stage.key])
        .map((stage) => ({
          stage: stage.key,
          userId: formData.workflowAssignments[stage.key]
        }));

      const payload = {
        caseName: formData.caseName.trim(),
        toothNumber: formData.toothNumber,
        optionalAge: formData.optionalAge ? parseInt(formData.optionalAge, 10) : null,
        optionalSex: formData.optionalSex || null,
        caseTeam: formData.caseTeam,
        stageAssignments
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
    <div className="min-h-screen pb-24" style={{ background: 'var(--bg)' }}>
      <header className="glass-header sticky top-0 z-40 px-4 py-4">
        <ContentContainer>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 rounded-lg touch-target"
              style={{ background: 'transparent', border: 'none' }}
              onMouseOver={(e) => (e.currentTarget.style.background = 'var(--border)')}
              onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
              data-testid="back-btn"
            >
              <ArrowLeft className="h-5 w-5" style={{ color: 'var(--t2)' }} />
            </button>
            <div>
              <h1 className="text-xl font-semibold" style={{ fontFamily: "'Lora', serif", color: 'var(--t1)' }}>New Case</h1>
              <p className="text-sm" style={{ color: 'var(--t2)' }}>Quick case creation</p>
            </div>
          </div>
        </ContentContainer>
      </header>

      <ContentContainer className="pt-6 pb-8">
        <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
          <div className="card-clinical flex items-start gap-3">
            <Zap className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'var(--blue)' }} />
            <p className="text-sm" style={{ color: 'var(--t2)' }}>
              Create a case in seconds. Assign responsibility by treatment stage for clear workflow ownership.
            </p>
          </div>

          <div className="card-clinical space-y-6">
            <div className="space-y-2">
              <Label htmlFor="caseName">Case Name *</Label>
              <Input
                id="caseName"
                value={formData.caseName}
                onChange={(e) => setFormData({ ...formData, caseName: e.target.value })}
                placeholder="e.g., Upper Right Molar Replacement"
                className="input-clinical"
                data-testid="case-name-input"
              />
            </div>

            <ToothSelector
              value={formData.toothNumber}
              onChange={(value) => setFormData({ ...formData, toothNumber: value })}
              required
              multiple
            />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="optionalAge">Age (Optional)</Label>
                <Input
                  id="optionalAge"
                  type="number"
                  min="1"
                  max="120"
                  value={formData.optionalAge}
                  onChange={(e) => setFormData({ ...formData, optionalAge: e.target.value })}
                  className="input-clinical"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="optionalSex">Sex (Optional)</Label>
                <Select value={formData.optionalSex || '_none'} onValueChange={(value) => setFormData({ ...formData, optionalSex: value === '_none' ? '' : value })}>
                  <SelectTrigger className="input-clinical">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Not specified</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="card-clinical space-y-4" data-testid="case-workflow-assignment">
            <div>
              <h2 className="text-lg font-semibold" style={{ fontFamily: "'Lora', serif", color: 'var(--t1)' }}>Case Workflow</h2>
              <p className="text-sm" style={{ color: 'var(--t3)' }}>Assign one responsible team member per stage.</p>
            </div>

            {WORKFLOW_STAGES.map((stage) => (
              <div key={stage.key} className="p-4 rounded-lg" style={{ border: '1px solid var(--border)', background: 'var(--card)' }}>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--t1)' }}>{stage.title}</h3>
                <Label className="text-xs" style={{ color: 'var(--t2)' }}>Responsible</Label>
                {teamLoading ? (
                  <Input disabled placeholder="Loading team..." className="input-clinical mt-1" />
                ) : (
                  <Select
                    value={formData.workflowAssignments[stage.key] || '_none'}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        workflowAssignments: {
                          ...formData.workflowAssignments,
                          [stage.key]: value === '_none' ? '' : value
                        }
                      })
                    }
                  >
                    <SelectTrigger className="input-clinical mt-1">
                      <SelectValue placeholder="Select team member" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Unassigned</SelectItem>
                      {teamMembers.map((member) => (
                        <SelectItem key={member.id} value={member.id}>{member.name} • {member.role}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-xs mt-2" style={{ color: 'var(--t3)' }}>{stage.helper}</p>
              </div>
            ))}
          </div>

          <Button type="submit" disabled={!isValid || loading} className="w-full" data-testid="create-case-btn">
            {loading ? 'Creating...' : 'Create Case'}
          </Button>
        </form>
      </ContentContainer>
    </div>
  );
}
