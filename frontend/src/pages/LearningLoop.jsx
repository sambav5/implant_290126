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
import { trackFeedbackSubmitted } from '@/lib/analytics';
import ContentContainer from '@/components/ui/ContentContainer';
import AppLayout from '@/layout/AppLayout';

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
      
      // Track feedback submission
      trackFeedbackSubmitted(id, feedback);
      
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
      <div className="min-h-screen flex items-center justify-center" style={{background: 'var(--bg)'}}>
        <div className="animate-pulse mono" style={{color: 'var(--t3)'}}>Loading...</div>
      </div>
    );
  }
  
  const isCompleted = caseData?.feedback?.reflectionCompletedAt;
  const footerActions = (
    <ContentContainer>
      <Button
        onClick={handleSubmit}
        disabled={saving}
        className="w-full btn-clinical btn-primary-endo min-h-[44px]"
        data-testid="save-reflection-btn"
      >
        {saving ? 'Saving...' : isCompleted ? 'Update Reflection' : 'Save Reflection'}
      </Button>
    </ContentContainer>
  );

  return (
    <AppLayout
      headerContent={
        <div className="px-4 py-4" style={{background: 'var(--card)'}}>
        <ContentContainer>
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
              <h1 className="text-xl font-semibold truncate" style={{fontFamily: "'Lora', serif", color: 'var(--t1)'}}>Learning Reflection</h1>
              <p className="text-sm" style={{color: 'var(--t2)'}}>{caseData?.caseName}</p>
            </div>
          </div>
        </ContentContainer>
      </div>
      }
      footerActions={footerActions}
    >
      <ContentContainer className="py-6 space-y-6">
        {/* Introduction */}
        <div className="card-clinical animate-slide-up">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{background: 'var(--amber-1)'}}>
              <Lightbulb className="h-6 w-6" style={{color: 'var(--amber)'}} />
            </div>
            <div>
              <h2 className="font-semibold" style={{fontFamily: "'Lora', serif", color: 'var(--t1)'}}>Build Your Clinical Memory</h2>
              <p className="text-sm" style={{color: 'var(--t2)'}}>
                Reflect on this case to improve future planning
              </p>
            </div>
          </div>
          
          <p className="text-sm" style={{color: 'var(--t2)'}}>
            Your reflections help create personalized checklist items that appear in future similar cases. 
            This is your private clinical memory—building over time with each case you complete.
          </p>
        </div>
        
        {/* What was unexpected */}
        <div className="space-y-3 animate-slide-up stagger-1">
          <Label className="text-base font-medium" style={{color: 'var(--t1)'}}>
            What was harder or different than expected?
          </Label>
          <Textarea
            value={feedback.whatWasUnexpected}
            onChange={(e) => setFeedback(prev => ({ ...prev, whatWasUnexpected: e.target.value }))}
            placeholder="e.g., Bone quality was softer than CBCT suggested, required undersizing..."
            className="min-h-[120px] input-clinical"
            data-testid="unexpected-textarea"
          />
          <p className="text-xs" style={{color: 'var(--t3)'}}>
            This helps you remember case-specific learnings.
          </p>
        </div>
        
        {/* What to double-check */}
        <div className="space-y-3 animate-slide-up stagger-2">
          <Label className="text-base font-medium" style={{color: 'var(--t1)'}}>
            What would you check more carefully next time?
          </Label>
          <Textarea
            value={feedback.whatToDoubleCheckNextTime}
            onChange={(e) => setFeedback(prev => ({ ...prev, whatToDoubleCheckNextTime: e.target.value }))}
            placeholder="e.g., Always verify bone density with CBCT in anterior maxilla..."
            className="min-h-[120px] input-clinical"
            data-testid="doublecheck-textarea"
          />
        </div>
        
        {/* Checklist Suggestions */}
        <div className="space-y-3 animate-slide-up stagger-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" style={{color: 'var(--amber)'}} />
            <Label className="text-base font-medium" style={{color: 'var(--t1)'}}>
              Suggest checklist items for future cases
            </Label>
          </div>
          <p className="text-sm" style={{color: 'var(--t2)'}}>
            These items will appear in your pre-treatment checklists for similar cases.
          </p>
          
          {/* Existing suggestions from past cases */}
          {existingSuggestions.length > 0 && (
            <div className="p-4 rounded-lg" style={{background: 'var(--card)', border: '1.5px solid var(--border)'}}>
              <p className="text-xs font-medium mb-2 label-endo">
                From your past cases:
              </p>
              <div className="flex flex-wrap gap-2">
                {existingSuggestions.map((suggestion, index) => (
                  <span key={index} className="px-2 py-1 rounded text-xs" style={{background: 'var(--green-1)', color: 'var(--green)', border: '1px solid var(--green-b)'}}>
                    {suggestion}
                  </span>
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
                  className="flex items-center gap-2 p-3 rounded-lg"
                  style={{background: 'var(--green-1)', border: '1.5px solid var(--green-b)'}}
                >
                  <Check className="h-4 w-4 shrink-0" style={{color: 'var(--green)'}} />
                  <span className="flex-1 text-sm" style={{color: 'var(--t1)'}}>{suggestion}</span>
                  <button
                    onClick={() => handleRemoveSuggestion(index)}
                    className="text-sm hover:underline"
                    style={{color: 'var(--red)'}}
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
              className="btn-clinical btn-secondary-endo"
              data-testid="add-suggestion-btn"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Disclaimer */}
        <div className="p-4 rounded-lg" style={{background: 'var(--card)', border: '1.5px solid var(--border)'}}>
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{color: 'var(--t3)'}} />
            <p className="disclaimer-text">
              Your reflections are stored locally to this app and help personalize your checklists. 
              This is decision support to assist your clinical practice, not a substitute for professional judgment.
            </p>
          </div>
        </div>
      </ContentContainer>
      
    </AppLayout>
  );
}
