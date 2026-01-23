import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lightbulb, Plus, Check, AlertTriangle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { caseApi, feedbackApi } from '@/services/api';
import { toast } from 'sonner';

export default function LearningLoop() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({
    whatWasUnexpected: '',
    whatToDoubleCheckNextTime: '',
    customChecklistSuggestions: [],
  });
  const [newSuggestion, setNewSuggestion] = useState('');
  const [existingSuggestions, setExistingSuggestions] = useState([]);
  
  useEffect(() => {
    loadData();
  }, [id]);
  
  const loadData = async () => {
    try {
      const [caseResponse, suggestionsResponse] = await Promise.all([
        caseApi.getById(id),
        feedbackApi.getSuggestions(),
      ]);
      
      setCaseData(caseResponse.data);
      setExistingSuggestions(suggestionsResponse.data.suggestions || []);
      
      if (caseResponse.data.feedback) {
        setFeedback({
          whatWasUnexpected: caseResponse.data.feedback.whatWasUnexpected || '',
          whatToDoubleCheckNextTime: caseResponse.data.feedback.whatToDoubleCheckNextTime || '',
          customChecklistSuggestions: caseResponse.data.feedback.customChecklistSuggestions || [],
        });
      }
    } catch (error) {
      toast.error('Failed to load data');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };
  
  const handleAddSuggestion = () => {
    if (!newSuggestion.trim()) return;
    if (feedback.customChecklistSuggestions.includes(newSuggestion.trim())) {
      toast.error('This suggestion already exists');
      return;
    }
    
    setFeedback(prev => ({
      ...prev,
      customChecklistSuggestions: [...prev.customChecklistSuggestions, newSuggestion.trim()],
    }));
    setNewSuggestion('');
  };
  
  const handleRemoveSuggestion = (index) => {
    setFeedback(prev => ({
      ...prev,
      customChecklistSuggestions: prev.customChecklistSuggestions.filter((_, i) => i !== index),
    }));
  };
  
  const handleSubmit = async () => {
    setSaving(true);
    try {
      await feedbackApi.update(id, feedback);
      toast.success('Reflection saved! Your insights will improve future cases.');
      navigate(`/case/${id}`);
    } catch (error) {
      toast.error('Failed to save reflection');
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
  
  const isCompleted = caseData?.feedback?.reflectionCompletedAt;
  
  return (
    <div className="min-h-screen bg-background pb-32">
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
              <h1 className="text-xl font-semibold text-foreground truncate">Learning Reflection</h1>
              <p className="text-sm text-muted-foreground">{caseData?.caseName}</p>
            </div>
          </div>
        </div>
      </header>
      
      <main className="page-container py-6 space-y-6">
        {/* Introduction */}
        <div className="card-clinical animate-slide-up">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
              <Lightbulb className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h2 className="font-semibold">Build Your Clinical Memory</h2>
              <p className="text-sm text-muted-foreground">
                Reflect on this case to improve future planning
              </p>
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Your reflections help create personalized checklist items that appear in future similar cases. 
            This is your private clinical memory—building over time with each case you complete.
          </p>
        </div>
        
        {/* What was unexpected */}
        <div className="space-y-3 animate-slide-up stagger-1">
          <Label className="text-base font-medium">
            What was harder or different than expected?
          </Label>
          <Textarea
            value={feedback.whatWasUnexpected}
            onChange={(e) => setFeedback(prev => ({ ...prev, whatWasUnexpected: e.target.value }))}
            placeholder="e.g., Bone quality was softer than CBCT suggested, required undersizing..."
            className="min-h-[120px]"
            data-testid="unexpected-textarea"
          />
          <p className="text-xs text-muted-foreground">
            This helps you remember case-specific learnings.
          </p>
        </div>
        
        {/* What to double-check */}
        <div className="space-y-3 animate-slide-up stagger-2">
          <Label className="text-base font-medium">
            What would you check more carefully next time?
          </Label>
          <Textarea
            value={feedback.whatToDoubleCheckNextTime}
            onChange={(e) => setFeedback(prev => ({ ...prev, whatToDoubleCheckNextTime: e.target.value }))}
            placeholder="e.g., Always verify bone density with CBCT in anterior maxilla..."
            className="min-h-[120px]"
            data-testid="doublecheck-textarea"
          />
        </div>
        
        {/* Checklist Suggestions */}
        <div className="space-y-3 animate-slide-up stagger-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            <Label className="text-base font-medium">
              Suggest checklist items for future cases
            </Label>
          </div>
          <p className="text-sm text-muted-foreground">
            These items will appear in your pre-treatment checklists for similar cases.
          </p>
          
          {/* Existing suggestions from past cases */}
          {existingSuggestions.length > 0 && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                From your past cases:
              </p>
              <div className="flex flex-wrap gap-2">
                {existingSuggestions.map((suggestion, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {suggestion}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {/* Current suggestions */}
          {feedback.customChecklistSuggestions.length > 0 && (
            <div className="space-y-2">
              {feedback.customChecklistSuggestions.map((suggestion, index) => (
                <div 
                  key={index} 
                  className="flex items-center gap-2 p-3 bg-accent/5 rounded-lg border border-accent/20"
                >
                  <Check className="h-4 w-4 text-accent shrink-0" />
                  <span className="flex-1 text-sm">{suggestion}</span>
                  <button
                    onClick={() => handleRemoveSuggestion(index)}
                    className="text-muted-foreground hover:text-destructive text-sm"
                    data-testid={`remove-suggestion-${index}`}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {/* Add new suggestion */}
          <div className="flex gap-2">
            <Input
              value={newSuggestion}
              onChange={(e) => setNewSuggestion(e.target.value)}
              placeholder="e.g., Verify sinus proximity for upper molars"
              className="input-clinical flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleAddSuggestion()}
              data-testid="new-suggestion-input"
            />
            <Button
              variant="outline"
              onClick={handleAddSuggestion}
              disabled={!newSuggestion.trim()}
              data-testid="add-suggestion-btn"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Disclaimer */}
        <div className="p-4 bg-muted/50 rounded-lg border border-border">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="disclaimer-text">
              Your reflections are stored locally to this app and help personalize your checklists. 
              This is decision support to assist your clinical practice, not a substitute for professional judgment.
            </p>
          </div>
        </div>
      </main>
      
      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-border safe-area-pb">
        <div className="page-container">
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full btn-clinical bg-primary text-primary-foreground"
            data-testid="save-reflection-btn"
          >
            {saving ? 'Saving...' : isCompleted ? 'Update Reflection' : 'Save Reflection'}
          </Button>
        </div>
      </div>
    </div>
  );
}
