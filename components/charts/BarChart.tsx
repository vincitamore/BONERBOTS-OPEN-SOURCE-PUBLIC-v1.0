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
  const maxValue = Math.max(...data.map(d => Math.abs(d.value)), 0);
  // Default color palette for non-P&L charts (when custom colors aren't provided)
  const defaultColors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  // Handle case where all values are 0 or no data
  if (maxValue === 0 || data.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        {title && <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>}
        <div className="flex items-center justify-center" style={{ height: `${height}px` }}>
          <div className="text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-sm text-gray-400">No data available</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      {title && <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>}
      <div className="space-y-3" style={{ height: `${height}px`, overflow: 'auto' }}>
        {data.map((item, index) => {
          const percentage = (Math.abs(item.value) / maxValue) * 100;
          const isNegative = item.value < 0;
          
          // If item has custom color, use it; otherwise intelligently choose based on value
          // For P&L charts (negative values exist), use green/red based on profit/loss
          // For other charts (all positive), use the default color palette
          const hasNegativeValues = data.some(d => d.value < 0);
          const barColor = item.color || (hasNegativeValues 
            ? (isNegative ? '#ef4444' : '#10b981') // Red for loss, green for profit
            : defaultColors[index % defaultColors.length] // Use palette for non-P&L charts
          );

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

