import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, FileText, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { caseApi } from '@/services/api';
import { toast } from 'sonner';
import ProfileMenu from '@/components/ProfileMenu';
import Panel from '@/components/ui/Panel';
import PrimaryButton from '@/components/ui/PrimaryButton';
import Divider from '@/components/ui/Divider';
import ContentContainer from '@/components/ui/ContentContainer';

const statusConfig = {
  planning: { label: 'Planning' },
  in_progress: { label: 'In Progress' },
  completed: { label: 'Completed' },
};

export const CaseCard = ({ caseData, onClick }) => {
  const status = statusConfig[caseData.status] || statusConfig.planning;

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
    <button onClick={onClick} className="w-full text-left" data-testid={`case-card-${caseData.id}`}>
      <Panel className="hover:bg-divider/20 transition-colors">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="font-serif text-[20px] leading-[1.5] truncate">{caseData.caseName}</h3>
            <p className="text-warmgray">Tooth #{caseData.toothNumber}</p>
          </div>
          <ChevronRight className="h-5 w-5 text-warmgray shrink-0" />
        </div>
        <div className="mt-4 flex items-center gap-4 text-[13px] uppercase tracking-[0.04em] text-warmgray">
          <span>{status.label}</span>
          {totalChecks > 0 && <span>{completedChecks}/{totalChecks} checks</span>}
        </div>
      </Panel>
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

  const filteredCases = cases.filter(c => c.caseName.toLowerCase().includes(searchQuery.toLowerCase()) || c.toothNumber.includes(searchQuery));
  const activeCases = filteredCases.filter(c => c.status !== 'completed');

  return (
    <div className="min-h-screen bg-champagne pb-24">
      <header className="border-b border-divider bg-forest py-6">
        <ContentContainer className="flex items-center justify-between">
          <div>
            <p className="wordmark text-champagne">SEAMLESS</p>
            <p className="mt-2 type-caption text-champagne/80">Infrastructure workflows for implant teams.</p>
          </div>
          <ProfileMenu />
        </ContentContainer>
      </header>

      <main className="page-section">
        <ContentContainer className="space-y-10">
          <div className="text-stack-24">
            <h1 className="type-hero text-forest">Case Operations</h1>
            <p className="type-body text-warmgray">Track planning progress and move through high-confidence clinical execution.</p>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-warmgray" />
            <Input placeholder="Search cases" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" data-testid="search-input" />
          </div>

          {!loading && cases.length === 0 && (
            <Panel className="paragraph-stack">
              <FileText className="h-10 w-10 text-warmgray" />
              <h2 className="type-subhead">No cases yet</h2>
              <p className="type-body text-warmgray">Create your first implant case to start team coordination.</p>
              <PrimaryButton onClick={() => navigate('/case/new')} data-testid="create-first-case-btn">Create Case</PrimaryButton>
            </Panel>
          )}

          {activeCases.length > 0 && (
            <section className="space-y-4">
              <Divider />
              <p className="type-caption uppercase text-warmgray">Active Cases</p>
              <div className="space-y-3">
                {activeCases.map((c) => <CaseCard key={c.id} caseData={c} onClick={() => navigate(`/case/${c.id}`)} />)}
              </div>
            </section>
          )}
        </ContentContainer>
      </main>

      <Link to="/case/new" className="fab bg-forest text-champagne" data-testid="new-case-fab">
        <Plus className="h-6 w-6" />
      </Link>
    </div>
  );
}
