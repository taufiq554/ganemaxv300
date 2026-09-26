import React from 'react';
import { TargetUrl, AseanCountryCode } from '../types/index.ts';
import { ASEAN_REGIONS, formatAseanCurrency } from '../constants/asean.ts';
import { AseanFlag } from './AseanFlag.tsx';

interface ProductCardProps {
  selectedUrl: TargetUrl | null;
  serverLatency: number;
  selectedRegion?: AseanCountryCode;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  selectedUrl,
  serverLatency,
  selectedRegion = 'ID',
}) => {
  const currentRegionInfo = ASEAN_REGIONS[selectedRegion] || ASEAN_REGIONS.ID;
  const formattedPrice = selectedUrl?.target_price
    ? formatAseanCurrency(Number(selectedUrl.target_price), selectedRegion)
    : formatAseanCurrency(0, selectedRegion);

  return (
    <div className="product-card">
      <div className="product-meta">
        <span className="stock-badge" id="previewStock">
          <i className="fa-solid fa-boxes-stacked"></i> Stok:{' '}
          {selectedUrl ? 'Synchronized' : 'Menunggu Target'}
        </span>
        <span
          className="badge"
          id="serverLatencyBadge"
          style={{ background: '#f1f5f9', color: '#0f172a' }}
        >
          <i className="fa-solid fa-wifi"></i> Latensi: {serverLatency} ms
        </span>
        <span
          className="badge inline-flex items-center gap-1.5"
          id="ntpClockBadge"
          style={{ background: '#e0f2fe', color: '#0369a1' }}
          title={`NTP Source: ${currentRegionInfo.ntpServer}`}
        >
          <i className="fa-solid fa-clock"></i>
          <AseanFlag code={currentRegionInfo.code} size="xs" />
          <span>NTP {currentRegionInfo.timezoneLabel}</span>
        </span>
      </div>
      <div className="product-name" id="previewTitle">
        {selectedUrl?.title || `Pilih URL Produk ${currentRegionInfo.domain} untuk melihat detail.`}
        {selectedUrl?.variant && (
          <span style={{ fontSize: '13px', color: '#64748b', marginLeft: '8px' }}>
            ({selectedUrl.variant})
          </span>
        )}
      </div>
      <div className="price-tag" id="previewPrice">
        {formattedPrice}
      </div>
    </div>
  );
};

