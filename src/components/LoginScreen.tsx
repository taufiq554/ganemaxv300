import React, { useState } from 'react';

interface LoginScreenProps {
  onLogin: (username: string, password: string) => Promise<boolean>;
  onOpenPaymentModal: () => void;
  isLoading: boolean;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLogin,
  onOpenPaymentModal,
  isLoading,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Silakan masukkan username dan password lisensi Anda.');
      return;
    }
    setError('');
    const ok = await onLogin(username.trim(), password.trim());
    if (!ok) {
      setError('Username atau password tidak cocok / masa aktif lisensi berakhir.');
    }
  };

  return (
    <div className="modern-auth-viewport">
      {/* Background Soft Ambient Lights */}
      <div className="modern-auth-glow glow-top"></div>
      <div className="modern-auth-glow glow-bottom"></div>

      <div className="modern-auth-container">
        {/* Main Card */}
        <div className="modern-auth-card">
          {/* Logo & Header */}
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
              <p className="modern-subtitle">Flash Sale Engine & Auto Checkout</p>
            </div>
          </div>

          {/* Error Notice */}
          {error && (
            <div className="modern-error-pill" role="alert">
              <i className="fa-solid fa-circle-exclamation"></i>
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="modern-form" noValidate>
            <div className="modern-field">
              <label htmlFor="auth-username" className="modern-field-label">
                Username Lisensi
              </label>
              <div className="modern-input-wrapper">
                <i className="fa-solid fa-user-tag modern-input-icon"></i>
                <input
                  id="auth-username"
                  type="text"
                  className="modern-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan username akun"
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
                <a
                  href="https://t.me/mrpangeranz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="modern-forgot-link"
                >
                  Bantuan / Lupa?
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
                  aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                  tabIndex={-1}
                >
                  <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>

            {/* Primary Action Button */}
            <button
              type="submit"
              className="modern-submit-btn"
              disabled={isLoading}
              id="btnLoginSubmit"
            >
              {isLoading ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin"></i>
                  <span>Mengautentikasi...</span>
                </>
              ) : (
                <>
                  <span>Masuk ke Dashboard</span>
                  <i className="fa-solid fa-arrow-right"></i>
                </>
              )}
            </button>
          </form>

          {/* Secondary Actions / QRIS Sewa */}
          <div className="modern-auth-footer">
            <div className="modern-divider">
              <span>atau aktivasi lisensi baru</span>
            </div>

            <div className="modern-actions-grid">
              <button
                type="button"
                className="modern-secondary-btn qris-btn"
                onClick={onOpenPaymentModal}
                id="btnOpenQrisModal"
              >
                <i className="fa-solid fa-qrcode"></i>
                <span>Sewa via QRIS Instant</span>
              </button>

              <a
                href="https://t.me/mrpangeranz"
                target="_blank"
                rel="noopener noreferrer"
                className="modern-secondary-btn wa-btn"
                style={{ background: '#0284c7', color: '#ffffff' }}
              >
                <i className="fa-brands fa-telegram"></i>
                <span>DM Telegram Admin</span>
              </a>
            </div>
          </div>
        </div>

        {/* Security Badge */}
        <div className="modern-auth-trust">
          <i className="fa-solid fa-shield-check"></i>
          <span>Sesi terenkripsi & auto-sync cloud aman</span>
        </div>
      </div>
    </div>
  );
};
