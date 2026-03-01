import { useState } from "react";
import { Label } from "@/components/ui/label";

export default function ToothSelector({ value, onChange, required, multiple = false }) {

  const [hovered, setHovered] = useState(null);

  // Parse value - can be single tooth "8" or multiple "8,9,10"
  const selectedTeeth = value ? (typeof value === 'string' ? value.split(',').map(n => n.trim()) : [String(value)]) : [];

  const upperTeeth = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16];
  const lowerTeeth = [32,31,30,29,28,27,26,25,24,23,22,21,20,19,18,17];

  const handleToothClick = (number) => {
    const numStr = String(number);
    
    if (!multiple) {
      // Single selection mode
      onChange(numStr);
      return;
    }

    // Multiple selection mode
    const currentSelected = [...selectedTeeth];
    const index = currentSelected.indexOf(numStr);
    
    if (index > -1) {
      // Tooth already selected, remove it
      currentSelected.splice(index, 1);
    } else {
      // Add tooth to selection
      currentSelected.push(numStr);
    }
    
    // Sort numerically and join with comma
    const sorted = currentSelected.map(n => parseInt(n)).sort((a, b) => a - b);
    onChange(sorted.length > 0 ? sorted.join(',') : '');
  };

  const Tooth = ({ number, x, y }) => {
    const numStr = String(number);
    const selected = selectedTeeth.includes(numStr);
    const isHovered = hovered === number;

    return (
      <g
        transform={`translate(${x},${y})`}
        onClick={() => handleToothClick(number)}
        onMouseEnter={() => setHovered(number)}
        onMouseLeave={() => setHovered(null)}
        style={{ cursor: "pointer" }}
      >
        <rect
          x="-12"
          y="-14"
          width="24"
          height="28"
          rx="5"
          fill={selected ? "#2563EB" : isHovered ? "#DBEAFE" : "#FFFFFF"}
          stroke={selected ? "#1D4ED8" : "#64748B"}
          strokeWidth={selected ? "2" : "1.5"}
        />

        <text
          textAnchor="middle"
          y="4"
          fontSize="11"
          fontWeight="600"
          fill={selected ? "white" : "#475569"}
        >
          {number}
        </text>
        
        {/* Checkmark for selected teeth in multiple mode */}
        {multiple && selected && (
          <circle cx="8" cy="-8" r="6" fill="#10B981" stroke="white" strokeWidth="1.5"/>
        )}
        {multiple && selected && (
          <text x="8" y="-5" textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">✓</text>
        )}
      </g>
    );
  };

  const spacing = 38;
  const startX = 70;

  return (
    <div className="space-y-4">

      <Label>
        Tooth Number {required && "*"}
        {multiple && <span className="text-xs text-muted-foreground ml-2">(Click to select multiple teeth)</span>}
      </Label>

      <svg viewBox="0 0 700 180" className="w-full">

        {/* Upper Label */}
        <text x="350" y="30" textAnchor="middle" fontSize="16" fill="#334155">
          Upper Arch
        </text>

        {/* Upper Row */}
        {upperTeeth.map((num, index) => (
          <Tooth
            key={num}
            number={num}
            x={startX + index * spacing}
            y={70}
          />
        ))}

        {/* Lower Label */}
        <text x="350" y="120" textAnchor="middle" fontSize="16" fill="#334155">
          Lower Arch
        </text>

        {/* Lower Row */}
        {lowerTeeth.map((num, index) => (
          <Tooth
            key={num}
            number={num}
            x={startX + index * spacing}
            y={150}
          />
        ))}

      </svg>

      {/* Selection display */}
      {value && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-900">
            <span className="font-semibold">
              Selected: {multiple && selectedTeeth.length > 1 
                ? `${selectedTeeth.length} teeth` 
                : `Tooth #${selectedTeeth[0]}`}
            </span>
            {multiple && selectedTeeth.length > 1 && (
              <span className="text-blue-700 ml-2">
                (#{selectedTeeth.join(', #')})
              </span>
            )}
          </p>
        </div>
      )}

      {/* Helper text */}
      {!value && (
        <p className="text-xs text-muted-foreground">
          {multiple ? 'Click multiple teeth to select them' : 'Click a tooth to select'}
        </p>
      )}

    </div>
  );
}
