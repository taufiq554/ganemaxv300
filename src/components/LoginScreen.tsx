import React, { useState } from 'react';
import { useLang } from '../lib/i18n.tsx';

interface LoginScreenProps {
  onLogin: (username: string, password: string) => Promise<boolean>;
  onOpenPaymentModal: () => void;
  isLoading: boolean;
}

/**
 * Tampilan login asli GaneMaX.Ai (kartu "modern-auth").
 * Pemilih bahasa ID/EN tetap dipertahankan karena dipakai di seluruh app.
 */
export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onOpenPaymentModal, isLoading }) => {
  const { L, lang, setLang } = useLang();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError(L('Silakan masukkan username dan password lisensi Anda.', 'Please enter your license username and password.'));
      return;
    }
    setError('');
    const ok = await onLogin(username.trim(), password.trim());
    if (!ok) {
      setError(L('Username atau password tidak cocok / masa aktif lisensi berakhir.', 'Wrong username or password / your license has expired.'));
    }
  };

  return (
    <div className="modern-auth-viewport gx-login">
      {/* Cahaya ambient latar */}
      <div className="modern-auth-glow glow-top"></div>
      <div className="modern-auth-glow glow-bottom"></div>

      <div className="modern-auth-container">
        <div className="modern-auth-card">
          {/* Logo & judul */}
          <div className="modern-auth-header">
            <div className="modern-logo-wrapper">
              <img
                src="/ganemax-logo.jpg"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = 'https://files.catbox.moe/pi1r45.jpg';
                }}
                alt="Logo GaneMaX.Ai"
                className="modern-logo-img"
              />
              <span className="modern-logo-pulse"></span>
            </div>
            <div className="modern-brand-text">
              <h1 className="modern-title">GaneMaX AI</h1>
              <p className="modern-subtitle">{L('Flash Sale Engine & Auto Checkout', 'Flash Sale Engine & Auto Checkout')}</p>
            </div>
            <div className="gx-seg modern-lang-seg" role="group" aria-label="Language">
              <button type="button" aria-pressed={lang === 'id'} onClick={() => setLang('id')}>
                ID
              </button>
              <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>
                EN
              </button>
            </div>
          </div>

          {/* Pesan error */}
          {error && (
            <div className="modern-error-pill" role="alert">
              <i className="fa-solid fa-circle-exclamation"></i>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="modern-form" noValidate>
            <div className="modern-field">
              <label htmlFor="auth-username" className="modern-field-label">
                {L('Username Lisensi', 'License Username')}
              </label>
              <div className="modern-input-wrapper">
                <i className="fa-solid fa-user-tag modern-input-icon"></i>
                <input
                  id="auth-username"
                  type="text"
                  className="modern-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={L('Masukkan username akun', 'Enter your account username')}
                  disabled={isLoading}
                  autoComplete="username"
                  autoCapitalize="none"
                  autoFocus
                />
              </div>
            </div>

            <div className="modern-field">
              <div className="modern-field-row">
                <label htmlFor="auth-password" className="modern-field-label">
                  Password
                </label>
                <a href="https://t.me/mrpangeranz" target="_blank" rel="noopener noreferrer" className="modern-forgot-link">
                  {L('Bantuan / Lupa?', 'Help / Forgot?')}
                </a>
              </div>
              <div className="modern-input-wrapper">
                <i className="fa-solid fa-lock modern-input-icon"></i>
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  className="modern-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isLoading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="modern-pwd-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? L('Sembunyikan password', 'Hide password') : L('Lihat password', 'Show password')}
                  tabIndex={-1}
                >
                  <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>

            <button type="submit" className="modern-submit-btn" disabled={isLoading} id="btnLoginSubmit">
              {isLoading ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin"></i>
                  <span>{L('Mengautentikasi...', 'Authenticating...')}</span>
                </>
              ) : (
                <>
                  <span>{L('Masuk ke Dashboard', 'Sign in to Dashboard')}</span>
                  <i className="fa-solid fa-arrow-right"></i>
                </>
              )}
            </button>
          </form>

          {/* Aktivasi lisensi */}
          <div className="modern-auth-footer">
            <div className="modern-divider">
              <span>{L('atau aktivasi lisensi baru', 'or activate a new license')}</span>
            </div>

            <div className="modern-actions-grid">
              <button type="button" className="modern-secondary-btn qris-btn" onClick={onOpenPaymentModal} id="btnOpenQrisModal">
                <i className="fa-solid fa-qrcode"></i>
                <span>{L('Sewa via QRIS Instant', 'Rent via QRIS Instant')}</span>
              </button>

              <a
                href="https://t.me/mrpangeranz"
                target="_blank"
                rel="noopener noreferrer"
                className="modern-secondary-btn wa-btn"
                style={{ background: '#0284c7', color: '#ffffff' }}
              >
                <i className="fa-brands fa-telegram"></i>
                <span>{L('DM Telegram Admin', 'DM Telegram Admin')}</span>
              </a>
            </div>
          </div>
        </div>

        <div className="modern-auth-trust">
          <i className="fa-solid fa-shield-halved"></i>
          <span>{L('Sesi terenkripsi & auto-sync cloud aman', 'Encrypted session & secure cloud auto-sync')}</span>
        </div>
      </div>
    </div>
  );
};
