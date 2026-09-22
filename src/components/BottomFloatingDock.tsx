import React from 'react';

interface BottomFloatingDockProps {
  currentTab: 'dashboard' | 'targets' | 'engine' | 'analytics';
  onSelectTab: (tab: 'dashboard' | 'targets' | 'engine' | 'analytics') => void;
  isBotRunning: boolean;
  onToggleBot: () => void;
}

export const BottomFloatingDock: React.FC<BottomFloatingDockProps> = ({
  currentTab,
  onSelectTab,
  isBotRunning,
  onToggleBot,
}) => {
  return (
    <div className="bottom-dock-wrapper">
      <nav className="bottom-dock-bar">
        {/* Tab 1: Dashboard */}
        <button
          type="button"
          className={`dock-tab-btn ${currentTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => onSelectTab('dashboard')}
          aria-label="Dashboard Utama"
        >
          <i className="fa-solid fa-house"></i>
          <span className="dock-tab-label">Beranda</span>
        </button>

        {/* Tab 2: Targets & Accounts */}
        <button
          type="button"
          className={`dock-tab-btn ${currentTab === 'targets' ? 'active' : ''}`}
          onClick={() => onSelectTab('targets')}
          aria-label="Target dan Akun"
        >
          <i className="fa-solid fa-bullseye"></i>
          <span className="dock-tab-label">Target</span>
        </button>

        {/* CENTER ELEVATED ACTION BUTTON (START/STOP BOT) */}
        <div className="dock-center-action-wrapper">
          <button
            type="button"
            className={`dock-center-action-btn ${isBotRunning ? 'running' : 'idle'}`}
            onClick={onToggleBot}
            title={isBotRunning ? 'Hentikan Bot' : 'Start Turbo Bot'}
            aria-label={isBotRunning ? 'Hentikan Bot' : 'Mulai Bot'}
            id="btnCenterStartBot"
          >
            {isBotRunning && <span className="dock-action-pulse-ring"></span>}
            <i className={`fa-solid ${isBotRunning ? 'fa-stop' : 'fa-bolt'}`}></i>
          </button>
        </div>

        {/* Tab 3: Proxy & Engine Settings */}
        <button
          type="button"
          className={`dock-tab-btn ${currentTab === 'engine' ? 'active' : ''}`}
          onClick={() => onSelectTab('engine')}
          aria-label="Engine dan Proxy"
        >
          <i className="fa-solid fa-sliders"></i>
          <span className="dock-tab-label">Engine</span>
        </button>

        {/* Tab 4: Analytics & AI */}
        <button
          type="button"
          className={`dock-tab-btn ${currentTab === 'analytics' ? 'active' : ''}`}
          onClick={() => onSelectTab('analytics')}
          aria-label="Aktivitas dan AI"
        >
          <i className="fa-solid fa-chart-pie"></i>
          <span className="dock-tab-label">Aktivitas</span>
        </button>
      </nav>
    </div>
  );
};
