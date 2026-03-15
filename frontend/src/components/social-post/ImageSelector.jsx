import { Button } from '@/components/ui/button';

function ImageGrid({ title, images, selectedId, onSelect }) {
  return (
    <div className="space-y-2">
      <h4 className="font-medium">{title}</h4>
      {images.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--t3)' }}>No images available.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {images.map((image) => (
            <button
              key={image.id}
              onClick={() => onSelect(image)}
              className="rounded-lg overflow-hidden border text-left"
              style={{ borderColor: selectedId === image.id ? 'var(--green)' : 'var(--border)' }}
            >
              <img src={image.storageUrl} alt={image.fileName} className="w-full h-24 object-cover" />
              <div className="p-2 text-xs truncate">{image.fileName}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ImageSelector({ preOpImages, postOpImages, selectedPreOp, selectedPostOp, onSelectPreOp, onSelectPostOp }) {
  return (
    <div className="space-y-5">
      <ImageGrid title="Pre-Op Images" images={preOpImages} selectedId={selectedPreOp?.id} onSelect={onSelectPreOp} />
      <ImageGrid title="Post-Op Images" images={postOpImages} selectedId={selectedPostOp?.id} onSelect={onSelectPostOp} />
      <div className="flex gap-2 text-xs" style={{ color: 'var(--t3)' }}>
        <span>Selected:</span>
        <Button variant="outline" size="sm" className="h-6 px-2 text-xs">Pre-Op: {selectedPreOp ? '1' : '0'}</Button>
        <Button variant="outline" size="sm" className="h-6 px-2 text-xs">Post-Op: {selectedPostOp ? '1' : '0'}</Button>
      </div>
    </div>
  );
}
