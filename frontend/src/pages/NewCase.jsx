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
import AppLayout from '@/layout/AppLayout';
import CaseSummary from '@/components/CaseSummary';

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
  const [showSummary, setShowSummary] = useState(false);
  const [caseDraft, setCaseDraft] = useState(null);
  const [formData, setFormData] = useState({
    patientName: '',
    caseTitle: '',
    toothNumber: '',
    optionalAge: '',
    optionalSex: '',
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
      const [teamResponse, userResponse] = await Promise.all([
        axios.get('/api/team'),
        axios.get('/api/user/me')
      ]);

      const clinicianOption = {
        id: userResponse.data.id,
        name: userResponse.data.name || 'Clinician',
        role: userResponse.data.role || 'Clinician'
      };

      const members = teamResponse.data || [];
      const membersWithClinician = members.some((member) => member.id === clinicianOption.id)
        ? members
        : [clinicianOption, ...members];

      setTeamMembers(membersWithClinician);
    } catch (error) {
      console.error('Failed to load team members:', error);
      toast.error('Failed to load team members');
    } finally {
      setTeamLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.patientName.trim() || !formData.caseTitle.trim() || !formData.toothNumber) {
      toast.error('Please fill in required fields');
      return;
    }

    const stageAssignments = WORKFLOW_STAGES
      .filter((stage) => formData.workflowAssignments[stage.key])
      .map((stage) => ({
        stage: stage.key,
        userId: formData.workflowAssignments[stage.key]
      }));

    const payload = {
      patientName: formData.patientName.trim(),
      caseTitle: formData.caseTitle.trim(),
      toothNumber: formData.toothNumber,
      optionalAge: formData.optionalAge ? parseInt(formData.optionalAge, 10) : null,
      optionalSex: formData.optionalSex || null,
      stageAssignments
    };

    setCaseDraft(payload);
    setShowSummary(true);
  };

  const handleConfirmCreate = async () => {
    if (!caseDraft) {
      return;
    }

    setLoading(true);
    try {
      const response = await caseApi.create(caseDraft);
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

  const isValid = formData.patientName.trim() && formData.caseTitle.trim() && formData.toothNumber;
  const teamMemberMap = teamMembers.reduce((acc, member) => {
    acc[member.id] = member;
    return acc;
  }, {});
  const summaryStageAssignments = WORKFLOW_STAGES.map((stage) => {
    const assignedId = (showSummary ? caseDraft : formData)?.workflowAssignments?.[stage.key]
      || caseDraft?.stageAssignments?.find((assignment) => assignment.stage === stage.key)?.userId
      || '';
    const assignedMember = teamMemberMap[assignedId];
    return {
      key: stage.key,
      title: stage.title,
      assigneeName: assignedMember ? `${assignedMember.name} • ${assignedMember.role}` : 'Unassigned'
    };
  });

  return (
    <AppLayout headerContent={
      <div className="px-4 py-4" style={{ background: 'var(--card)' }}>
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
              <p className="text-sm" style={{ color: 'var(--t2)' }}>
                {showSummary ? 'Step 3 of 4 • Case Summary' : 'Step 1-2 of 4 • Case Details & Workflow'}
              </p>
            </div>
          </div>
        </ContentContainer>
      </div>
    }>

      <ContentContainer className="pt-6 pb-8">
        {showSummary ? (
          <CaseSummary
            draft={caseDraft}
            stageAssignments={summaryStageAssignments}
            onEdit={() => setShowSummary(false)}
            onConfirm={handleConfirmCreate}
            loading={loading}
          />
        ) : (
        <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
          <div className="card-clinical flex items-start gap-3">
            <Zap className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'var(--blue)' }} />
            <p className="text-sm" style={{ color: 'var(--t2)' }}>
              Create a case in seconds. Assign responsibility by treatment stage for clear workflow ownership.
            </p>
          </div>

          <div className="card-clinical space-y-6">
            <div className="space-y-2">
              <Label htmlFor="patientName">Patient Name *</Label>
              <Input
                id="patientName"
                value={formData.patientName}
                onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                placeholder="e.g., Ramesh"
                className="input-clinical"
                data-testid="case-name-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="caseTitle">Case Title *</Label>
              <Input
                id="caseTitle"
                value={formData.caseTitle}
                onChange={(e) => setFormData({ ...formData, caseTitle: e.target.value })}
                placeholder="e.g., Implant 46"
                className="input-clinical"
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
            Review Summary
          </Button>
        </form>
        )}
      </ContentContainer>
    </AppLayout>
  );
}
