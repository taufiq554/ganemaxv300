import React, { useState } from 'react';
import { Eye, EyeOff, LogIn, QrCode, Send, ShieldCheck, Zap, Clock3, Globe } from 'lucide-react';
import { useLang } from '../lib/i18n.tsx';

interface LoginScreenProps {
  onLogin: (username: string, password: string) => Promise<boolean>;
  onOpenPaymentModal: () => void;
  isLoading: boolean;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onOpenPaymentModal, isLoading }) => {
  const { L, lang, setLang } = useLang();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError(L('Masukkan username dan password lisensi kamu.', 'Enter your license username and password.'));
      return;
    }
    setError('');
    const ok = await onLogin(username.trim(), password.trim());
    if (!ok) setError(L('Username/password salah atau masa aktif lisensi berakhir.', 'Wrong username/password or your license has expired.'));
  };

  return (
    <div className="gx-login">
      <div className="gx-login__card">
        <div className="gx-login__top">
          <div className="gx-login__brand">
            <img
              src="/ganemax-logo.jpg"
              alt=""
              onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = 'hidden')}
            />
            <div>
              <div className="gx-brand__name">
                GaneMaX<span>.Ai</span>
              </div>
              <div className="gx-brand__sub">{L('Bot Flash Sale Shopee ASEAN', 'Shopee ASEAN Flash Sale Bot')}</div>
            </div>
          </div>
          <div className="gx-seg" role="group" aria-label="Language">
            <button type="button" aria-pressed={lang === 'id'} onClick={() => setLang('id')}>
              ID
            </button>
            <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>
              EN
            </button>
          </div>
        </div>

        <div className="gx-login__hero">
          <h1>{L('Masuk ke dashboard bot', 'Sign in to the bot dashboard')}</h1>
          <p>{L('Jam tersinkron server, auto-start sesi, dan buka produk tepat di detik 0.', 'Server-synced clock, session auto-start, and product opening right at second zero.')}</p>
          <div className="gx-login__chips">
            <span>
              <Clock3 size={13} /> {L('Presisi milidetik', 'Millisecond precision')}
            </span>
            <span>
              <Zap size={13} /> Auto-start
            </span>
            <span>
              <Globe size={13} /> 6 {L('negara ASEAN', 'ASEAN countries')}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label className="gx-field">
            <span>{L('Username lisensi', 'License username')}</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder={L('Masukkan username', 'Enter username')} autoComplete="username" disabled={isLoading} />
          </label>
          <label className="gx-field">
            <span style={{ display: 'flex', justifyContent: 'space-between' }}>
              Password
              <a href="https://t.me/mrpangeranz" target="_blank" rel="noopener noreferrer" className="gx-link">
                {L('Lupa password?', 'Forgot password?')}
              </a>
            </span>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={isLoading}
                style={{ paddingRight: 42 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? L('Sembunyikan password', 'Hide password') : L('Lihat password', 'Show password')}
                style={{ position: 'absolute', right: 8, top: 8, border: 0, background: 'none', color: 'var(--gx-ink-3)', cursor: 'pointer', padding: 4 }}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </label>
          {error && (
            <div className="gx-note gx-note--bad" role="alert">
              {error}
            </div>
          )}
          <button type="submit" className="gx-btn gx-btn--lg gx-btn--primary gx-btn--block" disabled={isLoading}>
            <LogIn size={18} /> {isLoading ? L('Memeriksa…', 'Checking…') : L('Masuk', 'Sign in')}
          </button>
        </form>

        <div className="gx-login__divider">
          <span>{L('belum punya lisensi?', "don't have a license?")}</span>
        </div>
        <div className="gx-login__actions">
          <button type="button" className="gx-btn" onClick={onOpenPaymentModal}>
            <QrCode size={16} /> {L('Sewa via QRIS', 'Rent via QRIS')}
          </button>
          <a className="gx-btn" href="https://t.me/mrpangeranz" target="_blank" rel="noopener noreferrer">
            <Send size={15} /> {L('Telegram admin', 'Telegram admin')}
          </a>
        </div>
      </div>
      <div className="gx-login__trust">
        <ShieldCheck size={14} /> {L('Login aman · data tersimpan di cloud', 'Secure login · data stored in the cloud')}
      </div>
    </div>
  );
};
