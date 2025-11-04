// components/charts/TimeSeriesChart.tsx
import React, { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, LineData, Time } from 'lightweight-charts';

interface TimeSeriesData {
  time: number | string;
  value: number;
}

interface SeriesConfig {
  name: string;
  data: TimeSeriesData[];
  color?: string;
}

interface TimeSeriesChartProps {
  series: SeriesConfig[];
  height?: number;
  title?: string;
  valueFormatter?: (value: number) => string;
}

export const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({ 
  series, 
  height = 400, 
  title,
  valueFormatter = (val) => val.toFixed(2)
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<ISeriesApi<'Line'>[]>([]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height,
      layout: {
        background: { color: '#1f2937' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: '#374151' },
        horzLines: { color: '#374151' },
      },
      timeScale: {
        borderColor: '#4b5563',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#4b5563',
      },
    });

    chartRef.current = chart;

    // Create series
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    series.forEach((s, index) => {
      const lineSeries = chart.addLineSeries({
        color: s.color || colors[index % colors.length],
        lineWidth: 2,
        title: s.name,
      });

      // Transform data to lightweight-charts format
      const chartData: LineData[] = s.data.map(d => ({
        time: (typeof d.time === 'number' ? Math.floor(d.time / 1000) : d.time) as Time,
        value: d.value,
      }));

      lineSeries.setData(chartData);
      seriesRefs.current.push(lineSeries);
    });

    chart.timeScale().fitContent();

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      seriesRefs.current = [];
    };
  }, [series, height]);

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      {title && <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>}
      <div ref={chartContainerRef} />
      <div className="flex flex-wrap gap-4 mt-4">
        {series.map((s, index) => (
          <div key={s.name} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: s.color || ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][index % 6] }}
            />
            <span className="text-sm text-gray-300">{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

