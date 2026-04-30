import { useNavigate } from "react-router-dom";

export default function AppHeader({
  title,
  showBack = true,
  showHome = true,
  onBack,
  homePath = "/dashboard",
  rightContent = null,
}) {
  const navigate = useNavigate();

  return (
    <div className="flex h-12 items-center justify-between border-b border-[#D9D2C2] bg-transparent px-4 py-3">
      <div className="min-w-[64px]">
        {showBack && (
          <button onClick={() => (onBack ? onBack() : navigate(-1))} className="text-sm text-[#183328]">
            ← Back
          </button>
        )}
      </div>

      <div className="px-2 text-center text-[#1A1A1A] font-medium truncate">{title || "Seamless"}</div>

      <div className="min-w-[64px] text-right">
        {rightContent ||
          (showHome && (
            <button onClick={() => navigate(homePath)} className="text-sm text-[#183328]">
              Home
            </button>
          ))}
      </div>
    </div>
  );
}
