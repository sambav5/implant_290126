export default function SubItemList({ subItems = [] }) {
  if (!subItems.length) return null;

  return (
    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-gray-600">
      {subItems.map((subItem, index) => (
        <li key={`${subItem?.text || 'sub-item'}-${index}`}>{subItem?.text}</li>
      ))}
    </ul>
  );
}
