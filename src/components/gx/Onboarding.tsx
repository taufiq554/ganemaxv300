import React, { useEffect, useState } from 'react';
import {
  Crosshair,
  UserRound,
  CalendarClock,
  Zap,
  Hand,
  Download,
  Share,
  SquarePlus,
  ChevronRight,
  ChevronLeft,
  X,
  Check,
  Clock3,
} from 'lucide-react';
import { useLang } from '../../lib/i18n.tsx';
import { usePwaInstall } from '../../lib/pwa.ts';

const DONE_KEY = 'gx_onboarded_v1';

export function hasOnboarded(): boolean {
  try {
    return localStorage.getItem(DONE_KEY) === '1';
  } catch {
    return false;
  }
}
export function markOnboarded() {
  try {
    localStorage.setItem(DONE_KEY, '1');
  } catch {}
}

interface Step {
  icon: React.ComponentType<any>;
  title: [string, string];
  body: [string, string];
}

const STEPS: Step[] = [
  {
    icon: Crosshair,
    title: ['1. Tambah target produk', '1. Add a target product'],
    body: [
      'Buka tab Target → Tambah. Tempel link produk Shopee, lalu tekan "Hubungkan & ambil data produk". Bot otomatis mengisi nama & harga.',
      'Open the Target tab → Add. Paste the Shopee product link, then press "Integrate & fetch product". The bot auto-fills name & price.',
    ],
  },
  {
    icon: UserRound,
    title: ['2. Lengkapi akun & pembayaran', '2. Set up account & payment'],
    body: [
      'Login akun Shopee kamu langsung di app Shopee HP ini, lalu isi alamat & saldo/PIN di sana. Di dashboard cukup pilih metode bayar.',
      'Log in to your Shopee account in the Shopee app on this phone, and set address & balance/PIN there. In the dashboard just pick the payment method.',
    ],
  },
  {
    icon: CalendarClock,
    title: ['3. Pilih sesi & tekan Auto', '3. Pick a session & press Auto'],
    body: [
      'Di Beranda, pilih jam sesi flash sale (mis. 12:00) lalu tekan "Auto". Biarkan halaman terbuka & layar menyala sampai sesi dimulai.',
      'On Home, pick a flash sale time (e.g. 12:00) then press "Auto". Keep the page open and the screen on until the session starts.',
    ],
  },
  {
    icon: Hand,
    title: ['4. Tap "Beli" di detik 0', '4. Tap "Buy" at second zero'],
    body: [
      'Tepat di detik 0, bot membuka produk di Shopee. Kamu tinggal tap "Beli Sekarang" lalu bayar. Coba dulu mode Latihan untuk mengukur kecepatan tap kamu.',
      'Right at second zero the bot opens the product in Shopee. Just tap "Buy Now" and pay. Try Practice mode first to measure your tap speed.',
    ],
  },
];

export const Onboarding: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { L, lang } = useLang();
  const [i, setI] = useState(0);
  const pwa = usePwaInstall();

  useEffect(() => {
    if (open) setI(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && finish();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const finish = () => {
    markOnboarded();
    onClose();
  };

  const last = i === STEPS.length - 1;
  const step = STEPS[i];
  const Icon = step.icon;

  return (
    <div className="gx-overlay gx-overlay--center" role="dialog" aria-modal="true" aria-label={L('Panduan cepat', 'Quick guide')}>
      <div className="gx-onb" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="gx-iconbtn gx-onb__close" onClick={finish} aria-label={L('Lewati', 'Skip')}>
          <X size={16} />
        </button>

        <div className="gx-onb__hero">
          <span className="gx-onb__badge">{L('Panduan cepat', 'Quick guide')}</span>
          <div className="gx-onb__iconwrap">
            <Icon size={34} />
          </div>
        </div>

        <div className="gx-onb__body">
          <h3>{L(step.title[0], step.title[1])}</h3>
          <p>{L(step.body[0], step.body[1])}</p>

          {last && (
            <div className="gx-onb__install">
              {pwa.installed ? (
                <div className="gx-note" style={{ background: 'var(--gx-ok-soft)', borderColor: 'transparent' }}>
                  <Check size={15} />
                  <span>{L('Aplikasi sudah terpasang di HP kamu. Mantap!', 'The app is installed on your phone. Nice!')}</span>
                </div>
              ) : pwa.canInstall ? (
                <button
                  type="button"
                  className="gx-btn gx-btn--primary gx-btn--block"
                  onClick={async () => {
                    await pwa.promptInstall();
                  }}
                >
                  <Download size={16} /> {L('Pasang aplikasi ke layar HP', 'Install app to home screen')}
                </button>
              ) : pwa.isIOS ? (
                <div className="gx-note">
                  <SquarePlus size={16} />
                  <span>
                    {L('Pasang ke HP: tekan tombol ', 'Install to phone: tap ')}
                    <Share size={13} style={{ verticalAlign: '-2px' }} />
                    {L(' Bagikan di Safari, lalu "Tambah ke Layar Utama".', ' Share in Safari, then "Add to Home Screen".')}
                  </span>
                </div>
              ) : (
                <div className="gx-note">
                  <Clock3 size={15} />
                  <span>{L('Buka menu browser (⋮) lalu "Install app / Tambah ke layar utama" untuk memasang ke HP.', 'Open the browser menu (⋮) then "Install app / Add to Home screen".')}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="gx-onb__foot">
          <div className="gx-onb__dots" aria-hidden="true">
            {STEPS.map((_, idx) => (
              <span key={idx} className={idx === i ? 'is-on' : ''} />
            ))}
          </div>
          <div className="gx-onb__nav">
            {i > 0 && (
              <button type="button" className="gx-btn gx-btn--sm" onClick={() => setI((v) => v - 1)}>
                <ChevronLeft size={15} /> {L('Kembali', 'Back')}
              </button>
            )}
            {last ? (
              <button type="button" className="gx-btn gx-btn--sm gx-btn--primary" onClick={finish}>
                <Zap size={15} fill="currentColor" /> {L('Mulai pakai', 'Start')}
              </button>
            ) : (
              <button type="button" className="gx-btn gx-btn--sm gx-btn--primary" onClick={() => setI((v) => v + 1)}>
                {L('Lanjut', 'Next')} <ChevronRight size={15} />
              </button>
            )}
          </div>
        </div>
        {!last && (
          <button type="button" className="gx-onb__skip" onClick={finish}>
            {lang === 'en' ? 'Skip guide' : 'Lewati panduan'}
          </button>
        )}
      </div>
    </div>
  );
};

/** Tombol "Pasang app" kecil untuk ditaruh di menu/topbar bila browser mendukung. */
export const InstallButton: React.FC<{ className?: string }> = ({ className }) => {
  const { L } = useLang();
  const pwa = usePwaInstall();
  if (pwa.installed || !pwa.canInstall) return null;
  return (
    <button type="button" className={className || 'gx-menuitem'} onClick={() => pwa.promptInstall()}>
      <Download size={16} /> {L('Pasang aplikasi ke HP', 'Install app to phone')}
    </button>
  );
};
