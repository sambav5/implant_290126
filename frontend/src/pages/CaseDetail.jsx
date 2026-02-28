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
  planning: { label: 'Planning', className: 'status-planning px-2 py-1 text-xs rounded-md border mono', icon: FileText },
  in_progress: { label: 'In Progress', className: 'status-in-progress px-2 py-1 text-xs rounded-md border mono', icon: Play },
  completed: { label: 'Completed', className: 'status-completed px-2 py-1 text-xs rounded-md border mono', icon: CheckCircle2 },
};

const riskConfig = {
  low: { label: 'Low Risk', className: 'risk-badge-low', color: 'var(--green)' },
  moderate: { label: 'Moderate', className: 'risk-badge-moderate', color: 'var(--amber)' },
  high: { label: 'High Risk', className: 'risk-badge-high', color: 'var(--red)' },
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
      <div className="min-h-screen flex items-center justify-center" style={{background: 'var(--bg)'}}>
        <div className="animate-pulse mono" style={{color: 'var(--t3)'}}>Loading...</div>
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
    <div className="min-h-screen pb-24" style={{background: 'var(--bg)'}}>
      {/* Header */}
      <header className="glass-header sticky top-0 z-40 px-4 py-4">
        <div className="page-container">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/')}
                className="p-2 -ml-2 rounded-lg touch-target"
                style={{background: 'transparent', border: 'none'}}
                onMouseOver={(e) => e.currentTarget.style.background = 'var(--border)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                data-testid="back-btn"
              >
                <ArrowLeft className="h-5 w-5" style={{color: 'var(--t2)'}} />
              </button>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold truncate" style={{fontFamily: "'Lora', serif", color: 'var(--t1)'}}>{caseData.caseName}</h1>
                <p className="text-sm mono" style={{color: 'var(--t2)'}}>Tooth #{caseData.toothNumber}</p>
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
              <div className="flex items-center justify-center w-10 h-10 rounded-lg font-semibold text-sm" 
                   style={{
                     background: 'var(--green-1)', 
                     color: 'var(--green)', 
                     border: '1.5px solid var(--green-b)',
                     fontFamily: "'Lora', serif"
                   }}>
                {caseData.toothNumber}
              </div>
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
                <span className="label-endo">Age:</span>
                <span className="ml-2 font-medium" style={{color: 'var(--t1)'}}>{caseData.optionalAge} years</span>
              </div>
            )}
            {caseData.optionalSex && (
              <div>
                <span className="label-endo">Sex:</span>
                <span className="ml-2 font-medium capitalize" style={{color: 'var(--t1)'}}>{caseData.optionalSex}</span>
              </div>
            )}
            <div>
              <span className="label-endo">Created:</span>
              <span className="ml-2 font-medium" style={{color: 'var(--t1)'}}>
                {new Date(caseData.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
          
          {/* Status Change Buttons */}
          <div className="flex gap-2 mt-4 pt-4" style={{borderTop: '1px solid var(--border)'}}>
            {caseData.status === 'planning' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatusChange('in_progress')}
                className="flex-1 btn-clinical btn-secondary-endo"
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
                className="flex-1 btn-clinical btn-green-endo"
                data-testid="complete-case-btn"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark Complete
              </Button>
            )}
            {caseData.status === 'completed' && caseData.feedback?.reflectionCompletedAt && (
              <div className="flex items-center gap-2 text-sm" style={{color: 'var(--green)'}}>
                <CheckCircle2 className="h-4 w-4" />
                <span className="mono" style={{fontSize: '10px', textTransform: 'uppercase'}}>Learning reflection completed</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Risk Assessment (if available) */}
        {caseData.riskAssessment && (
          <div className="card-clinical animate-slide-up stagger-1">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-5 w-5" style={{color: risk.color}} />
              <h3 className="font-semibold" style={{color: 'var(--t1)', fontFamily: "'Lora', serif"}}>Risk Assessment</h3>
            </div>
            <p className="text-sm mb-3" style={{color: 'var(--t2)'}}>
              {caseData.riskAssessment.plainLanguageSummary}
            </p>
            {caseData.riskAssessment.considerations?.length > 0 && (
              <div className="space-y-2">
                {caseData.riskAssessment.considerations.slice(0, 3).map((consideration, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{color: 'var(--amber)'}} />
                    <span style={{color: 'var(--t1)'}}>{consideration}</span>
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
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{background: 'var(--blue-1)'}}>
                  <FileText className="h-5 w-5" style={{color: 'var(--blue)'}} />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold" style={{color: 'var(--t1)'}}>Planning Engine</h3>
                  <p className="text-sm" style={{color: 'var(--t2)'}}>
                    {caseData.riskAssessment ? 'Review and update' : 'Complete assessment'}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5" style={{color: 'var(--t3)'}} />
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
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{background: '#F3F0FF'}}>
                  <CheckSquare className="h-5 w-5" style={{color: '#6D28D9'}} />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold" style={{color: 'var(--t1)'}}>Treatment Blueprint</h3>
                  <p className="text-sm" style={{color: 'var(--t2)'}}>
                    Your comprehensive implant workflow — in one place
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5" style={{color: 'var(--t3)'}} />
            </div>
          </button>
          
          {/* Learning Reflections */}
          <button
            onClick={() => navigate(`/case/${id}/learning`)}
            className="card-clinical-interactive w-full animate-slide-up stagger-5"
            data-testid="learning-btn"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{background: 'var(--amber-1)'}}>
                  <Lightbulb className="h-5 w-5" style={{color: 'var(--amber)'}} />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold" style={{color: 'var(--t1)'}}>Learning Reflections</h3>
                  <p className="text-sm" style={{color: 'var(--t2)'}}>
                    {caseData.feedback?.reflectionCompletedAt 
                      ? 'View your reflections' 
                      : 'Capture insights to make every case seamless'}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5" style={{color: 'var(--t3)'}} />
            </div>
          </button>
        </div>
        
        {/* Timeline (Recent Activity) */}
        {caseData.timeline?.length > 0 && (
          <div className="card-clinical animate-slide-up stagger-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5" style={{color: 'var(--t3)'}} />
              <h3 className="font-semibold" style={{color: 'var(--t1)', fontFamily: "'Lora', serif"}}>Recent Activity</h3>
            </div>
            <div className="space-y-4">
              {(() => {
                // Filter out noisy "Case updated" entries and deduplicate
                const meaningfulEntries = caseData.timeline
                  .filter(entry => {
                    // Skip generic "Case updated" with only technical field names
                    if (entry.action === 'Case updated' && entry.details) {
                      // Skip if details only contains field names like ['planningData', 'updatedAt']
                      if (entry.details.startsWith('[') && entry.details.includes("'")) {
                        return false;
                      }
                    }
                    return true;
                  })
                  .slice(-5)
                  .reverse();
                
                // Format entries with better labels
                const formatAction = (action, details) => {
                  const actionMap = {
                    'Case created': { label: 'Case created', icon: '✓' },
                    'Risk assessment completed': { label: 'Risk assessment completed', icon: '✓' },
                    'Status changed': { label: 'Status updated', icon: '↻' },
                    'Checklist updated': { label: 'Checklist progress saved', icon: '✓' },
                    'Planning completed': { label: 'Planning completed', icon: '✓' },
                    'Feedback submitted': { label: 'Learning reflection saved', icon: '✓' },
                  };
                  return actionMap[action] || { label: action, icon: '○' };
                };
                
                const formatDetails = (action, details) => {
                  if (!details) return null;
                  // Clean up technical details
                  if (details.startsWith('Overall:')) return details.replace('Overall:', 'Risk Level:');
                  if (details.startsWith('to ')) return details.charAt(0).toUpperCase() + details.slice(1);
                  return details;
                };
                
                return meaningfulEntries.length > 0 ? (
                  meaningfulEntries.map((entry) => {
                    const formatted = formatAction(entry.action, entry.details);
                    const cleanDetails = formatDetails(entry.action, entry.details);
                    
                    return (
                      <div key={entry.id} className="timeline-entry">
                        <p className="text-sm font-medium" style={{color: 'var(--t1)'}}>
                          {formatted.label}
                        </p>
                        {cleanDetails && (
                          <p className="text-xs" style={{color: 'var(--t2)'}}>{cleanDetails}</p>
                        )}
                        <p className="text-xs mono mt-1" style={{color: 'var(--t3)'}}>
                          {new Date(entry.timestamp).toLocaleString()}
                        </p>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm" style={{color: 'var(--t3)'}}>No recent activity</p>
                );
              })()}
            </div>
          </div>
        )}
        
        {/* Disclaimer */}
        <div className="p-4 rounded-lg" style={{background: 'var(--card)', border: '1.5px solid var(--border)'}}>
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{color: 'var(--t3)'}} />
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
