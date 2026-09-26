import React from 'react';
import { AseanCountryCode } from '../types/index.ts';

interface AseanFlagProps {
  code: AseanCountryCode | string;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export const AseanFlag: React.FC<AseanFlagProps> = ({
  code,
  className = '',
  size = 'sm',
}) => {
  const normalized = (code || 'ID').toUpperCase();

  const sizeClasses = {
    xs: 'w-4 h-3 rounded-[2px]',
    sm: 'w-5 h-3.5 rounded-[3px]',
    md: 'w-6 h-4 rounded-[4px]',
    lg: 'w-8 h-5 rounded-[4px]',
  }[size] || 'w-5 h-3.5 rounded-[3px]';

  // Crisp, accurate vector SVG for all 6 ASEAN countries
  const renderFlagSvg = () => {
    switch (normalized) {
      case 'ID': // Indonesia (Merah Putih)
        return (
          <svg viewBox="0 0 640 480" className="w-full h-full object-cover">
            <g fillRule="evenodd">
              <path fill="#e11d48" d="M0 0h640v240H0z" />
              <path fill="#ffffff" d="M0 240h640v240H0z" />
            </g>
          </svg>
        );

      case 'MY': // Malaysia (Jalur Gemilang)
        return (
          <svg viewBox="0 0 640 320" className="w-full h-full object-cover">
            <g>
              {/* 14 Stripes */}
              {[...Array(14)].map((_, i) => (
                <rect
                  key={i}
                  y={(i * 320) / 14}
                  width="640"
                  height={320 / 14 + 0.5}
                  fill={i % 2 === 0 ? '#dc2626' : '#ffffff'}
                />
              ))}
              {/* Blue Canton */}
              <rect x="0" y="0" width="320" height={(8 * 320) / 14} fill="#1e3a8a" />
              {/* Yellow Crescent */}
              <circle cx="130" cy="91" r="58" fill="#facc15" />
              <circle cx="146" cy="91" r="48" fill="#1e3a8a" />
              {/* Yellow Star */}
              <polygon
                fill="#facc15"
                points="180,91 193,98 188,84 200,75 185,74 180,60 175,74 160,75 172,84 167,98"
              />
            </g>
          </svg>
        );

      case 'SG': // Singapore
        return (
          <svg viewBox="0 0 640 426" className="w-full h-full object-cover">
            <g>
              <path fill="#dc2626" d="M0 0h640v213H0z" />
              <path fill="#ffffff" d="M0 213h640v213H0z" />
              {/* Crescent */}
              <circle cx="120" cy="106" r="66" fill="#ffffff" />
              <circle cx="142" cy="106" r="61" fill="#dc2626" />
              {/* 5 Stars arranged in pentagon */}
              <g fill="#ffffff" transform="translate(155, 66) scale(0.6)">
                <polygon points="15,0 19,12 30,12 21,19 24,30 15,23 6,30 9,19 0,12 11,12" />
              </g>
              <g fill="#ffffff" transform="translate(185, 88) scale(0.6)">
                <polygon points="15,0 19,12 30,12 21,19 24,30 15,23 6,30 9,19 0,12 11,12" />
              </g>
              <g fill="#ffffff" transform="translate(175, 126) scale(0.6)">
                <polygon points="15,0 19,12 30,12 21,19 24,30 15,23 6,30 9,19 0,12 11,12" />
              </g>
              <g fill="#ffffff" transform="translate(135, 126) scale(0.6)">
                <polygon points="15,0 19,12 30,12 21,19 24,30 15,23 6,30 9,19 0,12 11,12" />
              </g>
              <g fill="#ffffff" transform="translate(125, 88) scale(0.6)">
                <polygon points="15,0 19,12 30,12 21,19 24,30 15,23 6,30 9,19 0,12 11,12" />
              </g>
            </g>
          </svg>
        );

      case 'TH': // Thailand (Trairanga)
        return (
          <svg viewBox="0 0 640 426" className="w-full h-full object-cover">
            <g>
              <rect width="640" height="426" fill="#a51931" />
              <rect y="71" width="640" height="284" fill="#f4f5f8" />
              <rect y="142" width="640" height="142" fill="#2d2a4a" />
            </g>
          </svg>
        );

      case 'VN': // Vietnam (Cờ đỏ sao vàng)
        return (
          <svg viewBox="0 0 640 426" className="w-full h-full object-cover">
            <rect width="640" height="426" fill="#da251d" />
            <polygon
              fill="#ffff00"
              points="320,80 348,166 438,166 365,219 393,305 320,252 247,305 275,219 202,166 292,166"
            />
          </svg>
        );

      case 'PH': // Philippines
        return (
          <svg viewBox="0 0 640 320" className="w-full h-full object-cover">
            <rect width="640" height="160" fill="#0038a8" />
            <rect y="160" width="640" height="160" fill="#ce1126" />
            <polygon points="0,0 277,160 0,320" fill="#ffffff" />
            {/* Sun */}
            <circle cx="92" cy="160" r="30" fill="#fcd116" />
            {/* 3 Stars */}
            <polygon fill="#fcd116" points="25,40 30,55 45,55 33,65 37,80 25,70 13,80 17,65 5,55 20,55" transform="scale(0.6) translate(10, 20)" />
            <polygon fill="#fcd116" points="25,40 30,55 45,55 33,65 37,80 25,70 13,80 17,65 5,55 20,55" transform="scale(0.6) translate(10, 420)" />
            <polygon fill="#fcd116" points="25,40 30,55 45,55 33,65 37,80 25,70 13,80 17,65 5,55 20,55" transform="scale(0.6) translate(360, 220)" />
          </svg>
        );

      default:
        return (
          <div className="w-full h-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-700">
            {normalized}
          </div>
        );
    }
  };

  return (
    <span
      className={`inline-flex items-center justify-center overflow-hidden shrink-0 border border-black/10 shadow-xs ${sizeClasses} ${className}`}
      title={`Shopee Region: ${normalized}`}
      style={{ verticalAlign: 'middle' }}
    >
      {renderFlagSvg()}
    </span>
  );
};
