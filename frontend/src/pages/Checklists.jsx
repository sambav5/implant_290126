import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, CheckCircle2, Circle, Clock, AlertTriangle, ChevronRight, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { caseApi, checklistApi } from '@/services/api';
import { toast } from 'sonner';

const PHASE_CONFIG = {
  pre_treatment: {
    label: 'Pre-Treatment',
    shortLabel: 'Pre',
    description: 'Diagnostics, planning, consent',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  treatment: {
    label: 'Treatment',
    shortLabel: 'Tx',
    description: 'Surgical steps, reminders',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
  },
  post_treatment: {
    label: 'Post-Treatment',
    shortLabel: 'Post',
    description: 'Healing, follow-ups, restoration',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
  },
};

const ChecklistItem = ({ item, onToggle, onUpdateNotes }) => {
  const [showNotes, setShowNotes] = useState(!!item.notes);
  const [notes, setNotes] = useState(item.notes || '');
  
  const handleNotesBlur = () => {
    if (notes !== item.notes) {
      onUpdateNotes(item.id, notes);
    }
  };
  
  return (
    <div 
      className={`checklist-item ${item.completed ? 'bg-emerald-50/50' : ''}`}
      data-testid={`checklist-item-${item.id}`}
    >
      <button
        onClick={() => onToggle(item.id)}
        className="shrink-0 touch-target flex items-center justify-center"
        data-testid={`toggle-${item.id}`}
      >
        {item.completed ? (
          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
        ) : (
          <Circle className="h-6 w-6 text-slate-300" />
        )}
      </button>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm ${item.completed ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
            {item.text}
          </p>
          {item.isCustom && (
            <Badge variant="outline" className="shrink-0 text-xs">Custom</Badge>
          )}
        </div>
        
        {item.completedAt && (
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(item.completedAt).toLocaleString()}
          </p>
        )}
        
        {/* Notes toggle */}
        {!showNotes && !item.notes && (
          <button
            onClick={() => setShowNotes(true)}
            className="text-xs text-primary hover:underline mt-2"
          >
            Add note
          </button>
        )}
        
        {/* Notes input */}
        {(showNotes || item.notes) && (
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            placeholder="Add a note..."
            className="mt-2 text-sm min-h-[60px]"
            data-testid={`notes-${item.id}`}
          />
        )}
      </div>
    </div>
  );
};

export default function Checklists() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pre_treatment');
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [newItemText, setNewItemText] = useState('');
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    loadCase();
  }, [id]);
  
  const loadCase = async () => {
    try {
      const response = await caseApi.getById(id);
      setCaseData(response.data);
    } catch (error) {
      toast.error('Failed to load case');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };
  
  const getChecklistKey = (phase) => {
    const keyMap = {
      pre_treatment: 'preTreatmentChecklist',
      treatment: 'treatmentChecklist',
      post_treatment: 'postTreatmentChecklist',
    };
    return keyMap[phase];
  };
  
  const getChecklist = (phase) => {
    return caseData?.[getChecklistKey(phase)] || [];
  };
  
  const handleToggle = async (itemId) => {
    const checklistKey = getChecklistKey(activeTab);
    const checklist = [...caseData[checklistKey]];
    const itemIndex = checklist.findIndex(item => item.id === itemId);
    
    if (itemIndex === -1) return;
    
    const item = checklist[itemIndex];
    checklist[itemIndex] = {
      ...item,
      completed: !item.completed,
      completedAt: !item.completed ? new Date().toISOString() : null,
    };
    
    // Optimistic update
    setCaseData(prev => ({ ...prev, [checklistKey]: checklist }));
    
    try {
      await checklistApi.update(id, activeTab, checklist);
    } catch (error) {
      // Revert on error
      loadCase();
      toast.error('Failed to update');
    }
  };
  
  const handleUpdateNotes = async (itemId, notes) => {
    const checklistKey = getChecklistKey(activeTab);
    const checklist = [...caseData[checklistKey]];
    const itemIndex = checklist.findIndex(item => item.id === itemId);
    
    if (itemIndex === -1) return;
    
    checklist[itemIndex] = { ...checklist[itemIndex], notes };
    
    // Optimistic update
    setCaseData(prev => ({ ...prev, [checklistKey]: checklist }));
    
    try {
      await checklistApi.update(id, activeTab, checklist);
    } catch (error) {
      loadCase();
      toast.error('Failed to save note');
    }
  };
  
  const handleAddItem = async () => {
    if (!newItemText.trim()) return;
    
    setSaving(true);
    try {
      const response = await checklistApi.addItem(id, activeTab, { text: newItemText.trim() });
      setCaseData(response.data);
      setNewItemText('');
      setAddItemDialogOpen(false);
      toast.success('Item added');
    } catch (error) {
      toast.error('Failed to add item');
    } finally {
      setSaving(false);
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }
  
  const currentChecklist = getChecklist(activeTab);
  const completedCount = currentChecklist.filter(item => item.completed).length;
  const totalCount = currentChecklist.length;
  const phaseConfig = PHASE_CONFIG[activeTab];
  
  // Calculate overall progress
  const allChecklists = [
    ...getChecklist('pre_treatment'),
    ...getChecklist('treatment'),
    ...getChecklist('post_treatment'),
  ];
  const overallCompleted = allChecklists.filter(item => item.completed).length;
  const overallTotal = allChecklists.length;
  const overallProgress = overallTotal > 0 ? Math.round((overallCompleted / overallTotal) * 100) : 0;
  
  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="glass-header sticky top-0 z-40 px-4 py-4">
        <div className="page-container">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/case/${id}`)}
              className="p-2 -ml-2 hover:bg-slate-100 rounded-lg touch-target"
              data-testid="back-btn"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold text-foreground truncate">Checklists</h1>
              <p className="text-sm text-muted-foreground">
                {overallCompleted}/{overallTotal} completed ({overallProgress}%)
              </p>
            </div>
          </div>
        </div>
      </header>
      
      <main className="page-container py-6">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            {Object.entries(PHASE_CONFIG).map(([key, config]) => {
              const checklist = getChecklist(key);
              const completed = checklist.filter(item => item.completed).length;
              return (
                <TabsTrigger 
                  key={key} 
                  value={key}
                  className="text-xs sm:text-sm"
                  data-testid={`tab-${key}`}
                >
                  <span className="hidden sm:inline">{config.label}</span>
                  <span className="sm:hidden">{config.shortLabel}</span>
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {completed}/{checklist.length}
                  </Badge>
                </TabsTrigger>
              );
            })}
          </TabsList>
          
          {Object.keys(PHASE_CONFIG).map((phase) => (
            <TabsContent key={phase} value={phase} className="space-y-4 animate-fade-in">
              {/* Phase Header */}
              <div className={`p-4 rounded-lg ${PHASE_CONFIG[phase].bgColor}`}>
                <h2 className={`font-semibold ${PHASE_CONFIG[phase].color}`}>
                  {PHASE_CONFIG[phase].label}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {PHASE_CONFIG[phase].description}
                </p>
              </div>
              
              {/* Checklist Items */}
              <div className="space-y-2">
                {getChecklist(phase).map((item) => (
                  <ChecklistItem
                    key={item.id}
                    item={item}
                    onToggle={handleToggle}
                    onUpdateNotes={handleUpdateNotes}
                  />
                ))}
              </div>
              
              {/* Add Item Button */}
              <Button
                variant="outline"
                onClick={() => setAddItemDialogOpen(true)}
                className="w-full border-dashed"
                data-testid="add-item-btn"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Custom Item
              </Button>
            </TabsContent>
          ))}
        </Tabs>
        
        {/* Disclaimer */}
        <div className="mt-8 p-4 bg-muted/50 rounded-lg border border-border">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="disclaimer-text">
              These checklists are decision support aids. Final clinical judgment 
              and responsibility lies with the treating clinician.
            </p>
          </div>
        </div>
      </main>
      
      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-border safe-area-pb">
        <div className="page-container">
          {caseData?.status === 'completed' ? (
            <Button
              onClick={() => navigate(`/case/${id}/learning`)}
              className="w-full btn-clinical bg-accent text-accent-foreground hover:bg-accent/90"
              data-testid="continue-learning-btn"
            >
              <Lightbulb className="h-5 w-5 mr-2" />
              Complete Learning Reflection
              <ChevronRight className="h-5 w-5 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={() => navigate(`/case/${id}`)}
              className="w-full btn-clinical bg-primary text-primary-foreground hover:bg-primary/90"
              data-testid="continue-btn"
            >
              Continue to Case Overview
              <ChevronRight className="h-5 w-5 ml-2" />
            </Button>
          )}
        </div>
      </div>
      
      {/* Add Item Dialog */}
      <Dialog open={addItemDialogOpen} onOpenChange={setAddItemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Checklist Item</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              placeholder="Enter checklist item..."
              className="input-clinical"
              autoFocus
              data-testid="new-item-input"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddItem} 
              disabled={!newItemText.trim() || saving}
              data-testid="confirm-add-item-btn"
            >
              {saving ? 'Adding...' : 'Add Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
