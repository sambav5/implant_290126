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
    cssColor: 'var(--blue)',
    cssBg: 'var(--blue-1)',
    cssBorder: 'var(--blue-b)',
  },
  treatment: {
    label: 'Treatment',
    shortLabel: 'Tx',
    description: 'Surgical steps, reminders',
    cssColor: 'var(--amber)',
    cssBg: 'var(--amber-1)',
    cssBorder: 'var(--amber-b)',
  },
  post_treatment: {
    label: 'Post-Treatment',
    shortLabel: 'Post',
    description: 'Healing, follow-ups, restoration',
    cssColor: 'var(--green)',
    cssBg: 'var(--green-1)',
    cssBorder: 'var(--green-b)',
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
      className="flex items-start gap-3 p-4 rounded-lg transition-all"
      style={{
        background: item.completed ? 'var(--green-1)' : 'var(--card)',
        border: item.completed ? '1.5px solid var(--green-b)' : '1.5px solid var(--border)',
        opacity: item.completed ? 0.8 : 1
      }}
      data-testid={`checklist-item-${item.id}`}
    >
      <button
        onClick={() => onToggle(item.id)}
        className="shrink-0 touch-target flex items-center justify-center"
        data-testid={`toggle-${item.id}`}
      >
        {item.completed ? (
          <CheckCircle2 className="h-6 w-6" style={{color: 'var(--green)'}} />
        ) : (
          <Circle className="h-6 w-6" style={{color: 'var(--border2)'}} />
        )}
      </button>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm ${item.completed ? 'line-through' : ''}`} style={{color: item.completed ? 'var(--t3)' : 'var(--t1)'}}>
            {item.text}
          </p>
          {item.isCustom && (
            <span className="shrink-0 px-2 py-0.5 rounded mono" style={{background: 'var(--blue-1)', color: 'var(--blue)', fontSize: '9px', textTransform: 'uppercase', border: '1px solid var(--blue-b)'}}>
              Custom
            </span>
          )}
        </div>
        
        {item.completedAt && (
          <p className="text-xs mt-1 flex items-center gap-1 mono" style={{color: 'var(--t3)'}}>
            <Clock className="h-3 w-3" />
            {new Date(item.completedAt).toLocaleString()}
          </p>
        )}
        
        {/* Notes toggle */}
        {!showNotes && !item.notes && (
          <button
            onClick={() => setShowNotes(true)}
            className="text-xs hover:underline mt-2"
            style={{color: 'var(--green)'}}
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
            className="mt-2 text-sm min-h-[60px] input-clinical"
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
      <div className="min-h-screen flex items-center justify-center" style={{background: 'var(--bg)'}}>
        <div className="animate-pulse mono" style={{color: 'var(--t3)'}}>Loading...</div>
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
    <div className="min-h-screen pb-32" style={{background: 'var(--bg)'}}>
      {/* Header */}
      <header className="glass-header sticky top-0 z-40 px-4 py-4">
        <div className="page-container">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/case/${id}`)}
              className="p-2 -ml-2 rounded-lg touch-target"
              style={{background: 'transparent', border: 'none'}}
              onMouseOver={(e) => e.currentTarget.style.background = 'var(--border)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              data-testid="back-btn"
            >
              <ArrowLeft className="h-5 w-5" style={{color: 'var(--t2)'}} />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold truncate" style={{fontFamily: "'Lora', serif", color: 'var(--t1)'}}>Checklists</h1>
              <p className="text-sm mono" style={{color: 'var(--t2)'}}>
                {overallCompleted}/{overallTotal} completed ({overallProgress}%)
              </p>
            </div>
          </div>
        </div>
      </header>
      
      <main className="page-container py-6">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6" style={{background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: '12px', padding: '4px'}}>
            {Object.entries(PHASE_CONFIG).map(([key, config]) => {
              const checklist = getChecklist(key);
              const completed = checklist.filter(item => item.completed).length;
              const isActive = activeTab === key;
              return (
                <TabsTrigger 
                  key={key} 
                  value={key}
                  className="text-xs sm:text-sm rounded-lg transition-all"
                  style={{
                    background: isActive ? 'var(--t1)' : 'transparent',
                    color: isActive ? 'var(--card)' : 'var(--t2)',
                    fontWeight: isActive ? 600 : 400
                  }}
                  data-testid={`tab-${key}`}
                >
                  <span className="hidden sm:inline">{config.label}</span>
                  <span className="sm:hidden">{config.shortLabel}</span>
                  <span className="ml-2 text-xs mono" style={{opacity: 0.8}}>
                    {completed}/{checklist.length}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>
          
          {Object.keys(PHASE_CONFIG).map((phase) => (
            <TabsContent key={phase} value={phase} className="space-y-4 animate-fade-in">
              {/* Phase Header */}
              <div className="p-4 rounded-lg" style={{background: PHASE_CONFIG[phase].cssBg, border: `1.5px solid ${PHASE_CONFIG[phase].cssBorder}`}}>
                <h2 className="font-semibold" style={{color: PHASE_CONFIG[phase].cssColor, fontFamily: "'Lora', serif"}}>
                  {PHASE_CONFIG[phase].label}
                </h2>
                <p className="text-sm" style={{color: 'var(--t2)'}}>
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
                className="w-full btn-clinical btn-secondary-endo"
                style={{borderStyle: 'dashed'}}
                data-testid="add-item-btn"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Custom Item
              </Button>
            </TabsContent>
          ))}
        </Tabs>
        
        {/* Disclaimer */}
        <div className="mt-8 p-4 rounded-lg" style={{background: 'var(--card)', border: '1.5px solid var(--border)'}}>
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{color: 'var(--t3)'}} />
            <p className="disclaimer-text">
              These checklists are decision support aids. Final clinical judgment 
              and responsibility lies with the treating clinician.
            </p>
          </div>
        </div>
      </main>
      
      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 p-4 safe-area-pb" style={{background: 'var(--card)', borderTop: '1.5px solid var(--border)'}}>
        <div className="page-container">
          {caseData?.status === 'completed' ? (
            <Button
              onClick={() => navigate(`/case/${id}/learning`)}
              className="w-full btn-clinical btn-green-endo"
              data-testid="continue-learning-btn"
            >
              <Lightbulb className="h-5 w-5 mr-2" />
              Complete Learning Reflection
              <ChevronRight className="h-5 w-5 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={() => navigate(`/case/${id}`)}
              className="w-full btn-clinical btn-primary-endo"
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
