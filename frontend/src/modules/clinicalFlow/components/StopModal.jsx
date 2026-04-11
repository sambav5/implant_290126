import { Button } from '@/components/ui/button';

export default function StopModal({ open, reason, onOverride, onExit }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4">
        <h2 className="text-xl font-semibold text-red-700">STOP — Workflow Blocked</h2>
        <p className="text-sm text-gray-700">{reason || 'Critical failure condition encountered.'}</p>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onExit}>Exit</Button>
          <Button className="bg-red-600 hover:bg-red-700" onClick={onOverride}>Override</Button>
        </div>
      </div>
    </div>
  );
}
