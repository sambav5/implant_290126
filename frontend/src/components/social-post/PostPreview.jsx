export default function PostPreview({ imageUrl, aspectRatio }) {
  return (
    <div className="space-y-2">
      <h4 className="font-medium">Post Preview</h4>
      <div className="w-full rounded-lg border overflow-hidden bg-slate-50" style={{ borderColor: 'var(--border)', aspectRatio: aspectRatio || '4 / 5' }}>
        {imageUrl ? (
          <img src={imageUrl} alt="Generated social post" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-sm" style={{ color: 'var(--t3)' }}>
            Generate a post to preview it here
          </div>
        )}
      </div>
    </div>
  );
}
