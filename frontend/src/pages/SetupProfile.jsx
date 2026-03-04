import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Building2, MapPin, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { userApi } from '../api/userApi';

const SetupProfile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    clinicName: '',
    clinicAddress: ''
  });

  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }
    
    if (!formData.clinicName.trim() || formData.clinicName.trim().length < 2) {
      newErrors.clinicName = 'Clinic name must be at least 2 characters';
    }
    
    if (!formData.clinicAddress.trim() || formData.clinicAddress.trim().length < 5) {
      newErrors.clinicAddress = 'Address must be at least 5 characters';
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
      const response = await userApi.setupProfile(formData);
      
      // Update session with new onboarding stage
      const sessionData = JSON.parse(localStorage.getItem('clinician_auth_session'));
      sessionData.onboardingStage = response.data.onboardingStage || 'TEAM';
      localStorage.setItem('clinician_auth_session', JSON.stringify(sessionData));
      
      toast.success('Profile setup complete!');
      navigate('/setup-team');
    } catch (error) {
      const message = error?.response?.data?.detail || 'Failed to setup profile';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <Card className="w-full max-w-2xl p-8 space-y-6 shadow-xl">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-blue-100 rounded-full">
              <User className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Setup Your Profile</h1>
          <p className="text-sm text-gray-600">
            Tell us about yourself and your clinic
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            {/* Full Name */}
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <User className="h-4 w-4" />
                Full Name *
              </label>
              <Input
                id="name"
                type="text"
                placeholder="Dr. John Doe"
                value={formData.name}
                onChange={handleChange('name')}
                disabled={loading}
                className={errors.name ? 'border-red-500' : ''}
                autoFocus
              />
              {errors.name && (
                <p className="text-xs text-red-600">{errors.name}</p>
              )}
            </div>

            {/* Clinic Name */}
            <div className="space-y-2">
              <label htmlFor="clinicName" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Clinic Name *
              </label>
              <Input
                id="clinicName"
                type="text"
                placeholder="Dental Care Center"
                value={formData.clinicName}
                onChange={handleChange('clinicName')}
                disabled={loading}
                className={errors.clinicName ? 'border-red-500' : ''}
              />
              {errors.clinicName && (
                <p className="text-xs text-red-600">{errors.clinicName}</p>
              )}
            </div>

            {/* Clinic Address */}
            <div className="space-y-2">
              <label htmlFor="clinicAddress" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Clinic Address *
              </label>
              <textarea
                id="clinicAddress"
                rows="3"
                placeholder="123 Main Street, City, State - 12345"
                value={formData.clinicAddress}
                onChange={handleChange('clinicAddress')}
                disabled={loading}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.clinicAddress ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.clinicAddress && (
                <p className="text-xs text-red-600">{errors.clinicAddress}</p>
              )}
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting up...
              </>
            ) : (
              'Continue to Team Setup'
            )}
          </Button>
        </form>

        <div className="pt-4 border-t border-gray-200">
          <p className="text-xs text-center text-gray-500">
            Step 1 of 2 - Profile Information
          </p>
        </div>
      </Card>
    </div>
  );
};

export default SetupProfile;