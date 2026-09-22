import React, { useEffect, useRef } from 'react';

interface PerformanceChartProps {
  isDark: boolean;
}

export const PerformanceChart: React.FC<PerformanceChartProps> = ({ isDark }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<any>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ChartClass = (window as any).Chart;
    if (ChartClass) {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      chartInstanceRef.current = new ChartClass(ctx, {
        type: 'line',
        data: {
          labels: ['T-10s', 'T-8s', 'T-6s', 'T-4s', 'T-2s', 'T-0s'],
          datasets: [
            {
              label: 'Latensi Socket (ms)',
              data: [42, 38, 25, 18, 12, 6],
              borderColor: '#2563eb',
              backgroundColor: 'rgba(37, 99, 235, 0.1)',
              borderWidth: 2,
              fill: true,
              tension: 0.4,
              pointRadius: 4,
              pointBackgroundColor: '#2563eb',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false,
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              max: 60,
              grid: {
                color: isDark ? '#334155' : '#f1f5f9',
              },
              ticks: {
                color: isDark ? '#94a3b8' : '#64748b',
                font: { size: 10 },
              },
            },
            x: {
              grid: {
                color: isDark ? '#334155' : '#f1f5f9',
              },
              ticks: {
                color: isDark ? '#94a3b8' : '#64748b',
                font: { size: 10 },
              },
            },
          },
        },
      });
    }

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [isDark]);

  return (
    <div className="chart-card">
      <div className="chart-title">
        <span>
          <i className="fa-solid fa-chart-line" style={{ color: '#2563eb' }}></i> Performance
          Analytics & Response Speed
        </span>
        <span
          className="badge"
          style={{ background: '#f8fafc', color: '#64748b', fontSize: '11px' }}
        >
          Live Latency Stream
        </span>
      </div>
      <div style={{ height: '140px', position: 'relative' }}>
        <canvas ref={canvasRef} id="performanceChart"></canvas>
      </div>
    </div>
  );
};
