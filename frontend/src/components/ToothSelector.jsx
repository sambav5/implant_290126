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
  '25': 'Lower lower central incisor',
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

  // Tooth shape component
  const Tooth = ({ number, x, y, type = 'molar' }) => {
    const selected = isSelected(number);
    const hovered = isHovered(number);
    
    // Different tooth shapes based on type
    const getToothPath = () => {
      switch (type) {
        case 'molar':
          return 'M0,0 L12,0 L12,16 L0,16 Z';
        case 'premolar':
          return 'M1,0 L11,0 L12,14 L0,14 Z';
        case 'canine':
          return 'M2,0 L10,0 L12,12 L6,16 L0,12 Z';
        case 'incisor':
          return 'M3,0 L9,0 L10,14 L2,14 Z';
        default:
          return 'M0,0 L12,0 L12,16 L0,16 Z';
      }
    };

    return (
      <g
        transform={`translate(${x}, ${y})`}
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
        <path
          d={getToothPath()}
          fill={selected ? '#2F80ED' : hovered ? '#E8F0FE' : '#F5F6F8'}
          stroke={selected ? '#2F80ED' : hovered ? '#2F80ED' : '#CBD5E1'}
          strokeWidth={selected ? 2 : 1}
          className="transition-all duration-200"
        />
        <text
          x="6"
          y="10"
          textAnchor="middle"
          fontSize="7"
          fontWeight={selected ? 'bold' : 'normal'}
          fill={selected ? 'white' : '#64748B'}
          pointerEvents="none"
        >
          {number}
        </text>
      </g>
    );
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
      
      {/* SVG Jaw Diagram */}
      <div className="p-4 bg-white rounded-lg border border-border">
        <div className="flex flex-col items-center">
          <svg
            viewBox="0 0 260 80"
            className="w-full max-w-2xl"
            style={{ maxHeight: '200px' }}
          >
            {/* Upper arch label */}
            <text x="130" y="12" textAnchor="middle" fontSize="9" fill="#64748B" fontWeight="500">
              Upper Arch
            </text>
            
            {/* Upper teeth - curved arch */}
            {upperTeeth.map((tooth, index) => {
              const baseX = 20 + index * 15;
              const curveY = 20 + Math.abs(8 - index) * 1.5; // Create arch curve
              return (
                <Tooth
                  key={tooth.num}
                  number={tooth.num}
                  x={baseX}
                  y={curveY}
                  type={tooth.type}
                />
              );
            })}
            
            {/* Lower arch label */}
            <text x="130" y="75" textAnchor="middle" fontSize="9" fill="#64748B" fontWeight="500">
              Lower Arch
            </text>
            
            {/* Lower teeth - curved arch */}
            {lowerTeeth.map((tooth, index) => {
              const baseX = 20 + index * 15;
              const curveY = 45 + Math.abs(8 - index) * 1.5; // Create arch curve
              return (
                <Tooth
                  key={tooth.num}
                  number={tooth.num}
                  x={baseX}
                  y={curveY}
                  type={tooth.type}
                />
              );
            })}
            
            {/* Midline indicator */}
            <line x1="128" y1="18" x2="128" y2="72" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="2,2" />
          </svg>
        </div>
      </div>
      
      {/* Selection confirmation */}
      {value && (
        <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/10 animate-fade-in">
          <div className="w-2 h-2 rounded-full bg-primary shrink-0"></div>
          <p className="text-sm text-foreground">
            <span className="font-semibold">Selected tooth: #{value}</span>
            <span className="text-muted-foreground"> ({TOOTH_LABELS[value]})</span>
          </p>
        </div>
      )}
      
      {/* Helper text */}
      {!value && (
        <p className="text-xs text-muted-foreground">
          Click on a tooth in the diagram above to select
        </p>
      )}
    </div>
  );
}
