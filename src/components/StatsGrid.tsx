import React from 'react';
import { BotStats } from '../types/index.ts';

interface StatsGridProps {
  stats: BotStats;
}

export const StatsGrid: React.FC<StatsGridProps> = ({ stats }) => {
  return (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-label">Percobaan</div>
        <div className="stat-value" id="statAttempts">
          {stats.attempts}
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Berhasil</div>
        <div className="stat-value" style={{ color: '#22c55e' }} id="statSuccess">
          {stats.success}
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Kecepatan</div>
        <div className="stat-value" style={{ color: '#2563eb' }} id="statSpeed">
          {stats.speed_ms}ms
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Hemat</div>
        <div className="stat-value" style={{ color: '#7c3aed' }} id="statSaved">
          Rp {stats.saved_amount.toLocaleString('id-ID')}
        </div>
      </div>
    </div>
  );
};
