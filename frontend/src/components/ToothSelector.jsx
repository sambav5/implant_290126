import { useState } from "react";
import { Label } from "@/components/ui/label";

const TOOTH_LABELS = {
  1:"Upper right 3rd molar",2:"Upper right 2nd molar",3:"Upper right 1st molar",
  4:"Upper right 2nd premolar",5:"Upper right 1st premolar",6:"Upper right canine",
  7:"Upper right lateral incisor",8:"Upper right central incisor",
  9:"Upper left central incisor",10:"Upper left lateral incisor",11:"Upper left canine",
  12:"Upper left 1st premolar",13:"Upper left 2nd premolar",
  14:"Upper left 1st molar",15:"Upper left 2nd molar",16:"Upper left 3rd molar",
  17:"Lower left 3rd molar",18:"Lower left 2nd molar",19:"Lower left 1st molar",
  20:"Lower left 2nd premolar",21:"Lower left 1st premolar",22:"Lower left canine",
  23:"Lower left lateral incisor",24:"Lower left central incisor",
  25:"Lower right central incisor",26:"Lower right lateral incisor",27:"Lower right canine",
  28:"Lower right 1st premolar",29:"Lower right 2nd premolar",
  30:"Lower right 1st molar",31:"Lower right 2nd molar",32:"Lower right 3rd molar",
};

export default function ToothSelector({ value, onChange, required }) {

  const [hovered,setHovered] = useState(null);

  const ToothBlock = ({ number, x, y, rotation=0 }) => {

    const selected = value === number;
    const isHovered = hovered === number;

    return (
      <g
        transform={`translate(${x},${y}) rotate(${rotation})`}
        onClick={()=>onChange(number)}
        onMouseEnter={()=>setHovered(number)}
        onMouseLeave={()=>setHovered(null)}
        style={{cursor:"pointer"}}
      >
        <rect
          x="-10"
          y="-14"
          width="20"
          height="28"
          rx="4"
          fill={selected ? "#2563EB" : isHovered ? "#DBEAFE" : "#FFFFFF"}
          stroke="#64748B"
          strokeWidth="1.4"
        />

        <text
          textAnchor="middle"
          y="4"
          fontSize="10"
          fill={selected ? "white" : "#475569"}
          fontWeight="600"
        >
          {number}
        </text>
      </g>
    );
  };

  /* -------- ARCH POSITION GENERATOR -------- */

  const createArch = (numbers, centerX, centerY, radiusX, radiusY, flip=false) => {

    return numbers.map((num,index)=>{

      const angle = Math.PI - (index/(numbers.length-1))*Math.PI;

      const x = centerX + radiusX*Math.cos(angle);
      const y = centerY + (flip ? -1 : 1) * radiusY*Math.sin(angle);

      const rotation = (Math.cos(angle)*25)*(flip?-1:1);

      return { num, x, y, rotation };
    });
  };

  /* ---------- CORRECT NUMBERING ---------- */

  const upperArch = createArch(
    [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],
    350, 110, 260, 70, false
  );

  /* LOWER ARCH MUST BE REVERSED */
  const lowerArch = createArch(
    [32,31,30,29,28,27,26,25,24,23,22,21,20,19,18,17],
    350, 310, 260, 60, true
  );

  return (
    <div className="space-y-3">

      <Label>
        Tooth Number {required && "*"}
      </Label>

      <svg viewBox="0 0 700 380" className="w-full">

        {/* Upper Label */}
        <text x="350" y="35" textAnchor="middle" fontSize="16" fill="#334155">
          Upper Arch
        </text>

        {/* Upper Teeth */}
        {upperArch.map(t => (
          <ToothBlock key={t.num} number={t.num} x={t.x} y={t.y} rotation={t.rotation}/>
        ))}

        {/* Lower Teeth */}
        {lowerArch.map(t => (
          <ToothBlock key={t.num} number={t.num} x={t.x} y={t.y} rotation={t.rotation}/>
        ))}

        {/* Lower Label */}
        <text x="350" y="360" textAnchor="middle" fontSize="16" fill="#334155">
          Lower Arch
        </text>

      </svg>

      {value && (
        <p className="text-sm">
          Selected Tooth #{value} — {TOOTH_LABELS[value]}
        </p>
      )}

    </div>
  );
}
