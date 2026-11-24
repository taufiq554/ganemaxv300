import React, { useEffect, useState } from 'react';
import { ArrowRight, Eye, EyeOff, Lock, QrCode, Send, TriangleAlert, User } from 'lucide-react';
import { useLang } from '../lib/i18n.tsx';
import { AuthScene } from './gx/AuthScene.tsx';

interface LoginScreenProps {
  onLogin: (username: string, password: string) => Promise<boolean>;
  onOpenPaymentModal: () => void;
  isLoading: boolean;
}

const REMEMBER_KEY = 'gx_remember_user';

/**
 * Login GaneMaX.Ai — gaya neumorphic putih-biru: permukaan lembut dengan
 * bayangan ganda (terang di kiri-atas, gelap di kanan-bawah) sehingga kolom
 * terlihat cekung dan tombol terlihat timbul.
 */
export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onOpenPaymentModal, isLoading }) => {
  const { L, lang, setLang } = useLang();
  const [username, setUsername] = useState(() => {
    try {
      return localStorage.getItem(REMEMBER_KEY) || '';
    } catch {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(() => {
    try {
      return !!localStorage.getItem(REMEMBER_KEY);
    } catch {
      return false;
    }
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  /*
   * Teks tombol saat login: berganti mengikuti tahap yang benar-benar dikerjakan,
   * jadi orang tahu proses masih jalan, bukan sekadar ikon berputar.
   */
  const STEPS = [
    L('Menghubungkan ke server…', 'Connecting to server…'),
    L('Memeriksa lisensi…', 'Verifying license…'),
    L('Menyiapkan dashboard…', 'Preparing dashboard…'),
  ];
  const [stepIdx, setStepIdx] = useState(0);
  const step = STEPS[Math.min(stepIdx, STEPS.length - 1)];
  useEffect(() => {
    if (!isLoading) {
      setStepIdx(0);
      return;
    }
    const id = window.setInterval(() => setStepIdx((v) => Math.min(v + 1, STEPS.length - 1)), 900);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const u = username.trim();
    const p = password.trim();
    if (!u || !p) {
      setError(L('Username dan password lisensi wajib diisi.', 'License username and password are required.'));
      return;
    }
    setError('');
    try {
      localStorage.setItem(REMEMBER_KEY, remember ? u : '');
      if (!remember) localStorage.removeItem(REMEMBER_KEY);
    } catch {
      // Penyimpanan diblokir (mode penyamaran) — login tetap jalan
    }
    const ok = await onLogin(u, p);
    if (!ok) {
      setError(L('Username atau password tidak cocok, atau masa aktif lisensi sudah habis.', 'Wrong username or password, or the license has expired.'));
    }
  };

  return (
    <div className="nx-auth gx-login">
      <AuthScene />

      <div className="nx-seg" role="group" aria-label="Language">
        <button type="button" aria-pressed={lang === 'id'} onClick={() => setLang('id')}>
          ID
        </button>
        <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>
          EN
        </button>
      </div>

      <main className="nx-card">
        <div className="nx-logo">
          <img
            src="/ganemax-logo.jpg"
            alt=""
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = 'https://files.catbox.moe/pi1r45.jpg';
            }}
          />
        </div>

        <h1 className="nx-title">GaneMaX.Ai</h1>
        <p className="nx-sub">{L('Masuk untuk lanjut', 'Sign in to continue')}</p>

        {error && (
          <div className="nx-error" role="alert">
            <TriangleAlert size={15} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="nx-field">
            <User size={17} aria-hidden="true" />
            <input
              id="auth-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={L('Username lisensi', 'License username')}
              aria-label={L('Username lisensi', 'License username')}
              disabled={isLoading}
              autoComplete="username"
              autoCapitalize="none"
              autoFocus={!username}
            />
          </div>

          <div className="nx-field">
            <Lock size={17} aria-hidden="true" />
            <input
              id="auth-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              aria-label="Password"
              disabled={isLoading}
              autoComplete="current-password"
              autoFocus={!!username}
            />
            <button
              type="button"
              className="nx-peek"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? L('Sembunyikan password', 'Hide password') : L('Lihat password', 'Show password')}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <div className="nx-row">
            <label className="nx-remember">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <span className="nx-box" aria-hidden="true" />
              <span>{L('Ingat saya', 'Remember me')}</span>
            </label>
            <a href="https://t.me/mrpangeranz" target="_blank" rel="noopener noreferrer" className="nx-forgot">
              {L('Lupa password?', 'Forgot password?')}
            </a>
          </div>

          <button type="submit" className="nx-login" disabled={isLoading} id="btnLoginSubmit">
            {isLoading ? (
              <>
                <span className="nx-login__steps">
                  <span className="nx-spin" aria-hidden="true" />
                  <span className="nx-login__txt">{step}</span>
                </span>
                {/* Tiga ruas = tiga tahap; yang sudah lewat terisi penuh. */}
                <span className="nx-prog" aria-hidden="true">
                  {STEPS.map((_, idx) => (
                    <i key={idx} className={idx < stepIdx ? 'is-done' : idx === stepIdx ? 'is-now' : ''} />
                  ))}
                </span>
              </>
            ) : (
              <>
                <span>{L('Masuk', 'Login')}</span>
                <span className="nx-login__go" aria-hidden="true">
                  <ArrowRight size={17} />
                </span>
              </>
            )}
          </button>
        </form>

        <div className="nx-divider">
          <span>{L('belum punya lisensi?', 'no license yet?')}</span>
        </div>

        <div className="nx-alt">
          <button type="button" onClick={onOpenPaymentModal} id="btnOpenQrisModal">
            <QrCode size={17} />
            <span>{L('Sewa via QRIS', 'Rent via QRIS')}</span>
          </button>
          <a href="https://t.me/mrpangeranz" target="_blank" rel="noopener noreferrer">
            <Send size={17} />
            <span>{L('Telegram admin', 'Telegram admin')}</span>
          </a>
        </div>
      </main>

      <p className="nx-foot">{L('Bot flash sale Shopee · 6 negara ASEAN', 'Shopee flash sale bot · 6 ASEAN countries')}</p>
    </div>
  );
};
