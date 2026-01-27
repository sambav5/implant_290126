import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ToothSelector from '@/components/ToothSelector';
import { caseApi } from '@/services/api';
import { toast } from 'sonner';

export default function NewCase() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    caseName: '',
    toothNumber: '',
    optionalAge: '',
    optionalSex: '',
  });
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.caseName.trim() || !formData.toothNumber) {
      toast.error('Please fill in required fields');
      return;
    }
    
    setLoading(true);
    try {
      const payload = {
        caseName: formData.caseName.trim(),
        toothNumber: formData.toothNumber,
        optionalAge: formData.optionalAge ? parseInt(formData.optionalAge) : null,
        optionalSex: formData.optionalSex || null,
      };
      
      const response = await caseApi.create(payload);
      toast.success('Case created successfully');
      navigate(`/case/${response.data.id}`);
    } catch (error) {
      toast.error('Failed to create case');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  
  const isValid = formData.caseName.trim() && formData.toothNumber;
  
  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="glass-header sticky top-0 z-40 px-4 py-4">
        <div className="page-container">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 hover:bg-slate-100 rounded-lg touch-target"
              data-testid="back-btn"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-foreground">New Case</h1>
              <p className="text-sm text-muted-foreground">Quick case creation</p>
            </div>
          </div>
        </div>
      </header>
      
      <main className="page-container py-6">
        <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
          {/* Quick tip */}
          <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/10">
            <Zap className="h-5 w-5 text-primary shrink-0" />
            <p className="text-sm text-muted-foreground">
              Create a case in seconds. Add details later.
            </p>
          </div>
          
          {/* Case Name */}
          <div className="space-y-2">
            <Label htmlFor="caseName" className="text-sm font-medium">
              Case Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="caseName"
              placeholder="e.g., Upper Right Molar Replacement"
              value={formData.caseName}
              onChange={(e) => setFormData({ ...formData, caseName: e.target.value })}
              className="input-clinical"
              autoFocus
              data-testid="case-name-input"
            />
            <p className="text-xs text-muted-foreground">
              A nickname to identify this case
            </p>
          </div>
          
          {/* Tooth Number */}
          <div className="space-y-2">
            <Label htmlFor="toothNumber" className="text-sm font-medium">
              Tooth Number <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.toothNumber}
              onValueChange={(value) => setFormData({ ...formData, toothNumber: value })}
            >
              <SelectTrigger className="input-clinical" data-testid="tooth-number-select">
                <SelectValue placeholder="Select tooth number" />
              </SelectTrigger>
              <SelectContent>
                <div className="p-2 text-xs font-medium text-muted-foreground">Upper Arch</div>
                <div className="grid grid-cols-8 gap-1 px-2 pb-2">
                  {TOOTH_NUMBERS.slice(0, 16).map((num) => (
                    <SelectItem key={num} value={num} className="text-center p-2">
                      {num}
                    </SelectItem>
                  ))}
                </div>
                <div className="p-2 text-xs font-medium text-muted-foreground border-t">Lower Arch</div>
                <div className="grid grid-cols-8 gap-1 px-2 pb-2">
                  {TOOTH_NUMBERS.slice(16).map((num) => (
                    <SelectItem key={num} value={num} className="text-center p-2">
                      {num}
                    </SelectItem>
                  ))}
                </div>
              </SelectContent>
            </Select>
          </div>
          
          {/* Optional Fields */}
          <div className="pt-4 border-t border-border">
            <p className="text-sm font-medium text-muted-foreground mb-4">Optional Details</p>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Age */}
              <div className="space-y-2">
                <Label htmlFor="age" className="text-sm font-medium">
                  Patient Age
                </Label>
                <Input
                  id="age"
                  type="number"
                  placeholder="Years"
                  min="1"
                  max="120"
                  value={formData.optionalAge}
                  onChange={(e) => setFormData({ ...formData, optionalAge: e.target.value })}
                  className="input-clinical"
                  data-testid="age-input"
                />
              </div>
              
              {/* Sex */}
              <div className="space-y-2">
                <Label htmlFor="sex" className="text-sm font-medium">
                  Patient Sex
                </Label>
                <Select
                  value={formData.optionalSex}
                  onValueChange={(value) => setFormData({ ...formData, optionalSex: value })}
                >
                  <SelectTrigger className="input-clinical" data-testid="sex-select">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </form>
      </main>
      
      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-border safe-area-pb">
        <div className="page-container">
          <Button
            onClick={handleSubmit}
            disabled={!isValid || loading}
            className="w-full btn-clinical bg-primary text-primary-foreground hover:bg-primary/90"
            data-testid="create-case-btn"
          >
            {loading ? 'Creating...' : 'Create Case'}
          </Button>
        </div>
      </div>
    </div>
  );
}
