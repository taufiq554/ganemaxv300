import React from 'react';

interface QuickMenuGridProps {
  onOpenQris: () => void;
  onOpenTargetModal: () => void;
  onOpenProxyModal: () => void;
  onOpenScheduleModal: () => void;
  onSwitchTab: (tab: 'dashboard' | 'targets' | 'engine' | 'analytics') => void;
}

export const QuickMenuGrid: React.FC<QuickMenuGridProps> = ({
  onOpenQris,
  onOpenTargetModal,
  onOpenProxyModal,
  onOpenScheduleModal,
  onSwitchTab,
}) => {
  return (
    <div className="modern-quick-menu-section">
      <div className="section-title-row">
        <h3 className="section-heading">Menu Cepat Bot</h3>
        <span className="section-subtext">Akses Fitur Utama</span>
      </div>

      <div className="quick-menu-grid">
        {/* 1. Sewa QRIS */}
        <div className="quick-menu-card" onClick={onOpenQris}>
          <div className="quick-card-icon green">
            <i className="fa-solid fa-qrcode"></i>
          </div>
          <div className="quick-card-info">
            <h5 className="quick-card-title">Sewa via QRIS</h5>
            <p className="quick-card-desc">Top up / perpanjang lisensi</p>
          </div>
          <i className="fa-solid fa-chevron-right quick-card-arrow"></i>
        </div>

        {/* 2. Jadwal & Countdown */}
        <div className="quick-menu-card" onClick={onOpenScheduleModal}>
          <div className="quick-card-icon purple">
            <i className="fa-solid fa-clock"></i>
          </div>
          <div className="quick-card-info">
            <h5 className="quick-card-title">Jadwal & Timer</h5>
            <p className="quick-card-desc">Preset jam 00, 12, 18, 20</p>
          </div>
          <i className="fa-solid fa-chevron-right quick-card-arrow"></i>
        </div>

        {/* 3. Proxy Residential */}
        <div className="quick-menu-card" onClick={onOpenProxyModal}>
          <div className="quick-card-icon blue">
            <i className="fa-solid fa-shield-halved"></i>
          </div>
          <div className="quick-card-info">
            <h5 className="quick-card-title">Proxy Mesh</h5>
            <p className="quick-card-desc">Rotasi IP anti-banned</p>
          </div>
          <i className="fa-solid fa-chevron-right quick-card-arrow"></i>
        </div>

        {/* 4. Konfigurasi Engine */}
        <div className="quick-menu-card" onClick={() => onSwitchTab('engine')}>
          <div className="quick-card-icon violet">
            <i className="fa-solid fa-sliders"></i>
          </div>
          <div className="quick-card-info">
            <h5 className="quick-card-title">Engine & PIN</h5>
            <p className="quick-card-desc">Jitter -15ms & ShopeePay</p>
          </div>
          <i className="fa-solid fa-chevron-right quick-card-arrow"></i>
        </div>
      </div>
    </div>
  );
};
