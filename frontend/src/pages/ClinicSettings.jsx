import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { clinicApi } from '../api/clinicApi';
import ProfileMenu from '../components/ProfileMenu';

const ClinicSettings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: ''
  });

  useEffect(() => {
    loadClinic();
  }, []);

  const loadClinic = async () => {
    try {
      const response = await clinicApi.getClinic();
      setFormData({
        name: response.data.name || '',
        address: response.data.address || ''
      });
    } catch (error) {
      toast.error('Failed to load clinic settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      toast.error('Clinic name must be at least 2 characters');
      return;
    }

    setSaving(true);
    try {
      await clinicApi.updateClinic({
        name: formData.name.trim(),
        address: formData.address.trim() || null
      });
      toast.success('Clinic settings updated successfully');
      loadClinic();
    } catch (error) {
      const message = error?.response?.data?.detail || 'Failed to update clinic settings';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{background: 'var(--bg)'}}>
        <Loader2 className="h-8 w-8 animate-spin" style={{color: 'var(--blue)'}} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{background: 'var(--bg)'}}>
      <header className="glass-header sticky top-0 z-40 px-4 py-4">
        <div className="page-container">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="p-2 -ml-2 rounded-lg touch-target"
                style={{background: 'transparent', border: 'none'}}
                onMouseOver={(e) => e.currentTarget.style.background = 'var(--border)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <ArrowLeft className="h-5 w-5" style={{color: 'var(--t2)'}} />
              </button>
              <div>
                <h1 className="text-xl font-semibold" style={{fontFamily: "'Lora', serif", color: 'var(--t1)'}}>Clinic Settings</h1>
                <p className="text-sm" style={{color: 'var(--t2)'}}>Manage your clinic information</p>
              </div>
            </div>
            <ProfileMenu />
          </div>
        </div>
      </header>

      <main className="page-container py-8">
        <Card className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{background: 'var(--green-1)', border: '2px solid var(--green-b)'}}
            >
              <Building2 className="h-8 w-8" style={{color: 'var(--green)'}} />
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{color: 'var(--t1)'}}>{formData.name || 'Clinic'}</h2>
              <p className="text-sm" style={{color: 'var(--t2)'}}>Clinic Information</p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Clinic Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter clinic name"
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Clinic Address</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Enter clinic address"
                disabled={saving}
                rows={4}
              />
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
};

export default ClinicSettings;
