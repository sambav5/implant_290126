export default function WarningBanner({ warnings = [] }) {
  if (!warnings.length) return null;

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 mb-4">
      <p className="font-medium text-amber-900 mb-1">AMBER Warnings</p>
      <ul className="list-disc pl-6 text-sm text-amber-800 space-y-1">
        {warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}
      </ul>
    </div>
  );
}
