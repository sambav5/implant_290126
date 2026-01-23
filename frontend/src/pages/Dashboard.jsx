import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, FileText, ChevronRight, Activity, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { caseApi } from '@/services/api';
import { toast } from 'sonner';

const statusConfig = {
  planning: { label: 'Planning', className: 'status-planning' },
  in_progress: { label: 'In Progress', className: 'status-in-progress' },
  completed: { label: 'Completed', className: 'status-completed' },
};

const riskConfig = {
  low: { label: 'Low Risk', className: 'risk-badge-low' },
  moderate: { label: 'Moderate', className: 'risk-badge-moderate' },
  high: { label: 'High Risk', className: 'risk-badge-high' },
};

export const CaseCard = ({ caseData, onClick }) => {
  const status = statusConfig[caseData.status] || statusConfig.planning;
  const risk = caseData.riskAssessment ? riskConfig[caseData.riskAssessment.overallRisk] : null;
  
  const completedChecks = [
    ...caseData.preTreatmentChecklist,
    ...caseData.treatmentChecklist,
    ...caseData.postTreatmentChecklist,
  ].filter(item => item.completed).length;
  
  const totalChecks = [
    ...caseData.preTreatmentChecklist,
    ...caseData.treatmentChecklist,
    ...caseData.postTreatmentChecklist,
  ].length;
  
  return (
    <button
      onClick={onClick}
      className="card-clinical-interactive w-full text-left animate-fade-in"
      data-testid={`case-card-${caseData.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="tooth-badge shrink-0">{caseData.toothNumber}</div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">{caseData.caseName}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Tooth #{caseData.toothNumber}
              {caseData.optionalAge && ` • ${caseData.optionalAge}y`}
            </p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
      </div>
      
      <div className="flex items-center gap-2 mt-4 flex-wrap">
        <Badge variant="secondary" className={status.className}>
          {status.label}
        </Badge>
        {risk && (
          <Badge variant="outline" className={risk.className}>
            {risk.label}
          </Badge>
        )}
        {totalChecks > 0 && (
          <span className="text-xs text-muted-foreground">
            {completedChecks}/{totalChecks} checks
          </span>
        )}
      </div>
    </button>
  );
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  useEffect(() => {
    loadCases();
  }, []);
  
  const loadCases = async () => {
    try {
      const response = await caseApi.getAll();
      setCases(response.data);
    } catch (error) {
      toast.error('Failed to load cases');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  
  const filteredCases = cases.filter(c => 
    c.caseName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.toothNumber.includes(searchQuery)
  );
  
  const activeCases = filteredCases.filter(c => c.status !== 'completed');
  const completedCases = filteredCases.filter(c => c.status === 'completed');
  
  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="glass-header sticky top-0 z-40 px-4 py-4">
        <div className="page-container">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">ImplantFlow</h1>
              <p className="text-sm text-muted-foreground">Clinical Decision Support</p>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
            </div>
          </div>
        </div>
      </header>
      
      <main className="page-container py-6">
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search cases..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 input-clinical"
            data-testid="search-input"
          />
        </div>
        
        {/* Stats */}
        {!loading && cases.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="card-clinical text-center">
              <p className="text-2xl font-semibold text-foreground">{cases.length}</p>
              <p className="text-xs text-muted-foreground">Total Cases</p>
            </div>
            <div className="card-clinical text-center">
              <p className="text-2xl font-semibold text-amber-600">{activeCases.length}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
            <div className="card-clinical text-center">
              <p className="text-2xl font-semibold text-emerald-600">{completedCases.length}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </div>
        )}
        
        {/* Loading State */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="card-clinical">
                <div className="skeleton h-6 w-1/2 rounded mb-2"></div>
                <div className="skeleton h-4 w-1/3 rounded"></div>
              </div>
            ))}
          </div>
        )}
        
        {/* Empty State */}
        {!loading && cases.length === 0 && (
          <div className="card-clinical text-center py-12 animate-fade-in">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">No cases yet</h2>
            <p className="text-muted-foreground mb-6">
              Create your first implant case to get started
            </p>
            <Button
              onClick={() => navigate('/case/new')}
              className="btn-clinical bg-primary text-primary-foreground hover:bg-primary/90"
              data-testid="create-first-case-btn"
            >
              <Plus className="h-5 w-5 mr-2" />
              Create Case
            </Button>
          </div>
        )}
        
        {/* Active Cases */}
        {!loading && activeCases.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Active Cases
            </h2>
            <div className="space-y-3">
              {activeCases.map((c, index) => (
                <div key={c.id} className={`stagger-${Math.min(index + 1, 5)}`}>
                  <CaseCard 
                    caseData={c} 
                    onClick={() => navigate(`/case/${c.id}`)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Completed Cases */}
        {!loading && completedCases.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Completed
            </h2>
            <div className="space-y-3">
              {completedCases.map(c => (
                <CaseCard 
                  key={c.id} 
                  caseData={c} 
                  onClick={() => navigate(`/case/${c.id}`)}
                />
              ))}
            </div>
          </div>
        )}
        
        {/* Disclaimer */}
        <div className="mt-8 p-4 bg-muted/50 rounded-lg border border-border">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="disclaimer-text">
              Decision support only. Final responsibility lies with the clinician.
              This app assists clinical thinking but does not make treatment decisions.
            </p>
          </div>
        </div>
      </main>
      
      {/* FAB */}
      <Link
        to="/case/new"
        className="fab bg-primary text-primary-foreground"
        data-testid="new-case-fab"
      >
        <Plus className="h-6 w-6" />
      </Link>
    </div>
  );
}
