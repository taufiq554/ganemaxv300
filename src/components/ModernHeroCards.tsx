import React from 'react';
import { TargetUrl, ShopeeAccount, BotStats, AseanCountryCode } from '../types/index.ts';
import { ASEAN_REGIONS, formatAseanCurrency } from '../constants/asean.ts';
import { AseanFlag } from './AseanFlag.tsx';

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

// Smart universal product icon resolver (No hardcoded Apple logo!)
const getProductIcon = (title: string): string => {
  const t = (title || '').toLowerCase();
  if (t.includes('phone') || t.includes('hp') || t.includes('samsung') || t.includes('xiaomi') || t.includes('oppo') || t.includes('vivo') || t.includes('realme') || t.includes('infinix')) {
    return 'fa-solid fa-mobile-screen-button';
  }
  if (t.includes('laptop') || t.includes('notebook') || t.includes('macbook') || t.includes('asus') || t.includes('lenovo') || t.includes('acer')) {
    return 'fa-solid fa-laptop';
  }
  if (t.includes('ipad') || t.includes('tablet') || t.includes('tab')) {
    return 'fa-solid fa-tablet-screen-button';
  }
  if (t.includes('jam') || t.includes('watch')) {
    return 'fa-solid fa-clock';
  }
  if (t.includes('earphone') || t.includes('headphone') || t.includes('tws') || t.includes('airpod') || t.includes('audio')) {
    return 'fa-solid fa-headphones';
  }
  if (t.includes('sepatu') || t.includes('shoes') || t.includes('sneaker') || t.includes('sandal')) {
    return 'fa-solid fa-shoe-prints';
  }
  if (t.includes('baju') || t.includes('kaos') || t.includes('shirt') || t.includes('jaket') || t.includes('jersey') || t.includes('fashion')) {
    return 'fa-solid fa-shirt';
  }
  if (t.includes('kamera') || t.includes('camera')) {
    return 'fa-solid fa-camera';
  }
  if (t.includes('game') || t.includes('playstation') || t.includes('switch') || t.includes('nintendo') || t.includes('ps5') || t.includes('xbox')) {
    return 'fa-solid fa-gamepad';
  }
  // Default clean flash sale shopping bag icon for any generic item
  return 'fa-solid fa-bag-shopping';
};

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
  
  // Use selectedTarget if provided, otherwise default to region sample
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
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded ml-1">
                  <AseanFlag code={currentRegionInfo.code} size="xs" />
                  <span>{currentRegionInfo.code}</span>
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
            <div className="latency-indicator flex items-center gap-1.5">
              <span className={`latency-dot ${serverLatency < 20 ? 'fast' : 'normal'}`}></span>
              <span>Latensi: <strong>{serverLatency} ms</strong></span>
              <span className="meta-separator">•</span>
              <span className="inline-flex items-center gap-1" title={`Atomic Clock Pool: ${currentRegionInfo.ntpServer}`}>
                <AseanFlag code={currentRegionInfo.code} size="xs" />
                <span>{currentRegionInfo.ntpServer.split('.')[0]}: <strong>Detik 0</strong></span>
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

      {/* 2. Upcoming Flash Sale Targets (Duo Bento Cards) */}
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
              <div className="target-icon-circle purple" title={targetTitle}>
                <i className={getProductIcon(targetTitle)}></i>
              </div>
              <span className="target-badge-pill flex items-center gap-1">
                <i className="fa-solid fa-bolt text-amber-300"></i>
                <AseanFlag code={currentRegionInfo.code} size="xs" />
                <span>Siap Detik 0</span>
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
                {activeAccount?.nickname || `Akun Shopee ${currentRegionInfo.name}`}
              </h4>
              <div className="target-price-row">
                <span className="account-meta-text">
                  {activeAccount?.username ? `@${activeAccount.username}` : `Auto PIN ${currentRegionInfo.code === 'ID' ? 'ShopeePay' : 'Direct Pay'} ON`}
                </span>
              </div>
            </div>

            <div className="target-card-footer">
              <div className="target-time-info">
                <i className="fa-solid fa-shield-halved"></i>
                <span>Proxy Residential {currentRegionInfo.code} Aktif</span>
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
