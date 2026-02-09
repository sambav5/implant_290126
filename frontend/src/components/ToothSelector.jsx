import { useState } from "react";
import { Label } from "@/components/ui/label";

export default function ToothSelector({ value, onChange, required }) {

  const [hovered,setHovered] = useState(null);

  const upperTeeth = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16];
  const lowerTeeth = [32,31,30,29,28,27,26,25,24,23,22,21,20,19,18,17];

  const Tooth = ({ number, x, y }) => {

    const selected = value === number;
    const isHovered = hovered === number;

    return (
      <g
        transform={`translate(${x},${y})`}
        onClick={()=>onChange(number)}
        onMouseEnter={()=>setHovered(number)}
        onMouseLeave={()=>setHovered(null)}
        style={{ cursor:"pointer" }}
      >
        <rect
          x="-12"
          y="-14"
          width="24"
          height="28"
          rx="5"
          fill={selected ? "#2563EB" : isHovered ? "#DBEAFE" : "#FFFFFF"}
          stroke="#64748B"
          strokeWidth="1.5"
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
      </g>
    );
  };

  const spacing = 38;
  const startX = 70;

  return (
    <div className="space-y-4">

      <Label>
        Tooth Number {required && "*"}
      </Label>

      <svg viewBox="0 0 700 180" className="w-full">

        {/* Upper Label */}
        <text x="350" y="30" textAnchor="middle" fontSize="16" fill="#334155">
          Upper Arch
        </text>

        {/* Upper Row */}
        {upperTeeth.map((num,index)=>(
          <Tooth
            key={num}
            number={num}
            x={startX + index*spacing}
            y={70}
          />
        ))}

        {/* Lower Label */}
        <text x="350" y="120" textAnchor="middle" fontSize="16" fill="#334155">
          Lower Arch
        </text>

        {/* Lower Row */}
        {lowerTeeth.map((num,index)=>(
          <Tooth
            key={num}
            number={num}
            x={startX + index*spacing}
            y={150}
          />
        ))}

      </svg>

    </div>
  );
}
