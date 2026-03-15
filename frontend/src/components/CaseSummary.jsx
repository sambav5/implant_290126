import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

function SummaryRow({ label, value }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--t3)' }}>{label}</p>
      <p className="text-sm font-medium" style={{ color: 'var(--t1)' }}>{value || 'Not provided'}</p>
    </div>
  );
}

export default function CaseSummary({ draft, stageAssignments, onEdit, onConfirm, loading }) {
  return (
    <div className="card-clinical space-y-6" data-testid="case-summary">
      <div>
        <h2 className="text-lg font-semibold" style={{ fontFamily: "'Lora', serif", color: 'var(--t1)' }}>Case Summary</h2>
        <p className="text-sm" style={{ color: 'var(--t3)' }}>Review details and workflow assignments before creating this case.</p>
      </div>

      <div className="space-y-4">
        <SummaryRow label="Patient Name" value={draft.patientName} />
        <SummaryRow label="Case Title" value={draft.caseTitle} />
        <SummaryRow label="Tooth Number" value={draft.toothNumber} />
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--t1)' }}>Workflow Assignment</h3>
        {stageAssignments.map((assignment) => (
          <div key={assignment.key} className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--t3)' }}>{assignment.title}</p>
            <p className="text-sm font-medium" style={{ color: 'var(--t1)' }}>{assignment.assigneeName}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onEdit} disabled={loading} className="flex-1" data-testid="edit-case-btn">
          Edit
        </Button>
        <Button type="button" onClick={onConfirm} disabled={loading} className="flex-1" data-testid="confirm-create-case-btn">
          {loading ? 'Creating...' : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Create Case
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
