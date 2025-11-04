// components/analytics/StatCard.tsx
import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  valueColor?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  change, 
  changeLabel,
  icon,
  valueColor
}) => {
  const isPositive = change !== undefined && change >= 0;
  const changeColor = change === undefined ? 'text-gray-400' : isPositive ? 'text-green-400' : 'text-red-400';

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-gray-600 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-400 mb-1">{title}</p>
          <p className={`text-3xl font-bold ${valueColor || 'text-white'}`}>{value}</p>
          {change !== undefined && (
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-sm font-medium ${changeColor}`}>
                {isPositive ? '↑' : '↓'} {Math.abs(change).toFixed(2)}%
              </span>
              {changeLabel && (
                <span className="text-xs text-gray-500">{changeLabel}</span>
              )}
            </div>
          )}
        </div>
        {icon && (
          <div className="flex-shrink-0 p-3 bg-gray-700 rounded-lg">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};

