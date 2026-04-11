export default function WarningBanner({ warnings = [] }) {
  if (!warnings.length) return null;

  return (
    <div className="space-y-2">
      {warnings.map((warning, index) => (
        <div
          key={`${warning.ruleId}-${index}`}
          className={`rounded-lg border px-3 py-2 text-sm ${warning.severity === 'high' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-yellow-50 border-yellow-200 text-yellow-800'}`}
        >
          {warning.message}
        </div>
      ))}
    </div>
  );
}
