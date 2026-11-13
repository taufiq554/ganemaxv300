import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Moon,
  Sun,
  MoreVertical,
  QrCode,
  LogOut,
  Download,
  Upload,
  Volume2,
  VolumeX,
  MessageCircle,
  ChevronDown,
  House,
  Crosshair,
  SlidersHorizontal,
  History,
  ShieldCheck,
  Zap,
  Square,
  BellRing,
  X,
  Megaphone,
  Info,
  BadgePercent,
  TriangleAlert,
  Wrench,
  ExternalLink,
  Languages,
  GraduationCap,
} from 'lucide-react';
import { useLang } from '../../lib/i18n.tsx';
import { usePwaInstall } from '../../lib/pwa.ts';
import { User, AseanCountryCode, AppTab, Announcement } from '../../types/index.ts';
import { ASEAN_REGIONS, ALL_ASEAN_CODES } from '../../constants/asean.ts';
import { AseanFlag } from '../AseanFlag.tsx';
import { ServerClock } from '../../lib/useServerClock.ts';
import { formatClock, relativeTimeId } from '../../lib/time.ts';
import { useTicker } from '../../lib/useServerClock.ts';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function useOutsideClose(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
}

export function licenseInfo(user: User | null, now = Date.now(), lang: 'id' | 'en' = 'id') {
  const en = lang === 'en';
  if (!user) return { label: '-', tone: 'muted' as const, days: null as number | null };
  if (user.role === 'admin' && !user.expired_at) return { label: 'Admin', tone: 'brand' as const, days: null };
  if (!user.expired_at) return { label: 'Lifetime', tone: 'ok' as const, days: null };
  const ms = new Date(user.expired_at).getTime() - now;
  if (isNaN(ms)) return { label: 'Lifetime', tone: 'ok' as const, days: null };
  const days = Math.ceil(ms / 86_400_000);
  if (days <= 0) return { label: en ? 'License expired' : 'Lisensi habis', tone: 'bad' as const, days: 0 };
  if (days <= 3) return { label: en ? `${days} days left` : `Sisa ${days} hari`, tone: 'warn' as const, days };
  return { label: en ? `${days} days left` : `Sisa ${days} hari`, tone: 'ok' as const, days };
}

const LiveClockText: React.FC<{ clock: ServerClock; tz: string }> = ({ clock, tz }) => {
  useTicker(250);
  return <b>{formatClock(clock.now(), tz)}</b>;
};

/* ------------------------------------------------------------------ */
/* Top bar                                                             */
/* ------------------------------------------------------------------ */

export const NAV_ITEMS: { id: AppTab; label: string; en: string; icon: React.ComponentType<any>; adminOnly?: boolean }[] = [
  { id: 'dashboard', label: 'Beranda', en: 'Home', icon: House },
  { id: 'targets', label: 'Target', en: 'Targets', icon: Crosshair },
  { id: 'engine', label: 'Engine', en: 'Engine', icon: SlidersHorizontal },
  { id: 'analytics', label: 'Riwayat', en: 'History', icon: History },
  { id: 'admin', label: 'Admin', en: 'Admin', icon: ShieldCheck, adminOnly: true },
];

interface TopBarProps {
  user: User;
  tab: AppTab;
  onTab: (t: AppTab) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  region: AseanCountryCode;
  onRegion: (r: AseanCountryCode) => void;
  clock: ServerClock;
  unreadCount: number;
  onOpenAnnouncements: () => void;
  onOpenQris: () => void;
  onOpenWhatsapp: () => void;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleMusic: () => void;
  isPlayingMusic: boolean;
  onLogout: () => void;
  isBotRunning: boolean;
  onOpenGuide?: () => void;
}

const InstallMenuItem: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const { L } = useLang();
  const pwa = usePwaInstall();
  if (pwa.installed || !pwa.canInstall) return null;
  return (
    <button type="button" className="gx-menuitem" onClick={() => { pwa.promptInstall(); onClick(); }}>
      <Download size={16} /> {L('Pasang aplikasi ke HP', 'Install app to phone')}
    </button>
  );
};

export const TopBar: React.FC<TopBarProps> = ({
  user,
  tab,
  onTab,
  isDark,
  onToggleTheme,
  region,
  onRegion,
  clock,
  unreadCount,
  onOpenAnnouncements,
  onOpenQris,
  onOpenWhatsapp,
  onExport,
  onImport,
  onToggleMusic,
  isPlayingMusic,
  onLogout,
  isBotRunning,
  onOpenGuide,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [regionOpen, setRegionOpen] = useState(false);
  const menuRef = useOutsideClose(menuOpen, () => setMenuOpen(false));
  const regionRef = useOutsideClose(regionOpen, () => setRegionOpen(false));
  const fileRef = useRef<HTMLInputElement>(null);
  const reg = ASEAN_REGIONS[region] || ASEAN_REGIONS.ID;
  const { L, lang, setLang } = useLang();
  const lic = licenseInfo(user, Date.now(), lang);

  return (
    <header className="gx-topbar">
      <div className="gx-topbar__inner">
        <div className="gx-greet">
          <span className="gx-greet__avatar" title={`@${user.username} · ${lic.label}`}>
            {user.username.slice(0, 1)}
            <span className={`gx-greet__status ${isBotRunning ? 'gx-greet__status--run' : ''}`} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="gx-greet__hi">
              {L('Halo,', 'Hello,')}
              {isBotRunning && <span style={{ color: 'var(--gx-brand)', fontWeight: 700 }}> · {L('engine berjalan', 'engine running')}</span>}
              {!isBotRunning && (lic.tone === 'bad' || lic.tone === 'warn') && (
                <span style={{ color: lic.tone === 'bad' ? 'var(--gx-bad)' : 'var(--gx-warn)', fontWeight: 700 }}> · {lic.label}</span>
              )}
            </div>
            <div className="gx-greet__name">{user.username}!</div>
          </div>
        </div>

        <nav className="gx-topnav" aria-label={L('Navigasi utama', 'Main navigation')}>
          {NAV_ITEMS.filter((n) => !n.adminOnly || user.role === 'admin').map((n) => (
            <button key={n.id} type="button" aria-current={tab === n.id ? 'page' : undefined} onClick={() => onTab(n.id)}>
              {L(n.label, n.en)}
            </button>
          ))}
        </nav>

        <div className="gx-topbar__right">
          <span className="gx-clockchip" title={clock.synced ? L(`Tersinkron ke server (selisih ${clock.offsetMs} ms)`, `Synced to server (offset ${clock.offsetMs} ms)`) : L('Belum tersinkron, memakai jam perangkat', 'Not synced yet, using device clock')}>
            <span className="gx-led" style={{ color: clock.synced ? 'var(--gx-ok)' : 'var(--gx-warn)' }} />
            <LiveClockText clock={clock} tz={reg.timezone} />
            <span>{reg.timezoneLabel.split(' ')[0]}</span>
          </span>

          <div style={{ position: 'relative' }} ref={regionRef}>
            <button type="button" className="gx-pillbtn" onClick={() => setRegionOpen((v) => !v)} aria-haspopup="menu" aria-expanded={regionOpen}>
              <AseanFlag code={reg.code} size="sm" />
              <span>{reg.code}</span>
              <ChevronDown size={14} />
            </button>
            {regionOpen && (
              <div className="gx-popover" role="menu">
                <div className="gx-popover__label">{L('Wilayah Shopee', 'Shopee region')}</div>
                {ALL_ASEAN_CODES.map((code) => {
                  const r = ASEAN_REGIONS[code];
                  return (
                    <button
                      key={code}
                      type="button"
                      role="menuitemradio"
                      aria-selected={code === region}
                      className="gx-menuitem"
                      onClick={() => {
                        onRegion(code);
                        setRegionOpen(false);
                      }}
                    >
                      <AseanFlag code={code} size="sm" />
                      <span>{r.name}</span>
                      <small>{r.domain}</small>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button type="button" className="gx-iconbtn" onClick={onOpenAnnouncements} aria-label={L('Pengumuman', 'Announcements')}>
            <Bell size={17} />
            {unreadCount > 0 && <span className="gx-dot">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>

          <button type="button" className="gx-iconbtn" onClick={onToggleTheme} aria-label={L('Ganti tema', 'Toggle theme')}>
            {isDark ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          <div style={{ position: 'relative' }} ref={menuRef}>
            <button type="button" className="gx-iconbtn" onClick={() => setMenuOpen((v) => !v)} aria-label={L('Menu lainnya', 'More menu')} aria-expanded={menuOpen}>
              <MoreVertical size={17} />
            </button>
            {menuOpen && (
              <div className="gx-popover" role="menu">
                <div className="gx-popover__label">{L('Akun', 'Account')} @{user.username}</div>
                <button type="button" className="gx-menuitem" onClick={() => { onOpenQris(); setMenuOpen(false); }}>
                  <QrCode size={16} /> {L('Perpanjang / sewa via QRIS', 'Renew / rent via QRIS')}
                </button>
                <button type="button" className="gx-menuitem" onClick={() => { onOpenWhatsapp(); setMenuOpen(false); }}>
                  <MessageCircle size={16} /> {L('Saluran WhatsApp', 'WhatsApp channel')}
                </button>
                <button type="button" className="gx-menuitem" onClick={() => { onToggleMusic(); setMenuOpen(false); }}>
                  {isPlayingMusic ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  {isPlayingMusic ? L('Matikan musik latar', 'Stop background music') : L('Putar musik latar', 'Play background music')}
                </button>
                <button type="button" className="gx-menuitem" onClick={() => { onOpenGuide?.(); setMenuOpen(false); }}>
                  <GraduationCap size={16} /> {L('Panduan cepat', 'Quick guide')}
                </button>
                <InstallMenuItem onClick={() => setMenuOpen(false)} />
                <div className="gx-menudiv" />
                <button type="button" className="gx-menuitem" onClick={() => { setLang(lang === 'en' ? 'id' : 'en'); setMenuOpen(false); }}>
                  <Languages size={16} /> {lang === 'en' ? 'Bahasa Indonesia' : 'English'}
                  <small>{lang === 'en' ? 'ID' : 'EN'}</small>
                </button>
                <div className="gx-menudiv" />
                <button type="button" className="gx-menuitem" onClick={() => { onExport(); setMenuOpen(false); }}>
                  <Download size={16} /> {L('Backup konfigurasi', 'Back up settings')}
                </button>
                <button type="button" className="gx-menuitem" onClick={() => { fileRef.current?.click(); setMenuOpen(false); }}>
                  <Upload size={16} /> {L('Restore konfigurasi', 'Restore settings')}
                </button>
                <div className="gx-menudiv" />
                <button type="button" className="gx-menuitem gx-menuitem--danger" onClick={() => { setMenuOpen(false); onLogout(); }}>
                  <LogOut size={16} /> {L('Keluar', 'Log out')}
                </button>
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              onImport(e);
              e.target.value = '';
            }}
          />
        </div>
      </div>
    </header>
  );
};

/* ------------------------------------------------------------------ */
/* Bottom dock (mobile)                                                */
/* ------------------------------------------------------------------ */

export const Dock: React.FC<{
  tab: AppTab;
  onTab: (t: AppTab) => void;
  isAdmin: boolean;
  isBotRunning: boolean;
  onToggleBot: () => void;
}> = ({ tab, onTab, isAdmin, isBotRunning, onToggleBot }) => {
  const { L } = useLang();
  const items = NAV_ITEMS.filter((n) => !n.adminOnly || isAdmin);
  const left = items.slice(0, 2);
  const right = items.slice(2);
  const renderTab = (n: (typeof NAV_ITEMS)[number]) => {
    const Icon = n.icon;
    return (
      <button key={n.id} type="button" className="gx-dock__tab" aria-current={tab === n.id ? 'page' : undefined} onClick={() => onTab(n.id)}>
        <Icon size={19} />
        <span>{L(n.label, n.en)}</span>
      </button>
    );
  };
  return (
    <nav className="gx-dock" aria-label={L('Navigasi bawah', 'Bottom navigation')}>
      {left.map(renderTab)}
      <button
        type="button"
        className={`gx-dock__fire ${isBotRunning ? 'gx-dock__fire--running' : ''}`}
        onClick={onToggleBot}
        aria-label={isBotRunning ? L('Hentikan bot', 'Stop bot') : L('Jalankan bot', 'Run bot')}
      >
        <img
          src="/ganemax-logo.jpg"
          alt=""
          className="gx-dock__logo"
          onError={(e) => {
            const img = e.currentTarget as HTMLImageElement;
            if (!img.dataset.fallback) {
              img.dataset.fallback = '1';
              img.src = 'https://files.catbox.moe/pi1r45.jpg';
            }
          }}
        />
        {isBotRunning && (
          <span className="gx-dock__stop" aria-hidden="true">
            <Square size={10} fill="currentColor" />
          </span>
        )}
      </button>
      {right.map(renderTab)}
    </nav>
  );
};

/* ------------------------------------------------------------------ */
/* Announcements                                                       */
/* ------------------------------------------------------------------ */

export const ANNOUNCE_META: Record<Announcement['type'], { label: string; en: string; icon: React.ComponentType<any>; tag: string }> = {
  info: { label: 'Info', en: 'Info', icon: Info, tag: 'gx-tag--brand' },
  promo: { label: 'Promo', en: 'Promo', icon: BadgePercent, tag: 'gx-tag--flash' },
  warning: { label: 'Penting', en: 'Important', icon: TriangleAlert, tag: 'gx-tag--warn' },
  maintenance: { label: 'Maintenance', en: 'Maintenance', icon: Wrench, tag: 'gx-tag--bad' },
};

export function isAnnouncementLive(a: Announcement, now = Date.now()) {
  if (!a.is_active) return false;
  if (a.starts_at && new Date(a.starts_at).getTime() > now) return false;
  if (a.expires_at && new Date(a.expires_at).getTime() < now) return false;
  return true;
}

export function sortAnnouncements(list: Announcement[]) {
  return [...list].sort((a, b) => {
    if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });
}

export const AnnouncementCard: React.FC<{
  a: Announcement;
  onDismiss?: () => void;
  compact?: boolean;
}> = ({ a, onDismiss, compact }) => {
  const { L, lang } = useLang();
  const meta = ANNOUNCE_META[a.type] || ANNOUNCE_META.info;
  const Icon = meta.icon;
  return (
    <article className={`gx-announce gx-announce--${a.type}`}>
      <span className="gx-announce__icon">
        <Icon size={16} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="gx-announce__t">{a.title || 'Pengumuman'}</span>
          {a.pinned && <span className="gx-tag">{L('Disematkan', 'Pinned')}</span>}
        </div>
        {a.body && (
          <div className="gx-announce__b" style={compact ? { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : undefined}>
            {a.body}
          </div>
        )}
        <div className="gx-announce__foot">
          <span className={`gx-tag ${meta.tag}`}>{L(meta.label, meta.en)}</span>
          <span className="gx-muted" style={{ fontSize: 11.5 }}>{relativeTimeId(a.created_at, Date.now(), lang)}</span>
          {a.cta_url && (
            <a className="gx-btn gx-btn--xs" href={a.cta_url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 'auto' }}>
              {a.cta_label || L('Buka', 'Open')} <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>
      {onDismiss && (
        <button type="button" className="gx-iconbtn" style={{ width: 28, height: 28, border: 0, background: 'transparent' }} onClick={onDismiss} aria-label={L('Tutup pengumuman', 'Dismiss announcement')}>
          <X size={15} />
        </button>
      )}
    </article>
  );
};

export const AnnouncementDrawer: React.FC<{
  open: boolean;
  onClose: () => void;
  items: Announcement[];
  onEnableNotification: () => void;
  notificationState: NotificationPermission | 'unsupported';
}> = ({ open, onClose, items, onEnableNotification, notificationState }) => {
  const { L } = useLang();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="gx-overlay" onClick={onClose}>
      <aside className="gx-drawer" onClick={(e) => e.stopPropagation()} aria-label={L('Pengumuman', 'Announcements')}>
        <div className="gx-drawer__head">
          <Megaphone size={18} />
          <h3>{L('Pengumuman', 'Announcements')}</h3>
          <button type="button" className="gx-iconbtn" style={{ marginLeft: 'auto' }} onClick={onClose} aria-label={L('Tutup', 'Close')}>
            <X size={17} />
          </button>
        </div>
        <div className="gx-drawer__body">
          {notificationState !== 'granted' && notificationState !== 'unsupported' && (
            <div className="gx-note">
              <BellRing size={16} />
              <div style={{ flex: 1 }}>
                {L('Aktifkan notifikasi browser supaya dapat kabar saat sesi dimulai & checkout selesai.', 'Enable browser notifications to get alerts when sessions start & checkouts finish.')}
                <div style={{ marginTop: 8 }}>
                  <button type="button" className="gx-btn gx-btn--xs gx-btn--primary" onClick={onEnableNotification}>
                    {L('Aktifkan notifikasi', 'Enable notifications')}
                  </button>
                </div>
              </div>
            </div>
          )}
          {items.length === 0 ? (
            <div className="gx-empty">{L('Belum ada pengumuman dari admin.', 'No announcements from admin yet.')}</div>
          ) : (
            items.map((a) => <AnnouncementCard key={a.id} a={a} />)
          )}
        </div>
      </aside>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Toast                                                               */
/* ------------------------------------------------------------------ */

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const show = (m: string) => {
    setMsg(m);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 2600);
  };
  const node = msg ? (
    <div className="gx-toast" role="status">
      {msg}
    </div>
  ) : null;
  return { show, node };
}
