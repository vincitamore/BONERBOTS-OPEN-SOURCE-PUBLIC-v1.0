// components/charts/PieChart.tsx
import React from 'react';

interface PieData {
  label: string;
  value: number;
  color?: string;
}

interface PieChartProps {
  data: PieData[];
  title?: string;
  valueFormatter?: (value: number) => string;
  size?: number;
}

export const PieChart: React.FC<PieChartProps> = ({ 
  data, 
  title,
  valueFormatter = (val) => val.toFixed(2),
  size = 200
}) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

  let currentAngle = 0;
  const segments = data.map((item, index) => {
    const percentage = (item.value / total) * 100;
    const angle = (item.value / total) * 360;
    const startAngle = currentAngle;
    currentAngle += angle;

    return {
      ...item,
      percentage,
      startAngle,
      endAngle: currentAngle,
      color: item.color || colors[index % colors.length],
    };
  });

  const radius = size / 2;
  const innerRadius = radius * 0.6; // Donut chart

  const createArc = (startAngle: number, endAngle: number, outerRadius: number, innerRadius: number) => {
    const start = polarToCartesian(radius, radius, outerRadius, endAngle);
    const end = polarToCartesian(radius, radius, outerRadius, startAngle);
    const innerStart = polarToCartesian(radius, radius, innerRadius, endAngle);
    const innerEnd = polarToCartesian(radius, radius, innerRadius, startAngle);

    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

    return [
      'M', start.x, start.y,
      'A', outerRadius, outerRadius, 0, largeArcFlag, 0, end.x, end.y,
      'L', innerEnd.x, innerEnd.y,
      'A', innerRadius, innerRadius, 0, largeArcFlag, 1, innerStart.x, innerStart.y,
      'Z'
    ].join(' ');
  };

  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      {title && <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>}
      <div className="flex items-center gap-8">
        <svg width={size} height={size} className="flex-shrink-0">
          {segments.map((segment, index) => (
            <g key={index}>
              <path
                d={createArc(segment.startAngle, segment.endAngle, radius, innerRadius)}
                fill={segment.color}
                className="transition-opacity hover:opacity-80"
              />
            </g>
          ))}
          {/* Center text */}
          <text
            x={radius}
            y={radius}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-sm font-semibold fill-gray-300"
          >
            Total
          </text>
          <text
            x={radius}
            y={radius + 16}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-xs fill-gray-400"
          >
            {valueFormatter(total)}
          </text>
        </svg>
        <div className="flex-1 space-y-2">
          {segments.map((segment, index) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-1">
                <div 
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="text-sm text-gray-300 truncate">{segment.label}</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-white">{valueFormatter(segment.value)}</div>
                <div className="text-xs text-gray-400">{segment.percentage.toFixed(1)}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

