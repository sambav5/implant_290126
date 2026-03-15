import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Plus, Edit2, Trash2, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { teamApi } from '../api/teamApi';
import ProfileMenu from '../components/ProfileMenu';
import ContentContainer from '@/components/ui/ContentContainer';

const ROLES = ['Assistant', 'Implantologist', 'Prosthodontist', 'Periodontist'];

const TeamManagement = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    role: 'Assistant',
    mobileNumber: ''
  });

  useEffect(() => {
    loadTeam();
  }, []);

  const loadTeam = async () => {
    try {
      const response = await teamApi.getTeam();
      setTeamMembers(response.data);
    } catch (error) {
      toast.error('Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      role: 'Assistant',
      mobileNumber: ''
    });
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      toast.error('Name must be at least 2 characters');
      return;
    }
    
    if (!formData.mobileNumber.trim() || formData.mobileNumber.trim().length < 10) {
      toast.error('Please enter a valid mobile number');
      return;
    }

    setSaving(true);
    try {
      await teamApi.addMember(formData);
      toast.success('Team member added successfully');
      setIsAddDialogOpen(false);
      resetForm();
      loadTeam();
    } catch (error) {
      const message = error?.response?.data?.detail || 'Failed to add team member';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      toast.error('Name must be at least 2 characters');
      return;
    }
    
    if (!formData.mobileNumber.trim() || formData.mobileNumber.trim().length < 10) {
      toast.error('Please enter a valid mobile number');
      return;
    }

    setSaving(true);
    try {
      await teamApi.updateMember(selectedMember.id, formData);
      toast.success('Team member updated successfully');
      setIsEditDialogOpen(false);
      setSelectedMember(null);
      resetForm();
      loadTeam();
    } catch (error) {
      const message = error?.response?.data?.detail || 'Failed to update team member';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await teamApi.deleteMember(selectedMember.id);
      toast.success('Team member removed successfully');
      setIsDeleteDialogOpen(false);
      setSelectedMember(null);
      loadTeam();
    } catch (error) {
      const message = error?.response?.data?.detail || 'Failed to remove team member';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const openEditDialog = (member) => {
    setSelectedMember(member);
    setFormData({
      name: member.name,
      role: member.role,
      mobileNumber: member.mobileNumber
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (member) => {
    setSelectedMember(member);
    setIsDeleteDialogOpen(true);
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
        <ContentContainer>
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
                <h1 className="text-xl font-semibold" style={{fontFamily: "'Lora', serif", color: 'var(--t1)'}}>Team Management</h1>
                <p className="text-sm" style={{color: 'var(--t2)'}}>Manage your clinic team members</p>
              </div>
            </div>
            <ProfileMenu />
          </div>
        </ContentContainer>
      </header>

      <ContentContainer className="py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-lg font-semibold" style={{color: 'var(--t1)'}}>Team Members ({teamMembers.length})</h2>
            <p className="text-sm" style={{color: 'var(--t2)'}}>Add and manage your team members</p>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Team Member
          </Button>
        </div>

        {teamMembers.length === 0 ? (
          <Card className="p-12 text-center">
            <Users className="h-12 w-12 mx-auto mb-4" style={{color: 'var(--t3)'}} />
            <h3 className="text-lg font-semibold mb-2" style={{color: 'var(--t1)'}}>No team members yet</h3>
            <p className="text-sm mb-4" style={{color: 'var(--t2)'}}>
              Start building your team by adding members
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add First Team Member
            </Button>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b" style={{borderColor: 'var(--border)'}}>
                    <th className="text-left p-4 font-medium" style={{color: 'var(--t1)'}}>Name</th>
                    <th className="text-left p-4 font-medium" style={{color: 'var(--t1)'}}>Role</th>
                    <th className="text-left p-4 font-medium" style={{color: 'var(--t1)'}}>Mobile Number</th>
                    <th className="text-right p-4 font-medium" style={{color: 'var(--t1)'}}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teamMembers.map((member) => (
                    <tr key={member.id} className="border-b" style={{borderColor: 'var(--border)'}}>
                      <td className="p-4" style={{color: 'var(--t1)'}}>{member.name}</td>
                      <td className="p-4">
                        <span
                          className="px-2 py-1 text-xs font-medium rounded"
                          style={{
                            background: member.role === 'Implantologist' ? 'var(--blue-1)' : member.role === 'Prosthodontist' ? 'var(--green-1)' : member.role === 'Periodontist' ? 'var(--purple-1)' : 'var(--orange-1)',
                            color: member.role === 'Implantologist' ? 'var(--blue)' : member.role === 'Prosthodontist' ? 'var(--green)' : member.role === 'Periodontist' ? 'var(--purple)' : 'var(--orange)',
                            border: `1px solid ${member.role === 'Implantologist' ? 'var(--blue-b)' : member.role === 'Prosthodontist' ? 'var(--green-b)' : member.role === 'Periodontist' ? 'var(--purple-b)' : 'var(--orange-b)'}`
                          }}
                        >
                          {member.role}
                        </span>
                      </td>
                      <td className="p-4" style={{color: 'var(--t2)'}}>{member.mobileNumber}</td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(member)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteDialog(member)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </ContentContainer>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>
              Add a new member to your clinic team
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="add-name">Name *</Label>
              <Input
                id="add-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter name"
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-role">Role *</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-mobile">Mobile Number *</Label>
              <Input
                id="add-mobile"
                value={formData.mobileNumber}
                onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                placeholder="+91 9876543210"
                disabled={saving}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAddDialogOpen(false);
                  resetForm();
                }}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
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
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team Member</DialogTitle>
            <DialogDescription>
              Update team member information
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter name"
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-role">Role *</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-mobile">Mobile Number *</Label>
              <Input
                id="edit-mobile"
                value={formData.mobileNumber}
                onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                placeholder="+91 9876543210"
                disabled={saving}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setSelectedMember(null);
                  resetForm();
                }}
                disabled={saving}
              >
                Cancel
              </Button>
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
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{selectedMember?.name}</strong> from your team?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={saving}
              className="bg-red-600 hover:bg-red-700"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove Member'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TeamManagement;
