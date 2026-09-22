import React from 'react';
import { BotStats } from '../types/index.ts';

interface ActivityDonutProps {
  stats: BotStats;
  latency: number;
}

export const ActivityDonut: React.FC<ActivityDonutProps> = ({ stats, latency }) => {
  // Calculate relative percentages for segments
  const successRate = stats.attempts > 0 ? Math.min(100, Math.round((stats.success / stats.attempts) * 100)) : 98;
  const socketHealth = Math.max(70, 100 - latency);

  // SVG Donut geometry
  const size = 180;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Segment stroke dashes
  const seg1 = circumference * 0.45; // Success Rate (Royal Violet)
  const seg2 = circumference * 0.25; // Multi-Socket Health (Deep Indigo)
  const seg3 = circumference * 0.18; // Low Latency (Sky Blue)
  const seg4 = circumference * 0.12; // Jitter Offset (Lavender)

  return (
    <div className="modern-donut-card">
      <div className="donut-header">
        <div>
          <h4 className="donut-title">Performa & Akurasi Bot</h4>
          <p className="donut-subtitle">Analisis Real-time Detik 0</p>
        </div>
        <span className="donut-period-badge">
          Sesi Aktif <i className="fa-solid fa-chevron-down text-xs ml-1"></i>
        </span>
      </div>

      <div className="donut-chart-container">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="donut-svg">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
          />
          {/* Segment 1: Royal Violet */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#7c3aed"
            strokeWidth={strokeWidth}
            strokeDasharray={`${seg1} ${circumference - seg1}`}
            strokeDashoffset={0}
            strokeLinecap="round"
          />
          {/* Segment 2: Deep Indigo */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#4338ca"
            strokeWidth={strokeWidth}
            strokeDasharray={`${seg2} ${circumference - seg2}`}
            strokeDashoffset={-seg1}
            strokeLinecap="round"
          />
          {/* Segment 3: Sky Blue */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#38bdf8"
            strokeWidth={strokeWidth}
            strokeDasharray={`${seg3} ${circumference - seg3}`}
            strokeDashoffset={-(seg1 + seg2)}
            strokeLinecap="round"
          />
          {/* Segment 4: Lavender Accent */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#c4b5fd"
            strokeWidth={strokeWidth}
            strokeDasharray={`${seg4} ${circumference - seg4}`}
            strokeDashoffset={-(seg1 + seg2 + seg3)}
            strokeLinecap="round"
          />
        </svg>

        {/* Center Text inside Donut */}
        <div className="donut-center-content">
          <div className="donut-center-value">{successRate}%</div>
          <div className="donut-center-label">Akurasi Bot</div>
        </div>
      </div>

      {/* Legend Grid matching reference */}
      <div className="donut-legend-grid">
        <div className="donut-legend-item">
          <span className="legend-dot" style={{ backgroundColor: '#7c3aed' }}></span>
          <div className="legend-text">
            <span className="legend-label">Checkout Sukses</span>
            <strong className="legend-val">{stats.success} pesanan</strong>
          </div>
        </div>

        <div className="donut-legend-item">
          <span className="legend-dot" style={{ backgroundColor: '#4338ca' }}></span>
          <div className="legend-text">
            <span className="legend-label">Multi-Socket</span>
            <strong className="legend-val">12 Paralel</strong>
          </div>
        </div>

        <div className="donut-legend-item">
          <span className="legend-dot" style={{ backgroundColor: '#38bdf8' }}></span>
          <div className="legend-text">
            <span className="legend-label">Socket Latensi</span>
            <strong className="legend-val">{latency} ms</strong>
          </div>
        </div>

        <div className="donut-legend-item">
          <span className="legend-dot" style={{ backgroundColor: '#c4b5fd' }}></span>
          <div className="legend-text">
            <span className="legend-label">Pre-Fire Jitter</span>
            <strong className="legend-val">-15 ms</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
