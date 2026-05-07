import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, FileText, ChevronRight, Activity, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { caseApi, caseReflectionApi } from '@/services/api';
import { toast } from 'sonner';
import PrimaryButton from '@/components/ui/PrimaryButton';
import AppLayout from '@/layout/AppLayout';

const statusConfig = {
  planning: { label: 'Planning', color: 'bg-blue-100 text-blue-800' },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-800' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800' },
};

const riskConfig = {
  low: { label: 'Low Risk', color: 'text-green-600' },
  moderate: { label: 'Moderate Risk', color: 'text-amber-600' },
  high: { label: 'High Risk', color: 'text-red-600' },
};

export const CaseCard = ({ caseData, onClick }) => {
  const status = statusConfig[caseData.status] || statusConfig.planning;
  const risk = caseData.riskAssessment?.overallRisk ? riskConfig[caseData.riskAssessment.overallRisk] : null;

  const totalChecks = [
    ...caseData.preTreatmentChecklist,
    ...caseData.treatmentChecklist,
    ...caseData.postTreatmentChecklist,
  ].length;
  
  const completedChecks = [
    ...caseData.preTreatmentChecklist,
    ...caseData.treatmentChecklist,
    ...caseData.postTreatmentChecklist,
  ].filter(item => item.completed).length;

  const progress = totalChecks > 0 ? (completedChecks / totalChecks) * 100 : 0;

  return (
    <div 
      onClick={onClick} 
      className="card-clinical-interactive group"
      data-testid={`case-card-${caseData.id}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-1">{caseData.caseName}</h3>
          <div className="flex items-center gap-3 text-sm text-[#6B7280]">
            <span className="flex items-center gap-1">
              <span className="w-5 h-5 rounded bg-[#F3F4F6] flex items-center justify-center text-xs font-medium text-[#1A1A1A]">
                {caseData.toothNumber}
              </span>
              Tooth
            </span>
            <span>•</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
              {status.label}
            </span>
            {risk && (
              <>
                <span>•</span>
                <span className={`flex items-center gap-1 text-xs font-medium ${risk.color}`}>
                  <Activity className="w-3 h-3" />
                  {risk.label}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="p-2 rounded-lg group-hover:bg-[#F3F4F6] transition-colors">
          <ChevronRight className="w-5 h-5 text-[#9CA3AF]" />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-[#6B7280]">
          <span>Checklist Progress</span>
          <span>{Math.round(progress)}% ({completedChecks}/{totalChecks})</span>
        </div>
        <div className="w-full bg-[#E5E7EB] rounded-full h-1.5 overflow-hidden">
          <div 
            className="bg-[#1F7A63] h-1.5 rounded-full transition-all duration-500 ease-in-out" 
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [reflectionByCase, setReflectionByCase] = useState({});

  useEffect(() => {
    loadCases();
  }, []);

  const loadCases = async () => {
    try {
      const response = await caseApi.getMy();
      const rawCases = response.data.cases || response.data || [];
      const normalizedCases = rawCases.map((c) => ({
        ...c,
        caseName: c.caseName || c.caseTitle || 'Untitled case',
        toothNumber: c.toothNumber || 'N/A',
        status: c.status || c.caseStatus || 'planning',
        preTreatmentChecklist: c.preTreatmentChecklist || [],
        treatmentChecklist: c.treatmentChecklist || [],
        postTreatmentChecklist: c.postTreatmentChecklist || [],
      }));
      setCases(normalizedCases);

      const completed = normalizedCases.filter((c) => c.status === 'completed');
      const entries = await Promise.all(completed.map(async (c) => {
        try {
          const r = await caseReflectionApi.getByCase(c.id);
          return [c.id, Boolean(r?.data?.reflection)];
        } catch {
          return [c.id, false];
        }
      }));
      setReflectionByCase(Object.fromEntries(entries));
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
    <AppLayout 
      headerContent={
        <div>
          <h1 className="text-lg font-semibold text-[#1A1A1A]">Dashboard</h1>
        </div>
      }
    >
      <div className="space-y-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-[#1A1A1A] tracking-tight mb-1">Your Cases</h2>
            <p className="text-[#6B7280]">Manage your implant procedures and team workflows.</p>
          </div>
          <button 
            onClick={() => navigate('/case/new')}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#1F7A63] text-white rounded-lg font-medium hover:bg-[#17604D] transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Case
          </button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" />
          <Input 
            placeholder="Search by patient name or tooth..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            className="pl-9 bg-white border-[#E5E7EB] focus:border-[#1F7A63] focus:ring-[#1F7A63]" 
          />
        </div>

        {/* Empty State */}
        {!loading && cases.length === 0 && (
          <div className="text-center py-16 bg-white border border-[#E5E7EB] rounded-xl border-dashed">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#F3F4F6] mb-4">
              <FileText className="h-6 w-6 text-[#9CA3AF]" />
            </div>
            <h3 className="text-lg font-medium text-[#1A1A1A] mb-2">No cases yet</h3>
            <p className="text-[#6B7280] mb-6 max-w-sm mx-auto">Create your first implant case to start collaborating with your team.</p>
            <PrimaryButton onClick={() => navigate('/case/new')}>Create First Case</PrimaryButton>
          </div>
        )}

        {/* Active Cases */}
        {activeCases.length > 0 && (
          <section>
            <h3 className="text-sm font-medium text-[#6B7280] uppercase tracking-wider mb-4">Active Procedures</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeCases.map((c) => <CaseCard key={c.id} caseData={c} onClick={() => navigate(`/case/${c.id}`)} />)}
            </div>
          </section>
        )}

        {/* Completed Cases */}
        {completedCases.length > 0 && (
          <section className="pt-4 border-t border-[#E5E7EB]">
            <h3 className="text-sm font-medium text-[#6B7280] uppercase tracking-wider mb-4">Completed Procedures</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {completedCases.map((c) => (
                <div key={c.id} className="surface-panel flex flex-col justify-between h-full">
                  <div className="mb-6">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-lg font-semibold text-[#1A1A1A]">{c.caseName}</h3>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        Tooth {c.toothNumber}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-[#6B7280]">
                      <Calendar className="w-4 h-4" />
                      Completed on {new Date(c.updatedAt || c.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => navigate(`/case-reflection/${c.id}`)}
                    className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors border ${
                      reflectionByCase[c.id] 
                        ? 'bg-[#F3F4F6] text-[#4B5563] border-transparent hover:bg-gray-200'
                        : 'bg-white text-[#1F7A63] border-[#1F7A63] hover:bg-[#1F7A63]/5'
                    }`}
                  >
                    {reflectionByCase[c.id] ? 'View Learning Reflection' : 'Add Learning Reflection'}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppLayout>
  );
}
