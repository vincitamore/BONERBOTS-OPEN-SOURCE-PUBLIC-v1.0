// components/charts/BarChart.tsx
import React from 'react';

interface BarData {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarData[];
  title?: string;
  valueFormatter?: (value: number) => string;
  height?: number;
  horizontal?: boolean;
}

export const BarChart: React.FC<BarChartProps> = ({ 
  data, 
  title,
  valueFormatter = (val) => val.toFixed(2),
  height = 300,
  horizontal = false
}) => {
  const maxValue = Math.max(...data.map(d => Math.abs(d.value)));
  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      {title && <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>}
      <div className="space-y-3" style={{ height: `${height}px`, overflow: 'auto' }}>
        {data.map((item, index) => {
          const percentage = (Math.abs(item.value) / maxValue) * 100;
          const isNegative = item.value < 0;
          const barColor = item.color || colors[index % colors.length];

          return (
            <div key={item.label} className="flex items-center gap-3">
              <div className="w-32 text-sm text-gray-300 truncate" title={item.label}>
                {item.label}
              </div>
              <div className="flex-1 relative">
                <div className="h-8 bg-gray-700 rounded overflow-hidden">
                  <div
                    className="h-full rounded transition-all duration-300"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: barColor,
                      opacity: isNegative ? 0.7 : 1,
                    }}
                  />
                </div>
              </div>
              <div className={`w-24 text-sm font-medium text-right ${isNegative ? 'text-red-400' : 'text-green-400'}`}>
                {valueFormatter(item.value)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

