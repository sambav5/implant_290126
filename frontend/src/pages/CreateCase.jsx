import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, User, Users, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { caseApi } from '../api/caseApi';

const CreateCase = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [teamLoading, setTeamLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState([]);
  const [formData, setFormData] = useState({
    patientName: '',
    caseTitle: '',
    assignedImplantologistId: '',
    assignedProsthodontistId: '',
    assignedAssistantId: ''
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

  const implantologists = teamMembers.filter(m => m.role === 'Implantologist');
  const prosthodontists = teamMembers.filter(m => m.role === 'Prosthodontist');
  const assistants = teamMembers.filter(m => m.role === 'Assistant');

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    setLoading(true);
    try {
      await caseApi.createCase({
        patientName: formData.patientName,
        caseTitle: formData.caseTitle,
        assignedImplantologistId: formData.assignedImplantologistId || null,
        assignedProsthodontistId: formData.assignedProsthodontistId || null,
        assignedAssistantId: formData.assignedAssistantId || null
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
            {/* Patient Details */}
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

            {/* Team Assignment */}
            <div className="space-y-4 pt-4 border-t border-divider">
              <div>
                <h2 className="text-lg font-semibold text-charcoal flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Assign Team For This Case
                </h2>
                <p className="text-sm text-warmgray mt-1">
                  Assign names to clinical roles for this case. You can always edit this later.
                </p>
              </div>

              {/* Implantologist */}
              <div className="space-y-2">
                <label htmlFor="implantologist" className="text-sm font-medium text-charcoal">
                  Implantologist (Optional)
                </label>
                <select
                  id="implantologist"
                  value={formData.assignedImplantologistId}
                  onChange={handleChange('assignedImplantologistId')}
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select Implantologist --</option>
                  {implantologists.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
                {implantologists.length === 0 && (
                  <p className="text-xs text-warmgray">No implantologists in your team</p>
                )}
              </div>

              {/* Prosthodontist */}
              <div className="space-y-2">
                <label htmlFor="prosthodontist" className="text-sm font-medium text-charcoal">
                  Prosthodontist (Optional)
                </label>
                <select
                  id="prosthodontist"
                  value={formData.assignedProsthodontistId}
                  onChange={handleChange('assignedProsthodontistId')}
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select Prosthodontist --</option>
                  {prosthodontists.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
                {prosthodontists.length === 0 && (
                  <p className="text-xs text-warmgray">No prosthodontists in your team</p>
                )}
              </div>

              {/* Assistant */}
              <div className="space-y-2">
                <label htmlFor="assistant" className="text-sm font-medium text-charcoal">
                  Assistant (Optional)
                </label>
                <select
                  id="assistant"
                  value={formData.assignedAssistantId}
                  onChange={handleChange('assignedAssistantId')}
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select Assistant --</option>
                  {assistants.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
                {assistants.length === 0 && (
                  <p className="text-xs text-warmgray">No assistants in your team</p>
                )}
              </div>
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