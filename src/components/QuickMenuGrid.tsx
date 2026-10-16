import React from 'react';

interface QuickMenuGridProps {
  onOpenQris: () => void;
  onOpenTargetModal: () => void;
  onOpenProxyModal: () => void;
  onOpenScheduleModal: () => void;
  onSwitchTab: (tab: 'dashboard' | 'targets' | 'engine' | 'analytics') => void;
  onOpenSimulator?: () => void;
  onOpenProofGallery?: () => void;
  onOpenBulkImport?: () => void;
}

export const QuickMenuGrid: React.FC<QuickMenuGridProps> = ({
  onOpenQris,
  onOpenTargetModal,
  onOpenProxyModal,
  onOpenScheduleModal,
  onSwitchTab,
  onOpenSimulator,
  onOpenProofGallery,
  onOpenBulkImport,
}) => {
  return (
    <div className="modern-quick-menu-section">
      <div className="section-title-row">
        <h3 className="section-heading">Menu Cepat & Fitur Unggulan</h3>
        <span className="section-subtext">Akses Fitur Utama Bot</span>
      </div>

      <div className="quick-menu-grid">
        {/* 1. Eksekusi Bot Real-Time (Live Real Engine) */}
        {onOpenSimulator && (
          <div className="quick-menu-card highlight-glow" onClick={onOpenSimulator} style={{ borderLeft: '4px solid #f59e0b' }}>
            <div className="quick-card-icon amber">
              <i className="fa-solid fa-bolt"></i>
            </div>
            <div className="quick-card-info">
              <h5 className="quick-card-title flex items-center gap-1.5">
                Eksekusi Bot Real-Time
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded">REAL LIVE</span>
              </h5>
              <p className="quick-card-desc">Eksekusi sub-milidetik ke server Shopee</p>
            </div>
            <i className="fa-solid fa-chevron-right quick-card-arrow"></i>
          </div>
        )}

        {/* 2. Bukti Nyata Struk Rp 1.000 (Fitur #1) */}
        {onOpenProofGallery && (
          <div className="quick-menu-card" onClick={onOpenProofGallery} style={{ borderLeft: '4px solid #10b981' }}>
            <div className="quick-card-icon green">
              <i className="fa-solid fa-receipt"></i>
            </div>
            <div className="quick-card-info">
              <h5 className="quick-card-title flex items-center gap-1.5">
                Bukti Nyata Struk
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded">VERIFIED</span>
              </h5>
              <p className="quick-card-desc">Struk resmi iPhone & Emas 1rb</p>
            </div>
            <i className="fa-solid fa-chevron-right quick-card-arrow"></i>
          </div>
        )}

        {/* 3. Bulk Import Akun Massal (Fitur #5) */}
        {onOpenBulkImport && (
          <div className="quick-menu-card" onClick={onOpenBulkImport} style={{ borderLeft: '4px solid #2563eb' }}>
            <div className="quick-card-icon blue">
              <i className="fa-solid fa-file-import"></i>
            </div>
            <div className="quick-card-info">
              <h5 className="quick-card-title">Bulk Import Akun</h5>
              <p className="quick-card-desc">Multi-akun teks & cookies</p>
            </div>
            <i className="fa-solid fa-chevron-right quick-card-arrow"></i>
          </div>
        )}

        {/* 4. Sewa QRIS */}
        <div className="quick-menu-card" onClick={onOpenQris}>
          <div className="quick-card-icon purple">
            <i className="fa-solid fa-qrcode"></i>
          </div>
          <div className="quick-card-info">
            <h5 className="quick-card-title">Sewa via QRIS</h5>
            <p className="quick-card-desc">Top up / perpanjang lisensi</p>
          </div>
          <i className="fa-solid fa-chevron-right quick-card-arrow"></i>
        </div>

        {/* 5. Jadwal & Countdown */}
        <div className="quick-menu-card" onClick={onOpenScheduleModal}>
          <div className="quick-card-icon violet">
            <i className="fa-solid fa-clock"></i>
          </div>
          <div className="quick-card-info">
            <h5 className="quick-card-title">Jadwal & Timer</h5>
            <p className="quick-card-desc">Preset jam 00, 12, 18, 20</p>
          </div>
          <i className="fa-solid fa-chevron-right quick-card-arrow"></i>
        </div>

        {/* 6. Proxy Mesh */}
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
      </div>
    </div>
  );
};
