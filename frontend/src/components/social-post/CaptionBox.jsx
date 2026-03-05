import { Button } from '@/components/ui/button';

export default function CaptionBox({ caption, onCopy, onRegenerate, canGenerate }) {
  return (
    <div className="space-y-3">
      <h4 className="font-medium">Caption</h4>
      <textarea
        value={caption}
        readOnly
        className="w-full min-h-[180px] rounded-lg border p-3 text-sm"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      />
      <div className="flex gap-2">
        <Button variant="outline" onClick={onCopy}>Copy Caption</Button>
        <Button variant="outline" onClick={onRegenerate} disabled={!canGenerate}>Regenerate Caption</Button>
      </div>
    </div>
  );
}
