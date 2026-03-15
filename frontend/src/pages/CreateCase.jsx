import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, User, Workflow, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { caseApi } from '../api/caseApi';

const WORKFLOW_STAGES = [
  { stage: 'DIAGNOSIS', title: 'Diagnosis Review', helper: 'Choose the dentist responsible for diagnosis and case readiness.' },
  { stage: 'IMPLANT_PLANNING', title: 'Implant Planning', helper: 'Choose the dentist responsible for implant planning.' },
  { stage: 'SURGERY', title: 'Surgery', helper: 'Choose who is responsible for surgical execution.' },
  { stage: 'PROSTHETIC_DESIGN', title: 'Prosthetic Design', helper: 'Choose who is responsible for restorative/prosthetic design.' },
  { stage: 'ASSISTANT_SUPPORT', title: 'Assistant Support', helper: 'Choose the team member responsible for support and coordination.' },
];

const CreateCase = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [teamLoading, setTeamLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState([]);
  const [formData, setFormData] = useState({
    patientName: '',
    caseTitle: '',
    stageAssignments: {
      DIAGNOSIS: '',
      IMPLANT_PLANNING: '',
      SURGERY: '',
      PROSTHETIC_DESIGN: '',
      ASSISTANT_SUPPORT: '',
    },
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    loadTeamMembers();
  }, []);

  const loadTeamMembers = async () => {
    try {
      const response = await caseApi.getTeam();
      setTeamMembers(response.data);
    } catch (error) {
      toast.error('Failed to load team members');
    } finally {
      setTeamLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.patientName.trim() || formData.patientName.trim().length < 2) {
      newErrors.patientName = 'Patient name must be at least 2 characters';
    }

    if (!formData.caseTitle.trim() || formData.caseTitle.trim().length < 5) {
      newErrors.caseTitle = 'Case title must be at least 5 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field) => (e) => {
    setFormData({ ...formData, [field]: e.target.value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  const handleStageChange = (stage, value) => {
    setFormData((prev) => ({
      ...prev,
      stageAssignments: {
        ...prev.stageAssignments,
        [stage]: value,
      },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    setLoading(true);
    try {
      const stageAssignments = WORKFLOW_STAGES
        .map((item) => ({ stage: item.stage, userId: formData.stageAssignments[item.stage] }))
        .filter((item) => item.userId);

      await caseApi.createCase({
        patientName: formData.patientName,
        caseTitle: formData.caseTitle,
        stageAssignments,
      });

      toast.success('Case created successfully!');
      navigate('/');
    } catch (error) {
      const message = error?.response?.data?.detail || 'Failed to create case';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (teamLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-forest" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-3xl mx-auto pt-8">
        <Card className="p-8 space-y-6 ">
          <div className="space-y-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-blue-100 rounded-full">
                <Briefcase className="h-6 w-6 text-forest" />
              </div>
              <h1 className="text-3xl font-bold text-charcoal">Create Case</h1>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-charcoal flex items-center gap-2">
                <User className="h-5 w-5" />
                Patient Details
              </h2>

              <div className="space-y-2">
                <label htmlFor="patientName" className="text-sm font-medium text-charcoal">
                  Patient Name *
                </label>
                <Input
                  id="patientName"
                  type="text"
                  placeholder="Ramesh Kumar"
                  value={formData.patientName}
                  onChange={handleChange('patientName')}
                  disabled={loading}
                  className={errors.patientName ? 'border-red-500' : ''}
                  autoFocus
                />
                {errors.patientName && (
                  <p className="text-xs text-red-600">{errors.patientName}</p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="caseTitle" className="text-sm font-medium text-charcoal">
                  Case Title *
                </label>
                <Input
                  id="caseTitle"
                  type="text"
                  placeholder="Dental Implant - Tooth 36"
                  value={formData.caseTitle}
                  onChange={handleChange('caseTitle')}
                  disabled={loading}
                  className={errors.caseTitle ? 'border-red-500' : ''}
                />
                {errors.caseTitle && (
                  <p className="text-xs text-red-600">{errors.caseTitle}</p>
                )}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-divider">
              <div>
                <h2 className="text-lg font-semibold text-charcoal flex items-center gap-2">
                  <Workflow className="h-5 w-5" />
                  Case Workflow
                </h2>
                <p className="text-sm text-warmgray mt-1">
                  Assign responsibility by clinical stage. Each stage can be assigned to any team member.
                </p>
              </div>

              {WORKFLOW_STAGES.map((item) => (
                <div key={item.stage} className="space-y-2 p-4 rounded-lg border border-divider bg-gray-50">
                  <label htmlFor={item.stage} className="text-sm font-semibold text-charcoal">
                    {item.title}
                  </label>
                  <select
                    id={item.stage}
                    value={formData.stageAssignments[item.stage] || ''}
                    onChange={(e) => handleStageChange(item.stage, e.target.value)}
                    disabled={loading}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Not assigned --</option>
                    {teamMembers.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name} ({member.role})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-warmgray">{item.helper}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/')}
                disabled={loading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Create Case
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default CreateCase;
