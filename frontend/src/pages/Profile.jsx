import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { userApi } from '../api/userApi';
import ProfileMenu from '../components/ProfileMenu';

const Profile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [name, setName] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await userApi.getProfile();
      setProfile(response.data);
      setName(response.data.name || '');
    } catch (error) {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    
    if (!name.trim() || name.trim().length < 2) {
      toast.error('Name must be at least 2 characters');
      return;
    }

    setSaving(true);
    try {
      await userApi.updateProfile({ name: name.trim() });
      toast.success('Profile updated successfully');
      loadProfile();
    } catch (error) {
      const message = error?.response?.data?.detail || 'Failed to update profile';
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
    <div className=\"min-h-screen\" style={{background: 'var(--bg)'}}>
      {/* Header */}
      <header className=\"glass-header sticky top-0 z-40 px-4 py-4\">
        <div className=\"page-container\">
          <div className=\"flex items-center justify-between\">
            <div className=\"flex items-center gap-3\">
              <button
                onClick={() => navigate(-1)}
                className=\"p-2 -ml-2 rounded-lg touch-target\"
                style={{background: 'transparent', border: 'none'}}
                onMouseOver={(e) => e.currentTarget.style.background = 'var(--border)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <ArrowLeft className=\"h-5 w-5\" style={{color: 'var(--t2)'}} />
              </button>
              <div>
                <h1 className=\"text-xl font-semibold\" style={{fontFamily: \"'Lora', serif\", color: 'var(--t1)'}}>My Profile</h1>
                <p className=\"text-sm\" style={{color: 'var(--t2)'}}>Manage your personal information</p>
              </div>
            </div>
            <ProfileMenu />
          </div>
        </div>
      </header>

      <main className=\"page-container py-8\">
        <Card className=\"p-6 space-y-6\">
          <div className=\"flex items-center gap-3\">
            <div
              className=\"w-16 h-16 rounded-full flex items-center justify-center\"
              style={{background: 'var(--blue-1)', border: '2px solid var(--blue-b)'}}
            >
              <User className=\"h-8 w-8\" style={{color: 'var(--blue)'}} />
            </div>
            <div>
              <h2 className=\"text-lg font-semibold\" style={{color: 'var(--t1)'}}>{profile?.name || 'Clinician'}</h2>
              <p className=\"text-sm\" style={{color: 'var(--t2)'}}>{profile?.role}</p>
            </div>
          </div>

          <form onSubmit={handleSave} className=\"space-y-4\">
            <div className=\"space-y-2\">
              <Label htmlFor=\"name\">Name</Label>
              <Input
                id=\"name\"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder=\"Enter your name\"
                disabled={saving}
              />
            </div>

            <div className=\"space-y-2\">
              <Label htmlFor=\"mobile\">Mobile Number</Label>
              <Input
                id=\"mobile\"
                value={profile?.mobileNumber || ''}
                disabled
                className=\"bg-gray-50\"
              />
              <p className=\"text-xs\" style={{color: 'var(--t3)'}}>
                Mobile number cannot be changed
              </p>
            </div>

            <div className=\"space-y-2\">
              <Label htmlFor=\"role\">Role</Label>
              <Input
                id=\"role\"
                value={profile?.role || 'Clinician'}
                disabled
                className=\"bg-gray-50\"
              />
            </div>

            <div className=\"flex justify-end pt-4\">
              <Button type=\"submit\" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className=\"mr-2 h-4 w-4 animate-spin\" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className=\"mr-2 h-4 w-4\" />
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

export default Profile;
