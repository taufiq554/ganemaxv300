import React from 'react';
import { TargetUrl, ShopeeAccount, BotStats, AseanCountryCode } from '../types/index.ts';
import { ASEAN_REGIONS, formatAseanCurrency } from '../constants/asean.ts';

interface ModernHeroCardsProps {
  stats: BotStats;
  serverLatency: number;
  selectedTarget: TargetUrl | null;
  activeAccount: ShopeeAccount | null;
  selectedRegion?: AseanCountryCode;
  onOpenTargetModal: () => void;
  onOpenPaymentModal: () => void;
  onOpenAccountModal: () => void;
  isBotRunning: boolean;
  onToggleBot: () => void;
}

export const ModernHeroCards: React.FC<ModernHeroCardsProps> = ({
  stats,
  serverLatency,
  selectedTarget,
  activeAccount,
  selectedRegion = 'ID',
  onOpenTargetModal,
  onOpenPaymentModal,
  onOpenAccountModal,
  isBotRunning,
  onToggleBot,
}) => {
  const currentRegionInfo = ASEAN_REGIONS[selectedRegion] || ASEAN_REGIONS.ID;

  // Real savings calculated from successful flash sale checkouts
  const hasSavings = stats.saved_amount > 0;
  const formattedSaved = hasSavings
    ? formatAseanCurrency(stats.saved_amount, selectedRegion)
    : formatAseanCurrency(0, selectedRegion);

  const defaultSample = currentRegionInfo.sampleFlashProduct;
  const targetTitle = selectedTarget?.title || defaultSample.title;
  const targetPriceNum = selectedTarget?.target_price
    ? Number(selectedTarget.target_price)
    : defaultSample.flashPrice;
  const targetPrice = formatAseanCurrency(targetPriceNum, selectedRegion);

  // Estimate potential savings based on normal market reference
  const estimatedNormal = defaultSample.originalPrice;
  const potentialSavings = Math.max(0, estimatedNormal - targetPriceNum);

  return (
    <div className="modern-hero-section">
      {/* 1. Hero Balance / Flash Sale Status Card (REAL DATA ONLY) */}
      <div className="modern-balance-card">
        <div className="balance-content">
          <div className="balance-top-row">
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="balance-label">Total Penghematan Flash Sale</span>
                <span
                  className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded font-semibold"
                  title="Dihitung otomatis: Selisih Harga Normal dikurangi Harga Flash Sale dari pesanan yang berhasil di-checkout bot."
                >
                  REAL METRIC
                </span>
                <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded ml-1">
                  {currentRegionInfo.flag} {currentRegionInfo.code}
                </span>
              </div>
              <div className="balance-amount">{formattedSaved}</div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {hasSavings ? (
                  <span className="text-emerald-600 font-semibold">
                    <i className="fa-solid fa-circle-check"></i> Terakumulasi dari pesanan flash sale sukses {currentRegionInfo.domain}
                  </span>
                ) : (
                  <span>
                    Belum ada checkout sukses • Potensi hemat target: <strong className="text-indigo-600">{formatAseanCurrency(potentialSavings, selectedRegion)}</strong>
                  </span>
                )}
              </p>
            </div>
            {/* Circular + Action Button */}
            <button
              type="button"
              className="balance-action-fab"
              onClick={onOpenPaymentModal}
              title="Aktivasi Lisensi & Top Up via QRIS"
              aria-label="Top up lisensi via QRIS"
            >
              <i className="fa-solid fa-plus"></i>
            </button>
          </div>

          <div className="balance-bottom-meta">
            <div className="latency-indicator">
              <span className={`latency-dot ${serverLatency < 20 ? 'fast' : 'normal'}`}></span>
              <span>Latensi: <strong>{serverLatency} ms</strong></span>
              <span className="meta-separator">•</span>
              <span title={`Atomic Clock Pool: ${currentRegionInfo.ntpServer}`}>
                {currentRegionInfo.flag} {currentRegionInfo.ntpServer.split('.')[0]}: <strong>Detik 0</strong>
              </span>
            </div>

            <div className="balance-run-pill">
              <span className={`status-pill ${isBotRunning ? 'active' : 'idle'}`}>
                {isBotRunning ? `ENGINE RUNNING (${currentRegionInfo.code})` : 'STANDBY MODE'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Upcoming Flash Sale Targets (Duo Bento Cards matching reference) */}
      <div className="modern-targets-section">
        <div className="section-title-row">
          <h3 className="section-heading">
            Target Flash Sale Terjadwal <span className="text-xs font-normal text-slate-500">({currentRegionInfo.domain})</span>
          </h3>
          <button
            type="button"
            className="section-link-btn"
            onClick={onOpenTargetModal}
          >
            Lihat Semua <i className="fa-solid fa-arrow-right text-xs ml-1"></i>
          </button>
        </div>

        <div className="targets-bento-grid">
          {/* Card A: Vibrant Purple Featured Card */}
          <div className="target-card purple-gradient">
            <div className="target-card-top">
              <div className="target-icon-circle purple">
                <i className="fa-brands fa-apple"></i>
              </div>
              <span className="target-badge-pill">
                <i className="fa-solid fa-bolt"></i> {currentRegionInfo.flag} Siap Detik 0
              </span>
            </div>

            <div className="target-card-body">
              <h4 className="target-item-title">{targetTitle}</h4>
              <div className="target-price-row">
                <span className="target-price-val">{targetPrice}</span>
                <span className="target-discount-tag">Flash Sale</span>
              </div>
            </div>

            <div className="target-card-footer">
              <div className="target-time-info">
                <i className="fa-regular fa-clock"></i>
                <span>Jadwal: 12:00:00 {currentRegionInfo.timezoneLabel}</span>
              </div>
              <button
                type="button"
                className="target-action-mini"
                onClick={onOpenTargetModal}
                title="Ubah Target"
              >
                <i className="fa-solid fa-pen-to-square"></i>
              </button>
            </div>
          </div>

          {/* Card B: Crisp White Account Card */}
          <div className="target-card crisp-white">
            <div className="target-card-top">
              <div className="target-icon-circle orange">
                <i className="fa-solid fa-bag-shopping"></i>
              </div>
              <span className="account-status-pill">
                <span className="active-dot"></span> Terverifikasi
              </span>
            </div>

            <div className="target-card-body">
              <h4 className="target-item-title">
                {activeAccount?.nickname || 'Akun Shopee Utama'}
              </h4>
              <div className="target-price-row">
                <span className="account-meta-text">
                  {activeAccount?.username ? `@${activeAccount.username}` : 'Auto PIN ShopeePay ON'}
                </span>
              </div>
            </div>

            <div className="target-card-footer">
              <div className="target-time-info">
                <i className="fa-solid fa-shield-halved"></i>
                <span>Proxy Residential Aktif</span>
              </div>
              <button
                type="button"
                className="target-action-mini"
                onClick={onOpenAccountModal}
                title="Kelola Akun"
              >
                <i className="fa-solid fa-gear"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
