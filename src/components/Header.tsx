import React, { useState, useRef, useEffect } from 'react';
import { User, AseanCountryCode } from '../types/index.ts';
import { ASEAN_REGIONS, ALL_ASEAN_CODES } from '../constants/asean.ts';

interface HeaderProps {
  currentUser: User | null;
  isDarkTheme: boolean;
  selectedRegion?: AseanCountryCode;
  onSelectRegion?: (code: AseanCountryCode) => void;
  onToggleTheme: () => void;
  onOpenWhatsappModal: () => void;
  onOpenPaymentModal: () => void;
  onRequestNotification: () => void;
  onExportData: () => void;
  onImportData: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleMusic: () => void;
  isPlayingMusic: boolean;
  onLogout: () => void;
  isBotRunning?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  isDarkTheme,
  selectedRegion = 'ID',
  onSelectRegion,
  onToggleTheme,
  onOpenWhatsappModal,
  onOpenPaymentModal,
  onRequestNotification,
  onExportData,
  onImportData,
  onToggleMusic,
  isPlayingMusic,
  onLogout,
  isBotRunning = false,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRegionMenuOpen, setIsRegionMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const regionRef = useRef<HTMLDivElement>(null);

  const currentRegionInfo = ASEAN_REGIONS[selectedRegion] || ASEAN_REGIONS.ID;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isMenuOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
      if (isRegionMenuOpen && regionRef.current && !regionRef.current.contains(e.target as Node)) {
        setIsRegionMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen, isRegionMenuOpen]);

  const username = currentUser?.username || 'Member';

  return (
    <header className="modern-app-header">
      <div className="header-container">
        {/* Left: User Profile & Greeting matching reference */}
        <div className="header-user-group">
          <div className="header-avatar-wrapper">
            <img
              src="/ganemax-logo.jpg"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = 'https://files.catbox.moe/pi1r45.jpg';
              }}
              alt="GaneMaX AI"
              className="header-avatar-img"
            />
            <span className={`header-status-indicator ${isBotRunning ? 'running' : 'idle'}`}></span>
          </div>

          <div className="header-greeting-info">
            <div className="header-greeting-title">
              Hello, <strong>{username}!</strong>
            </div>
            <div className="header-brand-sub">
              <span>GaneMaX AI</span>
              <span className="role-tag">{currentUser?.role?.toUpperCase() || 'PRO'}</span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#0284c7',
                  background: '#e0f2fe',
                  padding: '1px 6px',
                  borderRadius: '6px',
                  marginLeft: '4px',
                }}
                title={`Target Server: ${currentRegionInfo.domain}`}
              >
                {currentRegionInfo.flag} {currentRegionInfo.code}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="header-controls-group">
          {/* ASEAN Regional Selector */}
          <div className="header-dropdown-anchor" ref={regionRef}>
            <button
              type="button"
              className="header-qris-pill-btn"
              onClick={() => setIsRegionMenuOpen(!isRegionMenuOpen)}
              title="Pilih Negara Shopee ASEAN"
              style={{
                background: isDarkTheme ? '#1e293b' : '#f1f5f9',
                color: isDarkTheme ? '#f8fafc' : '#0f172a',
                border: '1px solid #cbd5e1',
                padding: '6px 10px',
                gap: '6px',
              }}
            >
              <span style={{ fontSize: '15px' }}>{currentRegionInfo.flag}</span>
              <span style={{ fontWeight: 800, fontSize: '12px' }}>{currentRegionInfo.code}</span>
              <span style={{ fontSize: '10px', color: '#64748b' }}>({currentRegionInfo.currencySymbol})</span>
              <i className="fa-solid fa-chevron-down" style={{ fontSize: '9px', marginLeft: '2px' }}></i>
            </button>

            {isRegionMenuOpen && (
              <div
                className="header-dropdown-menu"
                style={{ minWidth: '220px', padding: '6px', zIndex: 100 }}
              >
                <div
                  style={{
                    padding: '6px 10px',
                    fontSize: '10px',
                    fontWeight: 800,
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    borderBottom: '1px solid #e2e8f0',
                    marginBottom: '4px',
                  }}
                >
                  <i className="fa-solid fa-earth-asia" style={{ color: '#0284c7', marginRight: '4px' }}></i>
                  Shopee ASEAN Region
                </div>
                {ALL_ASEAN_CODES.map((code) => {
                  const reg = ASEAN_REGIONS[code];
                  const isSelected = selectedRegion === code;
                  return (
                    <button
                      key={code}
                      type="button"
                      className="dropdown-item"
                      onClick={() => {
                        onSelectRegion?.(code);
                        setIsRegionMenuOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: isSelected ? '#eff6ff' : 'transparent',
                        color: isSelected ? '#1d4ed8' : 'inherit',
                        fontWeight: isSelected ? 700 : 500,
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '16px' }}>{reg.flag}</span>
                        <span>{reg.name}</span>
                      </span>
                      <span style={{ fontSize: '11px', color: isSelected ? '#2563eb' : '#64748b', fontFamily: 'monospace' }}>
                        {reg.domain}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notification Button */}
          <button
            type="button"
            className="header-icon-btn"
            onClick={onRequestNotification}
            title="Aktifkan Notifikasi Browser"
            aria-label="Notifikasi"
          >
            <i className="fa-regular fa-bell"></i>
            <span className="notification-dot"></span>
          </button>

          {/* Music Audio Toggle */}
          <button
            type="button"
            className={`header-icon-btn ${isPlayingMusic ? 'active-audio' : ''}`}
            onClick={onToggleMusic}
            title={isPlayingMusic ? 'Matikan Audio' : 'Nyalakan Audio'}
            aria-label="Toggle Musik"
          >
            <i className={`fa-solid ${isPlayingMusic ? 'fa-volume-high' : 'fa-volume-xmark'}`}></i>
          </button>

          {/* Theme Toggle */}
          <button
            type="button"
            className="header-icon-btn"
            onClick={onToggleTheme}
            title={isDarkTheme ? 'Ganti ke Light Mode' : 'Ganti ke Dark Mode'}
            aria-label="Toggle Tema"
          >
            <i className={`fa-solid ${isDarkTheme ? 'fa-sun' : 'fa-moon'}`}></i>
          </button>

          {/* Top Up / Sewa QRIS Action */}
          <button
            type="button"
            className="header-qris-pill-btn"
            onClick={onOpenPaymentModal}
            id="btnHeaderQris"
          >
            <i className="fa-solid fa-qrcode"></i>
            <span>Sewa via QRIS</span>
          </button>

          {/* More Options Dropdown Toggle */}
          <div className="header-dropdown-anchor" ref={menuRef}>
            <button
              type="button"
              className="header-icon-btn"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Menu Opsi"
            >
              <i className="fa-solid fa-ellipsis-vertical"></i>
            </button>

            {isMenuOpen && (
              <div className="header-dropdown-menu">
                <button
                  type="button"
                  className="dropdown-item"
                  onClick={() => {
                    onOpenWhatsappModal();
                    setIsMenuOpen(false);
                  }}
                >
                  <i className="fa-brands fa-whatsapp text-emerald-500"></i>
                  <span>Saluran WhatsApp VIP</span>
                </button>

                <button
                  type="button"
                  className="dropdown-item"
                  onClick={() => {
                    onExportData();
                    setIsMenuOpen(false);
                  }}
                >
                  <i className="fa-solid fa-cloud-arrow-down text-blue-500"></i>
                  <span>Backup Konfigurasi</span>
                </button>

                <button
                  type="button"
                  className="dropdown-item"
                  onClick={() => {
                    fileInputRef.current?.click();
                    setIsMenuOpen(false);
                  }}
                >
                  <i className="fa-solid fa-cloud-arrow-up text-violet-500"></i>
                  <span>Restore Konfigurasi</span>
                </button>

                <div className="dropdown-divider"></div>

                <button
                  type="button"
                  className="dropdown-item text-red-500"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onLogout();
                  }}
                >
                  <i className="fa-solid fa-right-from-bracket"></i>
                  <span>Keluar Akun</span>
                </button>
              </div>
            )}
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={onImportData}
            style={{ display: 'none' }}
            accept=".json"
          />
        </div>
      </div>
    </header>
  );
};
