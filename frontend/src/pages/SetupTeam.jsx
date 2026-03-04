import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { teamApi } from '../api/teamApi';
import { userApi } from '../api/userApi';

const ROLES = [
  'Dentist',
  'Assistant',
  'Receptionist',
  'Hygienist',
  'Manager',
  'Other'
];

const SetupTeam = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    role: 'Assistant',
    mobileNumber: ''
  });

  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }
    
    if (!formData.mobileNumber.trim() || formData.mobileNumber.trim().length < 10) {
      newErrors.mobileNumber = 'Please enter a valid mobile number';
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

  const handleAddMember = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    setLoading(true);
    try {
      const response = await teamApi.addMember(formData);
      setMembers([...members, response.data]);
      setFormData({ name: '', role: 'Assistant', mobileNumber: '' });
      
      // Update session to COMPLETED stage
      const sessionData = JSON.parse(localStorage.getItem('clinician_auth_session'));
      sessionData.onboardingStage = 'COMPLETED';
      localStorage.setItem('clinician_auth_session', JSON.stringify(sessionData));
      
      toast.success('Team member added successfully');
      
      // Navigate to dashboard after adding first member
      navigate('/');
    } catch (error) {
      const message = error?.response?.data?.detail || 'Failed to add team member';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    setLoading(true);
    try {
      await userApi.skipTeamSetup();
      
      // Update session to COMPLETED stage
      const sessionData = JSON.parse(localStorage.getItem('clinician_auth_session'));
      sessionData.onboardingStage = 'COMPLETED';
      localStorage.setItem('clinician_auth_session', JSON.stringify(sessionData));
      
      toast.success('Setup complete!');
      navigate('/');
    } catch (error) {
      const message = error?.response?.data?.detail || 'Failed to skip team setup';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = (index) => {
    setMembers(members.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <Card className="w-full max-w-3xl p-8 space-y-6 shadow-xl">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-green-100 rounded-full">
              <Users className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Add Your Team</h1>
          <p className="text-sm text-gray-600">
            Add team members who will work with you (optional)
          </p>
        </div>

        {/* Added Members List */}
        {members.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Team Members ({members.length})</h3>
            {members.map((member, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{member.name}</p>
                  <p className="text-sm text-gray-600">{member.role} • {member.mobileNumber}</p>
                </div>
                <button
                  onClick={() => handleRemoveMember(index)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add Member Form */}
        <form onSubmit={handleAddMember} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium text-gray-700">
                Name *
              </label>
              <Input
                id="name"
                type="text"
                placeholder="Jane Smith"
                value={formData.name}
                onChange={handleChange('name')}
                disabled={loading}
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && (
                <p className="text-xs text-red-600">{errors.name}</p>
              )}
            </div>

            {/* Role */}
            <div className="space-y-2">
              <label htmlFor="role" className="text-sm font-medium text-gray-700">
                Role *
              </label>
              <select
                id="role"
                value={formData.role}
                onChange={handleChange('role')}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Mobile Number */}
          <div className="space-y-2">
            <label htmlFor="mobileNumber" className="text-sm font-medium text-gray-700">
              Mobile Number *
            </label>
            <Input
              id="mobileNumber"
              type="tel"
              placeholder="+91 9876543210"
              value={formData.mobileNumber}
              onChange={handleChange('mobileNumber')}
              disabled={loading}
              className={errors.mobileNumber ? 'border-red-500' : ''}
            />
            {errors.mobileNumber && (
              <p className="text-xs text-red-600">{errors.mobileNumber}</p>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              type="submit"
              className="flex-1"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Member
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleSkip}
              disabled={loading}
              className="flex-1"
            >
              Skip for Now
            </Button>
          </div>
        </form>

        <div className="pt-4 border-t border-gray-200">
          <p className="text-xs text-center text-gray-500">
            Step 2 of 2 - Team Setup (Optional)
          </p>
        </div>
      </Card>
    </div>
  );
};

export default SetupTeam;