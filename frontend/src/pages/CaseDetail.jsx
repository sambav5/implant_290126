import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  FileText, 
  Download, 
  Clock, 
  AlertTriangle,
  Activity,
  ChevronRight,
  MoreVertical,
  Trash2,
  Play,
  CheckCircle2,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { useActiveRole } from '@/hooks/useActiveRole';
import { ROLES } from '@/utils/rolePermissions';
import CaseFilesTab from '@/components/CaseFilesTab';
import SocialPostGenerator from '@/components/social-post/SocialPostGenerator';
import DiscussionTab from '@/components/discussion/DiscussionTab';
import CaseReflection from '@/components/CaseReflection';
import { toast } from 'sonner';
import axios from 'axios';
import ContentContainer from '@/components/ui/ContentContainer';
import AppLayout from '@/layout/AppLayout';

const statusConfig = {
  planning: { label: 'Planning', className: 'bg-blue-100 text-blue-800', icon: FileText },
  in_progress: { label: 'In Progress', className: 'bg-amber-100 text-amber-800', icon: Play },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-800', icon: CheckCircle2 },
};

const riskConfig = {
  low: { label: 'Low Risk', className: 'bg-green-50 text-green-700 border-green-200', color: '#15803d' },
  moderate: { label: 'Moderate', className: 'bg-amber-50 text-amber-700 border-amber-200', color: '#b45309' },
  high: { label: 'High Risk', className: 'bg-red-50 text-red-700 border-red-200', color: '#b91c1c' },
};


const workflowStageLabels = {
  DIAGNOSIS: 'Diagnosis Review',
  IMPLANT_PLANNING: 'Implant Planning',
  SURGERY: 'Surgery',
  PROSTHETIC_DESIGN: 'Prosthetic Design',
  ASSISTANT_SUPPORT: 'Assistant Support',
};

const workflowStageOrder = ['DIAGNOSIS', 'IMPLANT_PLANNING', 'SURGERY', 'PROSTHETIC_DESIGN', 'ASSISTANT_SUPPORT'];

export default function CaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [activeRole] = useActiveRole();
  const [teamMembers, setTeamMembers] = useState([]);
  const [workflowEditMode, setWorkflowEditMode] = useState(false);
  const [savingWorkflow, setSavingWorkflow] = useState(false);
  const [workflowAssignmentsDraft, setWorkflowAssignmentsDraft] = useState({});
  const [updatedStages, setUpdatedStages] = useState([]);
  
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
  const loadWorkflowTeamOptions = async () => {
    try {
      const [teamResponse, userResponse] = await Promise.all([
        axios.get('/api/team'),
        axios.get('/api/user/me')
      ]);

      const clinicianOption = {
        id: userResponse.data.id,
        name: userResponse.data.name || 'Clinician',
        role: userResponse.data.role || 'Clinician'
      };

      const team = teamResponse.data || [];
      const mergedTeam = team.some((member) => member.id === clinicianOption.id)
        ? team
        : [clinicianOption, ...team];

      setTeamMembers(mergedTeam);
    } catch (error) {
      toast.error('Failed to load team members');
    }
  };

  const getAssignmentsMap = (assignments) =>
    (assignments || []).reduce((acc, assignment) => {
      acc[assignment.stage] = assignment.user?.id || '';
      return acc;
    }, {});

  const handleStartWorkflowEdit = async () => {
    if (!teamMembers.length) {
      await loadWorkflowTeamOptions();
    }
    setWorkflowAssignmentsDraft(getAssignmentsMap(caseData.stageAssignments));
    setWorkflowEditMode(true);
  };

  const handleCancelWorkflowEdit = () => {
    setWorkflowAssignmentsDraft(getAssignmentsMap(caseData.stageAssignments));
    setWorkflowEditMode(false);
  };

  const handleSaveWorkflowAssignments = async () => {
    setSavingWorkflow(true);
    try {
      const stageAssignments = workflowStageOrder
        .filter((stage) => workflowAssignmentsDraft[stage])
        .map((stage) => ({
          stage,
          userId: workflowAssignmentsDraft[stage],
        }));

      const response = await caseApi.updateStageAssignments(id, { stageAssignments });
      const latestStageAssignments = response.data.stageAssignments || [];

      const previousMap = getAssignmentsMap(caseData.stageAssignments);
      const latestMap = getAssignmentsMap(latestStageAssignments);
      const changedStages = workflowStageOrder.filter((stage) => previousMap[stage] !== latestMap[stage]);

      setCaseData((prev) => ({
        ...prev,
        stageAssignments: latestStageAssignments,
      }));
      setWorkflowAssignmentsDraft(latestMap);
      setWorkflowEditMode(false);
      setUpdatedStages(changedStages);

      toast.success('Team updated successfully');
      window.setTimeout(() => setUpdatedStages([]), 2200);
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to update team assignments');
    } finally {
      setSavingWorkflow(false);
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
  const assignmentsByStage = (caseData.stageAssignments || []).reduce((acc, assignment) => {
    acc[assignment.stage] = assignment.user;
    return acc;
  }, {});

  const workflowRows = workflowStageOrder.map((stage) => ({
    stage,
    label: workflowStageLabels[stage] || stage,
    user: assignmentsByStage[stage] || null,
  }));
  
  return (
    <AppLayout
      headerContent={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 -ml-2 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#1A1A1A] transition-colors"
              data-testid="back-btn"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-[#1A1A1A] tracking-tight">{caseData.caseName}</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-[#F3F4F6] text-[#4B5563] text-sm font-medium">
                Tooth {caseData.toothNumber}
              </span>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-[#6B7280] hover:bg-[#F3F4F6]" data-testid="case-menu-btn">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => handleDownloadPDF('dentist')} className="cursor-pointer">
                <Download className="h-4 w-4 mr-2" />
                Dentist Copy
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownloadPDF('lab')} className="cursor-pointer">
                <Download className="h-4 w-4 mr-2" />
                Lab Copy
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setDeleteDialogOpen(true)}
                className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Case
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    >
      <ContentContainer className="py-6 space-y-6">
        <div className="flex gap-6 border-b border-[#E5E7EB] mb-6">
          {['Overview', 'Notes', 'Files', 'Social Media Post', 'Discussion', 'Reflection'].map((tab) => {
            const key = tab.toLowerCase().replace(/\s+/g, '-');
            const isActive = (activeTab === 'overview' && key === 'overview') || (activeTab === 'files' && key === 'files') || (activeTab === 'social-media-post' && key === 'social-media-post') || (activeTab === 'discussion' && key === 'discussion') || (activeTab === 'reflection' && key === 'reflection');
            if (key === 'social-media-post' && activeRole === ROLES.ASSISTANT) return null;
            return (
              <button
                key={key}
                onClick={() => {
                  if (['overview', 'files', 'social-media-post', 'discussion', 'reflection'].includes(key)) setActiveTab(key);
                  else toast.info(`${tab} tab is unchanged in this release.`);
                }}
                className={`pb-3 text-sm font-medium transition-colors relative ${isActive ? 'text-[#1F7A63]' : 'text-[#6B7280] hover:text-[#1A1A1A]'}`}
              >
                {tab}
                {isActive && (
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#1F7A63] rounded-t-full" />
                )}
              </button>
            );
          })}
        </div>

        {activeTab === 'files' ? (
          <CaseFilesTab caseId={id} canDeleteFiles={activeRole === ROLES.CLINICIAN} />
        ) : activeTab === 'social-media-post' ? (
          <SocialPostGenerator caseId={id} caseData={caseData} activeRole={activeRole} />
        ) : activeTab === 'discussion' ? (
          <DiscussionTab caseId={id} caseData={caseData} activeRole={activeRole} />
        ) : activeTab === 'reflection' ? (
          <CaseReflection caseId={id} />
        ) : (
          <>
        {/* Status & Risk Banner */}
        <div className="card-clinical">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-[#F3F4F6] text-[#1A1A1A] font-semibold text-lg border border-[#E5E7EB]">
                {caseData.toothNumber}
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm text-[#6B7280] uppercase tracking-wider font-medium">Status</span>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-md text-sm font-medium ${status.className}`}>
                    {status.label}
                  </span>
                  {risk && (
                    <span className={`px-2.5 py-0.5 rounded-md text-sm font-medium border ${risk.className}`}>
                      {risk.label}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Quick Info */}
          <div className="grid grid-cols-3 gap-6 text-sm bg-[#F9FAFB] p-4 rounded-lg border border-[#E5E7EB]">
            {caseData.optionalAge && (
              <div>
                <span className="text-[#6B7280] block mb-1">Age</span>
                <span className="font-medium text-[#1A1A1A]">{caseData.optionalAge} years</span>
              </div>
            )}
            {caseData.optionalSex && (
              <div>
                <span className="text-[#6B7280] block mb-1">Sex</span>
                <span className="font-medium text-[#1A1A1A] capitalize">{caseData.optionalSex}</span>
              </div>
            )}
            <div>
              <span className="text-[#6B7280] block mb-1">Created</span>
              <span className="font-medium text-[#1A1A1A]">
                {new Date(caseData.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
          
          {/* Status Change Buttons */}
          <div className="flex gap-3 mt-6 pt-6 border-t border-[#E5E7EB]">
            {caseData.status === 'planning' && (
              <button
                onClick={() => handleStatusChange('in_progress')}
                className="flex-1 inline-flex justify-center items-center gap-2 bg-[#1F7A63] text-white py-2 px-4 rounded-lg font-medium hover:bg-[#17604D] transition-colors"
                data-testid="start-treatment-btn"
              >
                <Play className="h-4 w-4" />
                Start Treatment
              </button>
            )}
            {caseData.status === 'in_progress' && (
              <button
                onClick={() => handleStatusChange('completed')}
                className="flex-1 inline-flex justify-center items-center gap-2 bg-white text-[#1F7A63] border border-[#1F7A63] py-2 px-4 rounded-lg font-medium hover:bg-[#1F7A63]/5 transition-colors"
                data-testid="complete-case-btn"
              >
                <CheckCircle2 className="h-4 w-4" />
                Mark Complete
              </button>
            )}
            {caseData.status === 'completed' && caseData.feedback?.reflectionCompletedAt && (
              <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                <CheckCircle2 className="h-4 w-4" />
                <span className="font-medium">Learning reflection completed</span>
              </div>
            )}
          </div>
        </div>

        <div className="card-clinical" data-testid="case-workflow-timeline">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg text-[#1A1A1A]">Your Team</h3>
            {activeRole === ROLES.CLINICIAN && !workflowEditMode && (
              <Button type="button" variant="outline" size="sm" onClick={handleStartWorkflowEdit}>
                Edit Team
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {workflowRows.map((row) => {
              const rowUpdated = updatedStages.includes(row.stage);
              const rowClassName = rowUpdated ? 'border-green-300 bg-green-50 transition-all duration-500' : '';

              return (
                <div
                  key={row.stage}
                  className={`rounded-md border p-3 ${rowClassName}`}
                  style={{ borderColor: rowUpdated ? '#86efac' : 'var(--border)' }}
                >
                  <p className="text-sm font-semibold mb-2" style={{ color: 'var(--t1)' }}>{row.label}</p>
                  {workflowEditMode ? (
                    <Select
                      value={workflowAssignmentsDraft[row.stage] || '_none'}
                      onValueChange={(value) =>
                        setWorkflowAssignmentsDraft((prev) => ({
                          ...prev,
                          [row.stage]: value === '_none' ? '' : value,
                        }))
                      }
                    >
                      <SelectTrigger className="input-clinical">
                        <SelectValue placeholder="Select responsible" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Unassigned</SelectItem>
                        {teamMembers.map((member) => (
                          <SelectItem key={member.id} value={member.id}>{member.name} • {member.role}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="mono text-sm" style={{ color: 'var(--t2)' }}>{row.user?.name || 'Unassigned'}</p>
                  )}
                </div>
              );
            })}
          </div>

          {workflowEditMode && (
            <div className="flex gap-2 mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelWorkflowEdit}
                disabled={savingWorkflow}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveWorkflowAssignments}
                disabled={savingWorkflow}
                className="flex-1"
              >
                {savingWorkflow ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          )}
        </div>

        {/* Risk Assessment (if available) */}
        {caseData.riskAssessment && (
          <div className="card-clinical bg-red-50/30 border-red-100">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-5 w-5 text-red-600" />
              <h3 className="font-semibold text-lg text-[#1A1A1A]">Risk Assessment</h3>
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
        
        <div className="space-y-4">
          <button
            onClick={() => navigate(`/case/${id}/gate`)}
            className="card-clinical-interactive w-full text-left"
            data-testid="gate-flow-btn"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-blue-50 border border-blue-100">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-[#1A1A1A]">Case Intelligence</h3>
                  <p className="text-sm text-[#6B7280]">Patient brief + adaptive checklist</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-[#9CA3AF]" />
            </div>
          </button>

          {/* <button
            onClick={() => navigate(`/case/${id}/planning`)}
            className="card-clinical-interactive w-full animate-slide-up stagger-2"
            data-testid="planning-btn"
          >
            ...Planning Engine card intentionally hidden in this flow update...
          </button> */}

          {/* <button
            onClick={() => navigate(`/case/${id}/prosthetic-checklist`)}
            className="card-clinical-interactive w-full animate-slide-up stagger-4"
            data-testid="prosthetic-checklist-btn"
          >
            ...Treatment Blueprint card intentionally hidden in this flow update...
          </button> */}

          {/* <button
            onClick={() => navigate(`/case/${id}/learning`)}
            className="card-clinical-interactive w-full animate-slide-up stagger-5"
            data-testid="learning-btn"
          >
            ...Learning Reflection card intentionally hidden in this flow update...
          </button> */}

          {/* Recent Activity - Clickable Card */}
          {caseData.timeline?.length > 0 && (
            <button
              onClick={() => setActivityModalOpen(true)}
              className="card-clinical-interactive w-full text-left"
              data-testid="recent-activity-btn"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#F3F4F6] border border-[#E5E7EB]">
                    <Clock className="h-6 w-6 text-[#6B7280]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-[#1A1A1A]">Recent Activity</h3>
                    <p className="text-sm text-[#6B7280]">
                      {caseData.timeline.length} logged {caseData.timeline.length === 1 ? 'event' : 'events'}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-[#9CA3AF]" />
              </div>
            </button>
          )}
        </div>
        
        {/* Disclaimer */}
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-gray-400" />
            <p className="text-sm text-gray-500">
              Seamless amplifies your judgment. You're always the operator.
            </p>
          </div>
        </div>
        </>
        )}
      </ContentContainer>
      
      {/* Recent Activity Modal */}
      {activityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setActivityModalOpen(false)}
          />
          
          {/* Modal Content */}
          <div className="relative w-full sm:max-w-lg max-h-[80vh] overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-xl animate-slide-up">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-white border-b border-[#E5E7EB]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#F3F4F6] rounded-lg">
                  <Clock className="h-5 w-5 text-[#6B7280]" />
                </div>
                <h2 className="text-lg font-semibold text-[#1A1A1A]">Recent Activity</h2>
              </div>
              <button
                onClick={() => setActivityModalOpen(false)}
                className="p-2 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Activity List */}
            <div className="p-4 overflow-y-auto" style={{maxHeight: 'calc(80vh - 73px)'}}>
              <div className="space-y-4">
                {caseData.timeline.slice().reverse().map((entry) => (
                  <div key={entry.id} className="relative pl-6 pb-4 border-l-2 border-[#E5E7EB] last:border-transparent last:pb-0">
                    <div className="absolute w-3 h-3 bg-[#E5E7EB] rounded-full -left-[7px] top-1.5 border-2 border-white" />
                    <p className="text-sm font-medium text-[#1A1A1A]">{entry.action}</p>
                    {entry.details && (
                      <p className="text-sm text-[#6B7280] mt-1 bg-[#F9FAFB] p-2 rounded-md">{entry.details}</p>
                    )}
                    <p className="text-xs text-[#9CA3AF] mt-2">
                      {new Date(entry.timestamp).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      
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
    </AppLayout>
  );
}
