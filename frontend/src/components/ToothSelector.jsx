import { useState } from 'react';
import { Label } from '@/components/ui/label';

// Tooth labels for Universal numbering system
const TOOTH_LABELS = {
  // Upper teeth (right to left: 1-16)
  '1': 'Upper right 3rd molar',
  '2': 'Upper right 2nd molar',
  '3': 'Upper right 1st molar',
  '4': 'Upper right 2nd premolar',
  '5': 'Upper right 1st premolar',
  '6': 'Upper right canine',
  '7': 'Upper right lateral incisor',
  '8': 'Upper right central incisor',
  '9': 'Upper left central incisor',
  '10': 'Upper left lateral incisor',
  '11': 'Upper left canine',
  '12': 'Upper left 1st premolar',
  '13': 'Upper left 2nd premolar',
  '14': 'Upper left 1st molar',
  '15': 'Upper left 2nd molar',
  '16': 'Upper left 3rd molar',
  // Lower teeth (left to right: 17-32)
  '17': 'Lower left 3rd molar',
  '18': 'Lower left 2nd molar',
  '19': 'Lower left 1st molar',
  '20': 'Lower left 2nd premolar',
  '21': 'Lower left 1st premolar',
  '22': 'Lower left canine',
  '23': 'Lower left lateral incisor',
  '24': 'Lower left central incisor',
  '25': 'Lower right central incisor',
  '26': 'Lower right lateral incisor',
  '27': 'Lower right canine',
  '28': 'Lower right 1st premolar',
  '29': 'Lower right 2nd premolar',
  '30': 'Lower right 1st molar',
  '31': 'Lower right 2nd molar',
  '32': 'Lower right 3rd molar',
};

export default function ToothSelector({ value, onChange, required = false }) {
  const [hoveredTooth, setHoveredTooth] = useState(null);

  const handleToothClick = (toothNumber) => {
    onChange(toothNumber);
  };

  const isSelected = (toothNumber) => value === toothNumber;
  const isHovered = (toothNumber) => hoveredTooth === toothNumber;

  // Anatomical tooth shape component with realistic silhouettes
  const Tooth = ({ number, x, y, type = 'molar', rotation = 0 }) => {
    const selected = isSelected(number);
    const hovered = isHovered(number);
    
    // Anatomically accurate tooth silhouettes
    const getToothPath = () => {
      switch (type) {
        case 'molar':
          // Multi-cusped molar shape
          return 'M4,2 L7,0 L11,0 L14,2 L16,4 L17,8 L17,22 L16,26 L14,29 L10,32 L8,32 L4,29 L2,26 L1,22 L1,8 L2,4 Z';
        case 'premolar':
          // Two-cusped premolar
          return 'M5,1 L8,0 L11,1 L13,3 L14,6 L14,20 L13,24 L11,27 L9,29 L7,27 L5,24 L4,20 L4,6 L5,3 Z';
        case 'canine':
          // Pointed canine
          return 'M6,0 L9,3 L11,8 L12,14 L12,22 L11,26 L9,29 L6,30 L3,29 L1,26 L0,22 L0,14 L1,8 L3,3 Z';
        case 'incisor':
          // Flat incisor
          return 'M6,0 L10,0 L12,2 L13,6 L13,24 L12,27 L10,29 L6,29 L4,27 L3,24 L3,6 L4,2 Z';
        default:
          return 'M4,2 L14,2 L16,8 L16,26 L14,30 L4,30 L2,26 L2,8 Z';
      }
    };

    return (
      <g
        transform={`translate(${x}, ${y}) rotate(${rotation}, 9, 16)`}
        onClick={() => handleToothClick(number)}
        onMouseEnter={() => setHoveredTooth(number)}
        onMouseLeave={() => setHoveredTooth(null)}
        style={{ cursor: 'pointer' }}
        data-tooth={number}
        role="button"
        aria-label={`Tooth ${number}: ${TOOTH_LABELS[number]}`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToothClick(number);
          }
        }}
      >
        {/* Touch-friendly background area */}
        <rect
          x="-4"
          y="-4"
          width="26"
          height="40"
          fill="transparent"
          pointerEvents="all"
        />
        
        {/* Tooth silhouette */}
        <path
          d={getToothPath()}
          fill={selected ? '#3B82F6' : hovered ? '#DBEAFE' : '#FFFFFF'}
          stroke={selected ? '#1D4ED8' : hovered ? '#3B82F6' : '#94A3B8'}
          strokeWidth={selected ? 2.5 : 1.5}
          className="transition-all duration-200"
          filter={selected ? 'drop-shadow(0 2px 4px rgba(59, 130, 246, 0.3))' : ''}
        />
        
        {/* Tooth number */}
        <text
          x="9"
          y="18"
          textAnchor="middle"
          fontSize="10"
          fontWeight={selected ? 'bold' : '600'}
          fill={selected ? '#FFFFFF' : '#475569'}
          pointerEvents="none"
        >
          {number}
        </text>
      </g>
    );
  };

  // Calculate elliptical arch curve positions
  const getArchPosition = (index, totalTeeth, isUpper) => {
    // Ellipse parameters for more realistic arch curvature
    const centerX = 300;
    const radiusX = 240; // Horizontal spread
    const radiusY = isUpper ? 45 : 50; // Vertical curve depth
    
    // Map tooth index to angle along the ellipse
    const angle = Math.PI - (index / (totalTeeth - 1)) * Math.PI;
    
    const x = centerX + radiusX * Math.cos(angle);
    const y = radiusY * Math.sin(angle);
    
    // Calculate rotation angle for tooth orientation
    const tangentAngle = Math.atan2(
      radiusY * Math.cos(angle),
      -radiusX * Math.sin(angle)
    ) * (180 / Math.PI);
    
    return { x, y, rotation: tangentAngle };
  };

  // Define tooth types for each position
  const upperTeeth = [
    { num: '1', type: 'molar' },
    { num: '2', type: 'molar' },
    { num: '3', type: 'molar' },
    { num: '4', type: 'premolar' },
    { num: '5', type: 'premolar' },
    { num: '6', type: 'canine' },
    { num: '7', type: 'incisor' },
    { num: '8', type: 'incisor' },
    { num: '9', type: 'incisor' },
    { num: '10', type: 'incisor' },
    { num: '11', type: 'canine' },
    { num: '12', type: 'premolar' },
    { num: '13', type: 'premolar' },
    { num: '14', type: 'molar' },
    { num: '15', type: 'molar' },
    { num: '16', type: 'molar' },
  ];

  const lowerTeeth = [
    { num: '17', type: 'molar' },
    { num: '18', type: 'molar' },
    { num: '19', type: 'molar' },
    { num: '20', type: 'premolar' },
    { num: '21', type: 'premolar' },
    { num: '22', type: 'canine' },
    { num: '23', type: 'incisor' },
    { num: '24', type: 'incisor' },
    { num: '25', type: 'incisor' },
    { num: '26', type: 'incisor' },
    { num: '27', type: 'canine' },
    { num: '28', type: 'premolar' },
    { num: '29', type: 'premolar' },
    { num: '30', type: 'molar' },
    { num: '31', type: 'molar' },
    { num: '32', type: 'molar' },
  ];

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">
        Tooth Number {required && <span className="text-destructive">*</span>}
      </Label>
      
      {/* SVG Anatomical Jaw Diagram */}
      <div className="p-6 bg-gradient-to-b from-slate-50 to-white rounded-lg border-2 border-slate-200">
        <div className="flex flex-col items-center">
          <svg
            viewBox="0 0 600 280"
            className="w-full"
            style={{ maxWidth: '900px' }}
          >
            {/* Upper arch label */}
            <text x="300" y="25" textAnchor="middle" fontSize="14" fill="#475569" fontWeight="600">
              Upper Arch (Maxilla)
            </text>
            
            {/* Upper arch curve guide (visual only) */}
            <path
              d="M 60 80 Q 300 30, 540 80"
              fill="none"
              stroke="#E2E8F0"
              strokeWidth="1"
              strokeDasharray="3,3"
            />
            
            {/* Upper teeth - anatomically curved arch */}
            {upperTeeth.map((tooth, index) => {
              const pos = getArchPosition(index, upperTeeth.length, true);
              return (
                <Tooth
                  key={tooth.num}
                  number={tooth.num}
                  x={pos.x}
                  y={45 + pos.y}
                  type={tooth.type}
                  rotation={pos.rotation}
                />
              );
            })}
            
            {/* Midline indicator */}
            <line x1="300" y1="35" x2="300" y2="245" stroke="#CBD5E1" strokeWidth="2" strokeDasharray="5,5" opacity="0.6" />
            <text x="310" y="140" fontSize="10" fill="#94A3B8" fontWeight="500">Midline</text>
            
            {/* Lower arch curve guide (visual only) */}
            <path
              d="M 60 180 Q 300 230, 540 180"
              fill="none"
              stroke="#E2E8F0"
              strokeWidth="1"
              strokeDasharray="3,3"
            />
            
            {/* Lower teeth - anatomically curved arch */}
            {lowerTeeth.map((tooth, index) => {
              const pos = getArchPosition(index, lowerTeeth.length, false);
              return (
                <Tooth
                  key={tooth.num}
                  number={tooth.num}
                  x={pos.x}
                  y={180 + pos.y}
                  type={tooth.type}
                  rotation={-pos.rotation}
                />
              );
            })}
            
            {/* Lower arch label */}
            <text x="300" y="265" textAnchor="middle" fontSize="14" fill="#475569" fontWeight="600">
              Lower Arch (Mandible)
            </text>
            
            {/* Side labels for orientation */}
            <text x="20" y="120" fontSize="11" fill="#94A3B8" fontWeight="500">Right</text>
            <text x="580" y="120" fontSize="11" fill="#94A3B8" fontWeight="500" textAnchor="end">Left</text>
            
            {/* Orientation markers */}
            <text x="75" y="55" fontSize="9" fill="#CBD5E1" fontWeight="400">1-8</text>
            <text x="525" y="55" fontSize="9" fill="#CBD5E1" fontWeight="400" textAnchor="end">9-16</text>
            <text x="75" y="215" fontSize="9" fill="#CBD5E1" fontWeight="400">17-24</text>
            <text x="525" y="215" fontSize="9" fill="#CBD5E1" fontWeight="400" textAnchor="end">25-32</text>
          </svg>
        </div>
        
        {/* Legend */}
        <div className="mt-4 pt-4 border-t border-slate-200">
          <p className="text-xs text-muted-foreground text-center">
            Click any tooth to select • Universal Numbering System (1-32) • Anatomically oriented view
          </p>
        </div>
      </div>
      
      {/* Selection confirmation */}
      {value && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200 animate-fade-in">
          <div className="w-2 h-2 rounded-full bg-blue-600 shrink-0"></div>
          <p className="text-sm text-foreground">
            <span className="font-semibold text-blue-900">Selected tooth: #{value}</span>
            <span className="text-slate-600"> ({TOOTH_LABELS[value]})</span>
          </p>
        </div>
      )}
      
      {/* Helper text */}
      {!value && (
        <p className="text-xs text-muted-foreground">
          Select a tooth from the anatomical chart above
        </p>
      )}
    </div>
  );
}
