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
import { trackCaseCreated } from '@/lib/analytics';

export default function NewCase() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    caseName: '',
    toothNumber: '',
    optionalAge: '',
    optionalSex: '',
    caseTeam: {
      clinician: 'Case Owner',
      implantologist: '',
      prosthodontist: '',
      assistant: ''
    }
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
        caseTeam: formData.caseTeam,
      };
      
      const response = await caseApi.create(payload);
      
      // Track case creation
      trackCaseCreated(response.data);
      
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
    <div className="min-h-screen pb-24" style={{background: 'var(--bg)'}}>
      {/* Header */}
      <header className="glass-header sticky top-0 z-40 px-4 py-4">
        <div className="page-container">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 rounded-lg touch-target"
              style={{background: 'transparent', border: 'none'}}
              onMouseOver={(e) => e.currentTarget.style.background = 'var(--border)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              data-testid="back-btn"
            >
              <ArrowLeft className="h-5 w-5" style={{color: 'var(--t2)'}} />
            </button>
            <div>
              <h1 className="text-xl font-semibold" style={{fontFamily: "'Lora', serif", color: 'var(--t1)'}}>New Case</h1>
              <p className="text-sm" style={{color: 'var(--t2)'}}>Quick case creation</p>
            </div>
          </div>
        </div>
      </header>
      
      <main className="page-container py-8">
        <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
          {/* Quick tip */}
          <div className="card-clinical flex items-start gap-3">
            <Zap className="h-5 w-5 shrink-0 mt-0.5" style={{color: 'var(--blue)'}} />
            <p className="text-sm" style={{color: 'var(--t2)'}}>
              Create a case in seconds. Add details later in Planning Engine.
            </p>
          </div>
          
          {/* Primary Fields */}
          <div className="card-clinical space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-4" style={{fontFamily: "'Lora', serif", color: 'var(--t1)'}}>
                Case Information
              </h2>
              
              {/* Case Name */}
              <div className="space-y-2 mb-6">
                <Label htmlFor="caseName" className="text-sm font-medium" style={{color: 'var(--t1)'}}>
                  Case Name <span style={{color: 'var(--red)'}}>*</span>
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
                <p className="text-xs" style={{color: 'var(--t3)'}}>
                  A nickname to identify this case
                </p>
              </div>
              
              {/* Tooth Number - Visual Selector */}
              <ToothSelector
                value={formData.toothNumber}
                onChange={(value) => setFormData({ ...formData, toothNumber: value })}
                required
                multiple
              />
            </div>
            
            {/* Optional Fields */}
            <div className="pt-4" style={{borderTop: '1px solid var(--border)'}}>
              <p className="text-sm font-medium mb-4 label-endo">Optional Details</p>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Age */}
                <div className="space-y-2">
                  <Label htmlFor="age" className="text-sm font-medium" style={{color: 'var(--t1)'}}>
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
                  <Label htmlFor="sex" className="text-sm font-medium" style={{color: 'var(--t1)'}}>
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
            
            {/* Case Team Assignment */}
            <div className="pt-4" style={{borderTop: '1px solid var(--border)'}}>
              <p className="text-sm font-medium mb-2" style={{color: 'var(--t1)'}}>Assign Team For This Case</p>
              <p className="text-xs mb-4" style={{color: 'var(--t3)'}}>
                Assign names to clinical roles for this case. You can always edit this later.
              </p>
              
              <div className="space-y-3">
                {/* Clinician */}
                <div className="space-y-2">
                  <Label htmlFor="clinician" className="text-sm font-medium flex items-center gap-2" style={{color: 'var(--t1)'}}>
                    <span className="w-24">Clinician</span>
                    <span className="px-2 py-0.5 text-xs font-medium rounded" style={{background: 'var(--blue-1)', color: 'var(--blue)', border: '1px solid var(--blue-b)'}}>
                      Case Owner
                    </span>
                  </Label>
                  <Input
                    id="clinician"
                    placeholder="Your name or designation"
                    value={formData.caseTeam.clinician}
                    onChange={(e) => setFormData({
                      ...formData,
                      caseTeam: { ...formData.caseTeam, clinician: e.target.value }
                    })}
                    className="input-clinical"
                  />
                </div>
                
                {/* Implantologist */}
                <div className="space-y-2">
                  <Label htmlFor="implantologist" className="text-sm font-medium flex items-center gap-2" style={{color: 'var(--t1)'}}>
                    <span className="w-24">Implantologist</span>
                    <span className="text-xs" style={{color: 'var(--t3)'}}>(Optional)</span>
                  </Label>
                  <Input
                    id="implantologist"
                    placeholder="Surgeon handling implant placement"
                    value={formData.caseTeam.implantologist}
                    onChange={(e) => setFormData({
                      ...formData,
                      caseTeam: { ...formData.caseTeam, implantologist: e.target.value }
                    })}
                    className="input-clinical"
                  />
                </div>
                
                {/* Prosthodontist */}
                <div className="space-y-2">
                  <Label htmlFor="prosthodontist" className="text-sm font-medium flex items-center gap-2" style={{color: 'var(--t1)'}}>
                    <span className="w-24">Prosthodontist</span>
                    <span className="text-xs" style={{color: 'var(--t3)'}}>(Optional)</span>
                  </Label>
                  <Input
                    id="prosthodontist"
                    placeholder="Specialist for final restoration"
                    value={formData.caseTeam.prosthodontist}
                    onChange={(e) => setFormData({
                      ...formData,
                      caseTeam: { ...formData.caseTeam, prosthodontist: e.target.value }
                    })}
                    className="input-clinical"
                  />
                </div>
                
                {/* Assistant */}
                <div className="space-y-2">
                  <Label htmlFor="assistant" className="text-sm font-medium flex items-center gap-2" style={{color: 'var(--t1)'}}>
                    <span className="w-24">Assistant</span>
                    <span className="text-xs" style={{color: 'var(--t3)'}}>(Optional)</span>
                  </Label>
                  <Input
                    id="assistant"
                    placeholder="Clinical assistant or coordinator"
                    value={formData.caseTeam.assistant}
                    onChange={(e) => setFormData({
                      ...formData,
                      caseTeam: { ...formData.caseTeam, assistant: e.target.value }
                    })}
                    className="input-clinical"
                  />
                </div>
              </div>
            </div>
          </div>
        </form>
      </main>
      
      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 safe-area-pb" style={{background: 'var(--card)', borderTop: '1.5px solid var(--border)'}}>
        <div className="page-container">
          <Button
            onClick={handleSubmit}
            disabled={!isValid || loading}
            className="w-full btn-clinical btn-primary-endo"
            data-testid="create-case-btn"
          >
            {loading ? 'Creating...' : 'Create Case'}
          </Button>
        </div>
      </div>
    </div>
  );
}
