import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  FileText, 
  CheckSquare, 
  Lightbulb, 
  Download, 
  Clock, 
  AlertTriangle,
  Activity,
  ChevronRight,
  MoreVertical,
  Trash2,
  Play,
  CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { caseApi } from '@/services/api';
import { downloadCasePDF } from '@/services/pdfService';
import { toast } from 'sonner';

const statusConfig = {
  planning: { label: 'Planning', className: 'status-planning', icon: FileText },
  in_progress: { label: 'In Progress', className: 'status-in-progress', icon: Play },
  completed: { label: 'Completed', className: 'status-completed', icon: CheckCircle2 },
};

const riskConfig = {
  low: { label: 'Low Risk', className: 'risk-badge-low', color: 'text-emerald-600' },
  moderate: { label: 'Moderate', className: 'risk-badge-moderate', color: 'text-amber-600' },
  high: { label: 'High Risk', className: 'risk-badge-high', color: 'text-red-600' },
};

export default function CaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
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
  
  const handleStatusChange = async (newStatus) => {
    try {
      const response = await caseApi.updateStatus(id, newStatus);
      setCaseData(response.data);
      toast.success(`Status updated to ${statusConfig[newStatus].label}`);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };
  
  const handleDelete = async () => {
    try {
      await caseApi.delete(id);
      toast.success('Case deleted');
      navigate('/');
    } catch (error) {
      toast.error('Failed to delete case');
    }
  };
  
  const handleDownloadPDF = (variant) => {
    if (caseData) {
      downloadCasePDF(caseData, variant);
      toast.success(`${variant === 'lab' ? 'Lab' : 'Dentist'} copy downloaded`);
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }
  
  if (!caseData) return null;
  
  const status = statusConfig[caseData.status] || statusConfig.planning;
  const risk = caseData.riskAssessment ? riskConfig[caseData.riskAssessment.overallRisk] : null;
  
  const totalChecks = [
    ...caseData.preTreatmentChecklist,
    ...caseData.treatmentChecklist,
    ...caseData.postTreatmentChecklist,
  ];
  const completedChecks = totalChecks.filter(item => item.completed).length;
  const checklistProgress = totalChecks.length > 0 ? Math.round((completedChecks / totalChecks.length) * 100) : 0;
  
  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="glass-header sticky top-0 z-40 px-4 py-4">
        <div className="page-container">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/')}
                className="p-2 -ml-2 hover:bg-slate-100 rounded-lg touch-target"
                data-testid="back-btn"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold text-foreground truncate">{caseData.caseName}</h1>
                <p className="text-sm text-muted-foreground">Tooth #{caseData.toothNumber}</p>
              </div>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="case-menu-btn">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleDownloadPDF('dentist')}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Dentist Copy
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownloadPDF('lab')}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Lab Copy
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setDeleteDialogOpen(true)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Case
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      
      <main className="page-container py-6 space-y-6">
        {/* Status & Risk Banner */}
        <div className="card-clinical animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="tooth-badge">{caseData.toothNumber}</div>
              <div>
                <Badge className={status.className}>{status.label}</Badge>
                {risk && (
                  <Badge variant="outline" className={`ml-2 ${risk.className}`}>
                    {risk.label}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          {/* Quick Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            {caseData.optionalAge && (
              <div>
                <span className="text-muted-foreground">Age:</span>
                <span className="ml-2 font-medium">{caseData.optionalAge} years</span>
              </div>
            )}
            {caseData.optionalSex && (
              <div>
                <span className="text-muted-foreground">Sex:</span>
                <span className="ml-2 font-medium capitalize">{caseData.optionalSex}</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Created:</span>
              <span className="ml-2 font-medium">
                {new Date(caseData.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
          
          {/* Status Change Buttons */}
          <div className="flex gap-2 mt-4 pt-4 border-t border-border">
            {caseData.status === 'planning' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatusChange('in_progress')}
                className="flex-1"
                data-testid="start-treatment-btn"
              >
                <Play className="h-4 w-4 mr-2" />
                Start Treatment
              </Button>
            )}
            {caseData.status === 'in_progress' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatusChange('completed')}
                className="flex-1"
                data-testid="complete-case-btn"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark Complete
              </Button>
            )}
            {caseData.status === 'completed' && caseData.feedback?.reflectionCompletedAt && (
              <div className="flex items-center gap-2 text-sm text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>Learning reflection completed</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Risk Assessment (if available) */}
        {caseData.riskAssessment && (
          <div className="card-clinical animate-slide-up stagger-1">
            <div className="flex items-center gap-2 mb-3">
              <Activity className={`h-5 w-5 ${risk.color}`} />
              <h3 className="font-semibold">Risk Assessment</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {caseData.riskAssessment.plainLanguageSummary}
            </p>
            {caseData.riskAssessment.considerations?.length > 0 && (
              <div className="space-y-2">
                {caseData.riskAssessment.considerations.slice(0, 3).map((consideration, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <span>{consideration}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Action Cards */}
        <div className="space-y-3">
          {/* Planning */}
          <button
            onClick={() => navigate(`/case/${id}/planning`)}
            className="card-clinical-interactive w-full animate-slide-up stagger-2"
            data-testid="planning-btn"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold">Planning Engine</h3>
                  <p className="text-sm text-muted-foreground">
                    {caseData.riskAssessment ? 'Review and update' : 'Complete assessment'}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </button>
          
          {/* Treatment Blueprint */}
          <button
            onClick={() => navigate(`/case/${id}/prosthetic-checklist`)}
            className="card-clinical-interactive w-full animate-slide-up stagger-4"
            data-testid="prosthetic-checklist-btn"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <CheckSquare className="h-5 w-5 text-purple-600" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold">Treatment Blueprint</h3>
                  <p className="text-sm text-muted-foreground">
                    Your comprehensive implant workflow — in one place
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </button>
          
          {/* Learning Loop (only show if completed) */}
          {caseData.status === 'completed' && (
            <button
              onClick={() => navigate(`/case/${id}/learning`)}
              className="card-clinical-interactive w-full animate-slide-up stagger-5"
              data-testid="learning-btn"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Lightbulb className="h-5 w-5 text-accent" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold">Learning Reflection</h3>
                    <p className="text-sm text-muted-foreground">
                      {caseData.feedback?.reflectionCompletedAt 
                        ? 'View your reflections' 
                        : 'Capture insights for future cases'}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </button>
          )}
        </div>
        
        {/* Timeline (Recent Activity) */}
        {caseData.timeline?.length > 0 && (
          <div className="card-clinical animate-slide-up stagger-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold">Recent Activity</h3>
            </div>
            <div className="space-y-4">
              {caseData.timeline.slice(-5).reverse().map((entry) => (
                <div key={entry.id} className="timeline-entry">
                  <p className="text-sm font-medium">{entry.action}</p>
                  {entry.details && (
                    <p className="text-xs text-muted-foreground">{entry.details}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(entry.timestamp).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Disclaimer */}
        <div className="p-4 bg-muted/50 rounded-lg border border-border">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="disclaimer-text">
              Decision support only. Final responsibility lies with the clinician.
            </p>
          </div>
        </div>
      </main>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this case?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All case data, checklists, and notes will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-delete-btn"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
