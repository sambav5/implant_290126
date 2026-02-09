import { useState } from "react";
import { Label } from "@/components/ui/label";

/* ------------------------------------------------ */
/* Tooth Labels */
/* ------------------------------------------------ */

const TOOTH_LABELS = {
  1: "Upper right 3rd molar",
  2: "Upper right 2nd molar",
  3: "Upper right 1st molar",
  4: "Upper right 2nd premolar",
  5: "Upper right 1st premolar",
  6: "Upper right canine",
  7: "Upper right lateral incisor",
  8: "Upper right central incisor",
  9: "Upper left central incisor",
  10: "Upper left lateral incisor",
  11: "Upper left canine",
  12: "Upper left 1st premolar",
  13: "Upper left 2nd premolar",
  14: "Upper left 1st molar",
  15: "Upper left 2nd molar",
  16: "Upper left 3rd molar",

  17: "Lower left 3rd molar",
  18: "Lower left 2nd molar",
  19: "Lower left 1st molar",
  20: "Lower left 2nd premolar",
  21: "Lower left 1st premolar",
  22: "Lower left canine",
  23: "Lower left lateral incisor",
  24: "Lower left central incisor",
  25: "Lower right central incisor",
  26: "Lower right lateral incisor",
  27: "Lower right canine",
  28: "Lower right 1st premolar",
  29: "Lower right 2nd premolar",
  30: "Lower right 1st molar",
  31: "Lower right 2nd molar",
  32: "Lower right 3rd molar",
};

/* ------------------------------------------------ */
/* Anatomical Tooth Coordinates */
/* ------------------------------------------------ */

const TOOTH_POSITIONS = {
  1: { x: 80, y: 80, rot: -25 },
  2: { x: 115, y: 70, rot: -20 },
  3: { x: 155, y: 60, rot: -15 },
  4: { x: 195, y: 54, rot: -10 },
  5: { x: 235, y: 50, rot: -6 },
  6: { x: 275, y: 46, rot: -3 },
  7: { x: 310, y: 45, rot: 0 },
  8: { x: 340, y: 45, rot: 2 },
  9: { x: 370, y: 45, rot: 3 },
  10: { x: 405, y: 46, rot: 6 },
  11: { x: 445, y: 50, rot: 10 },
  12: { x: 485, y: 54, rot: 15 },
  13: { x: 525, y: 60, rot: 20 },
  14: { x: 565, y: 70, rot: 22 },
  15: { x: 600, y: 80, rot: 25 },
  16: { x: 630, y: 90, rot: 28 },

  17: { x: 630, y: 210, rot: -28 },
  18: { x: 600, y: 220, rot: -25 },
  19: { x: 565, y: 230, rot: -22 },
  20: { x: 525, y: 238, rot: -18 },
  21: { x: 485, y: 244, rot: -14 },
  22: { x: 445, y: 248, rot: -8 },
  23: { x: 405, y: 252, rot: -3 },
  24: { x: 370, y: 255, rot: 0 },
  25: { x: 340, y: 255, rot: 0 },
  26: { x: 310, y: 252, rot: 3 },
  27: { x: 275, y: 248, rot: 8 },
  28: { x: 235, y: 244, rot: 14 },
  29: { x: 195, y: 238, rot: 18 },
  30: { x: 155, y: 230, rot: 22 },
  31: { x: 115, y: 220, rot: 25 },
  32: { x: 80, y: 210, rot: 28 },
};

/* ------------------------------------------------ */
/* Tooth Types */
/* ------------------------------------------------ */

const TOOTH_TYPES = {
  molar: 1.1,
  premolar: 1,
  canine: 0.95,
  incisor: 0.85,
};

const UPPER_TEETH = [
  ["1","molar"],["2","molar"],["3","molar"],
  ["4","premolar"],["5","premolar"],
  ["6","canine"],
  ["7","incisor"],["8","incisor"],["9","incisor"],["10","incisor"],
  ["11","canine"],
  ["12","premolar"],["13","premolar"],
  ["14","molar"],["15","molar"],["16","molar"]
];

const LOWER_TEETH = [
  ["17","molar"],["18","molar"],["19","molar"],
  ["20","premolar"],["21","premolar"],
  ["22","canine"],
  ["23","incisor"],["24","incisor"],["25","incisor"],["26","incisor"],
  ["27","canine"],
  ["28","premolar"],["29","premolar"],
  ["30","molar"],["31","molar"],["32","molar"]
];

/* ------------------------------------------------ */
/* Component */
/* ------------------------------------------------ */

export default function ToothSelector({ value, onChange, required }) {

  const [hovered, setHovered] = useState(null);

  const Tooth = ({ number, type }) => {

    const pos = TOOTH_POSITIONS[number];
    const scale = TOOTH_TYPES[type];

    const selected = value === number;
    const isHovered = hovered === number;

    const getPath = () => {
      switch (type) {
        case "molar":
          return "M4,2 L14,2 L17,8 L17,26 L14,30 L4,30 L1,26 L1,8 Z";
        case "premolar":
          return "M5,1 L13,1 L14,6 L14,22 L11,27 L7,27 L4,22 L4,6 Z";
        case "canine":
          return "M6,0 L11,8 L12,22 L9,30 L4,30 L1,22 L2,8 Z";
        default:
          return "M6,0 L12,0 L14,6 L14,24 L11,29 L6,29 L3,24 L3,6 Z";
      }
    };

    return (
      <g
        transform={`translate(${pos.x},${pos.y}) rotate(${pos.rot}) scale(${scale})`}
        onClick={() => onChange(number)}
        onMouseEnter={() => setHovered(number)}
        onMouseLeave={() => setHovered(null)}
        style={{ cursor: "pointer" }}
      >
        <path
          d={getPath()}
          fill={selected ? "#2563EB" : isHovered ? "#DBEAFE" : "#FFFFFF"}
          stroke="#64748B"
          strokeWidth="1.5"
        />

        <text
          x="9"
          y="18"
          textAnchor="middle"
          fontSize="10"
          fill={selected ? "#FFF" : "#475569"}
        >
          {number}
        </text>
      </g>
    );
  };

  return (
    <div className="space-y-3">

      <Label>
        Tooth Number {required && "*"}
      </Label>

      <svg viewBox="0 0 700 280" className="w-full">

        <text x="350" y="20" textAnchor="middle">Upper Arch</text>

        {UPPER_TEETH.map(([num,type]) => (
          <Tooth key={num} number={num} type={type}/>
        ))}

        <text x="350" y="270" textAnchor="middle">Lower Arch</text>

        {LOWER_TEETH.map(([num,type]) => (
          <Tooth key={num} number={num} type={type}/>
        ))}

      </svg>

      {value && (
        <p className="text-sm">
          Selected Tooth #{value} — {TOOTH_LABELS[value]}
        </p>
      )}

    </div>
  );
}
