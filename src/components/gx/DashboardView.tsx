import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  CalendarClock,
  CalendarDays,
  Check,
  CircleAlert,
  Clock3,
  Copy,
  Link2,
  Crosshair,
  Eye,
  EyeOff,
  FolderCode,
  MapPin,
  Plus,
  Receipt,
  Server,
  ShieldCheck,
  ShoppingBag,
  Square,
  Timer,
  Trash2,
  UserRound,
  Wallet,
  Zap,
  X,
} from 'lucide-react';
import {
  Address,
  Announcement,
  AppTab,
  AseanCountryCode,
  BotLogItem,
  BotSettings,
  BotStats,
  EnginePhase,
  OrderHistoryItem,
  ShopeeAccount,
  ShopeePayment,
  TargetUrl,
  User,
} from '../../types/index.ts';
import { ASEAN_REGIONS, formatAseanCurrency, paymentFamily } from '../../constants/asean.ts';
import { ServerClock, useTicker } from '../../lib/useServerClock.ts';
import { getNextSession, getSessionSlots, pad, splitDuration, formatClock, tzParts, relativeTimeId } from '../../lib/time.ts';
import { AnnouncementCard, licenseInfo } from './Shell.tsx';
import { parseShopeeLink, isValidHttpUrl } from '../../lib/shopee.ts';
import { useLang } from '../../lib/i18n.tsx';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface LatencyState {
  history: number[];
  last: number | null;
  status: number | null;
  reachable: boolean | null;
  checkedAt: number | null;
}

export interface NormalizedOrder {
  id: string;
  sn: string;
  name: string;
  price: number;
  method: string;
  speed: number | null;
  time: string;
  region?: string;
  status?: string;
}

export function normalizeOrder(o: OrderHistoryItem & Record<string, any>): NormalizedOrder {
  return {
    id: o.id,
    sn: o.order_sn || '-',
    name: o.product_name || o.product_title || 'Produk',
    price: Number(o.price) || 0,
    method: String(o.payment_method || '-').toUpperCase(),
    speed: o.speed_ms ?? o.latency_ms ?? null,
    time: o.checkout_time || o.created_at || '',
    region: o.region,
    status: o.status,
  };
}

export interface ArmState {
  epoch: number;
  label: string;
}

export const ARM_LEAD_MS = 4500; // engine butuh ±4,5 dtk dari start ke trigger

interface DashboardViewProps {
  user: User;
  region: AseanCountryCode;
  clock: ServerClock;
  targets: TargetUrl[];
  selectedTarget: TargetUrl | null;
  selectedAccountId: string;
  selectedAddressId: string;
  onSelectTarget: (id: string) => void;
  accounts: ShopeeAccount[];
  addresses: Address[];
  paymentSettings: ShopeePayment | null;
  proxiesCount: number;
  orders: NormalizedOrder[];
  stats: BotStats;
  logs: BotLogItem[];
  onClearLogs: () => void;
  isBotRunning: boolean;
  phase: EnginePhase;
  latency: LatencyState;
  botSettings: BotSettings;
  openLeadMs: number;
  armed: ArmState | null;
  onArm: (a: ArmState) => void;
  onDisarm: () => void;
  onStart: () => void;
  onStop: () => void;
  announcements: Announcement[];
  onDismissAnnouncement: (id: string) => void;
  onOpenAnnouncements: () => void;
  runMode: 'open' | 'practice';
  onRunMode: (m: 'open' | 'practice') => void;
  onOpenTargetModal: (t?: TargetUrl) => void;
  onOpenAccountModal: () => void;
  onOpenAddressModal: () => void;
  onGoTab: (t: AppTab) => void;
  onOpenQris: () => void;
  onCopied: (msg: string) => void;
}

/* ------------------------------------------------------------------ */
/* Session card (kartu biru utama — countdown sesi flash sale)          */
/* ------------------------------------------------------------------ */

const WaveLine: React.FC<{ data: number[] }> = ({ data }) => {
  // Garis dekoratif: pakai data latensi kalau ada, kalau belum pakai gelombang halus
  const w = 220;
  const h = 70;
  const src = data.length >= 4 ? data.slice(-18) : [30, 34, 28, 40, 36, 46, 42, 54, 50, 62, 58, 70];
  const max = Math.max(...src);
  const min = Math.min(...src);
  const step = w / (src.length - 1);
  // dibalik: latensi turun = garis naik (lebih bagus)
  const y = (v: number) => (data.length >= 4 ? 8 + ((v - min) / (max - min || 1)) * (h - 16) : h - 8 - ((v - min) / (max - min || 1)) * (h - 16));
  const pts = src.map((v, i) => [i * step, y(v)] as const);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const cx = (x0 + x1) / 2;
    d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  return (
    <svg className="gx-session__wave" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="gxWaveFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${w},${h} L0,${h} Z`} fill="url(#gxWaveFill)" />
      <path d={d} fill="none" stroke="#fff" strokeOpacity="0.9" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
};

const SessionCard: React.FC<{
  region: AseanCountryCode;
  clock: ServerClock;
  armed: ArmState | null;
  onArm: (a: ArmState) => void;
  onDisarm: () => void;
  isBotRunning: boolean;
  phase: EnginePhase;
  latencyHistory: number[];
  blocked: string | null;
}> = ({ region, clock, armed, onArm, onDisarm, isBotRunning, phase, latencyHistory, blocked }) => {
  const { L, lang, locale } = useLang();
  useTicker(41);
  const reg = ASEAN_REGIONS[region] || ASEAN_REGIONS.ID;
  const [showMs, setShowMs] = useState(true);
  const [customOpen, setCustomOpen] = useState(false);
  const [customVal, setCustomVal] = useState('');
  const now = clock.now();
  const todaySlots = getSessionSlots(now, reg.flashSaleSchedule, reg.timezone);
  // Kalau semua sesi hari ini sudah lewat, tampilkan jadwal besok
  const isTomorrow = todaySlots.length > 0 && todaySlots.every((s) => s.status === 'past');
  const slots = isTomorrow ? getSessionSlots(now, reg.flashSaleSchedule, reg.timezone, now + 86_400_000) : todaySlots;
  const live = slots.find((s) => s.status === 'live');
  const next = getNextSession(now, reg.flashSaleSchedule, reg.timezone);
  const target = armed || next;
  const d = splitDuration(target ? target.epoch - now : 0);

  const dayLabel = (() => {
    if (!target) return '';
    const a = tzParts(target.epoch, reg.timezone);
    const b = tzParts(now, reg.timezone);
    if (a.y === b.y && a.m === b.m && a.d === b.d) return L('hari ini', 'today');
    return new Date(target.epoch).toLocaleDateString(locale, { weekday: 'long', timeZone: reg.timezone });
  })();

  const armCustom = () => {
    const epoch = new Date(customVal).getTime();
    if (!customVal || isNaN(epoch) || epoch <= now + 3000) return;
    onArm({ epoch, label: formatClock(epoch, reg.timezone).slice(0, 5) });
    setCustomOpen(false);
    setCustomVal('');
  };

  const status = isBotRunning
    ? { text: phase === 'fire' ? L('Membuka Shopee…', 'Opening Shopee…') : L('Engine berjalan', 'Engine running'), pulse: true }
    : armed
    ? { text: L(`Auto-start ${armed.label} aktif`, `Auto-start ${armed.label} on`), pulse: true }
    : live
    ? { text: L(`Sesi ${live.label} berlangsung`, `Session ${live.label} live`), pulse: true }
    : { text: 'Standby', pulse: false };

  return (
    <section className="gx-session" aria-label="Countdown sesi flash sale" style={{ order: 1 }}>
      <div className="gx-session__top">
        <span className="gx-session__label">{armed ? L('Auto-start dalam', 'Auto-start in') : L('Sesi berikutnya dalam', 'Next session in')}</span>
        <button type="button" className="gx-session__eye" onClick={() => setShowMs((v) => !v)} aria-label={showMs ? L('Sembunyikan milidetik', 'Hide milliseconds') : L('Tampilkan milidetik', 'Show milliseconds')}>
          {showMs ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>
      </div>

      <div className="gx-session__count" aria-live="off">
        {pad(d.h)}:{pad(d.m)}:{pad(d.s)}
        {showMs && <span>.{pad(d.ms, 3)}</span>}
      </div>

      <div className="gx-session__sub">
        <span className="gx-session__pill">
          <span className={`gx-led ${status.pulse ? 'gx-led--pulse' : ''}`} />
          {status.text}
        </span>
        <span>
          {L('Target', 'Target')} <b>{target?.label || '--:--'}</b> {reg.timezoneLabel.split(' ')[0]} · {dayLabel}
        </span>
      </div>

      <WaveLine data={latencyHistory} />

      <div className="gx-session__slots" role="list" aria-label={isTomorrow ? L('Jadwal sesi besok', "Tomorrow's sessions") : L('Jadwal sesi hari ini', "Today's sessions")}>
        {slots.map((s) => {
          const isArmed = !!armed && Math.abs(armed.epoch - s.epoch) < 1000;
          return (
            <button
              key={s.label}
              type="button"
              role="listitem"
              className={`gx-sslot gx-sslot--${s.status} ${isArmed ? 'gx-sslot--armed' : ''}`}
              disabled={s.status === 'past' || s.status === 'live' || isBotRunning}
              onClick={() => (isArmed ? onDisarm() : onArm({ epoch: s.epoch, label: s.label }))}
              title={s.status === 'past' ? L('Sesi sudah lewat', 'Session passed') : isArmed ? L('Klik untuk batalkan', 'Click to cancel') : L(`Jadwalkan auto-start ${s.label}`, `Schedule auto-start ${s.label}`)}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="gx-session__foot">
        <span className="gx-session__clock">
          <span className="gx-led" style={{ color: clock.synced ? '#7CF5B5' : '#FFD27A' }} />
          {L('Jam server', 'Server time')} <b>{formatClock(now, reg.timezone)}</b>
        </span>
        {customOpen ? (
          <span className="gx-session__custom">
            <input type="datetime-local" value={customVal} onChange={(e) => setCustomVal(e.target.value)} aria-label={L('Waktu custom', 'Custom time')} />
            <button type="button" onClick={armCustom} disabled={!customVal}>
              {L('Set', 'Set')}
            </button>
            <button type="button" onClick={() => setCustomOpen(false)} aria-label={L('Batal', 'Cancel')}>
              <X size={14} />
            </button>
          </span>
        ) : (
          <button type="button" className="gx-session__link" onClick={() => setCustomOpen(true)} disabled={!!blocked}>
            {L('Jam custom', 'Custom time')}
          </button>
        )}
      </div>
    </section>
  );
};


/* ------------------------------------------------------------------ */
/* Engine monitor                                                      */
/* ------------------------------------------------------------------ */

const PHASES: { id: EnginePhase; label: string; en: string }[] = [
  { id: 'sync', label: 'Sinkron', en: 'Sync' },
  { id: 'warm', label: 'Cek produk', en: 'Check' },
  { id: 'armed', label: 'Standby', en: 'Standby' },
  { id: 'fire', label: 'Buka Shopee', en: 'Open Shopee' },
  { id: 'done', label: 'Konfirmasi', en: 'Confirm' },
];

const Sparkline: React.FC<{ data: number[] }> = ({ data }) => {
  const { L, lang, locale } = useLang();
  if (data.length < 2) {
    return <div className="gx-empty" style={{ padding: 14 }}>{L('Mengumpulkan data latensi…', 'Collecting latency data…')}</div>;
  }
  const w = 300;
  const h = 56;
  const max = Math.max(...data) * 1.15 || 1;
  const min = Math.min(...data) * 0.85;
  const step = w / (data.length - 1);
  const y = (v: number) => h - ((v - min) / (max - min || 1)) * (h - 6) - 3;
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${y(v).toFixed(1)}`);
  return (
    <svg className="gx-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={L('Grafik latensi gateway', 'Gateway latency chart')}>
      <path className="gx-spark__area" d={`M0,${h} L${pts.join(' L')} L${w},${h} Z`} />
      <path className="gx-spark__line" d={`M${pts.join(' L')}`} />
    </svg>
  );
};

const EngineMonitor: React.FC<{
  phase: EnginePhase;
  isBotRunning: boolean;
  latency: LatencyState;
  clock: ServerClock;
  leadMs: number;
  mode: string;
  region: AseanCountryCode;
}> = ({ phase, isBotRunning, latency, clock, leadMs, mode, region }) => {
  const { L, lang, locale } = useLang();
  const reg = ASEAN_REGIONS[region] || ASEAN_REGIONS.ID;
  const idx = PHASES.findIndex((p) => p.id === phase);
  const tone = (v: number | null, good: number, ok: number) =>
    v == null ? '' : v <= good ? 'gx-metric__v--ok' : v <= ok ? 'gx-metric__v--warn' : 'gx-metric__v--bad';
  const avg = latency.history.length ? Math.round(latency.history.reduce((a, b) => a + b, 0) / latency.history.length) : null;

  return (
    <section className="gx-card" style={{ order: 6 }}>
      <div className="gx-card__head">
        <h2 className="gx-card__title">
          <Activity size={16} /> {L('Monitor engine', 'Engine monitor')}
        </h2>
        <div className="gx-card__aside">
          {phase === 'error' ? (
            <span className="gx-tag gx-tag--bad">Error</span>
          ) : isBotRunning ? (
            <span className="gx-tag gx-tag--flash">
              <span className="gx-led gx-led--pulse" /> {L('Aktif', 'Active')}
            </span>
          ) : phase === 'done' ? (
            <span className="gx-tag gx-tag--ok">{L('Selesai', 'Done')}</span>
          ) : (
            <span className="gx-tag">Idle</span>
          )}
        </div>
      </div>
      <div className="gx-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="gx-phases" aria-label={L('Tahap eksekusi', 'Execution stages')}>
          {PHASES.map((p, i) => {
            let cls = 'gx-phase';
            if (phase === 'error' && i === Math.max(idx, 0)) cls += ' gx-phase--error';
            else if (phase === 'done' || (idx > -1 && i < idx)) cls += ' gx-phase--done';
            else if (i === idx && p.id === 'fire') cls += ' gx-phase--fire';
            else if (i === idx) cls += ' gx-phase--active';
            return (
              <div key={p.id} className={cls}>
                <div className="gx-phase__bar" />
                <div className="gx-phase__label">{L(p.label, p.en)}</div>
              </div>
            );
          })}
        </div>

        <div className="gx-metrics">
          <div className="gx-metric">
            <div className="gx-metric__k">Gateway {reg.code}</div>
            <div className={`gx-metric__v ${latency.reachable === false ? 'gx-metric__v--bad' : tone(latency.last, 150, 400)}`}>
              {latency.reachable === false ? 'Down' : latency.last ?? '—'}
              {latency.reachable !== false && latency.last != null && <small>ms</small>}
            </div>
          </div>
          <div className="gx-metric">
            <div className="gx-metric__k">{L('Rata-rata', 'Average')}</div>
            <div className={`gx-metric__v ${tone(avg, 150, 400)}`}>
              {avg ?? '—'}
              {avg != null && <small>ms</small>}
            </div>
          </div>
          <div className="gx-metric">
            <div className="gx-metric__k">{L('Ping server bot', 'Bot server ping')}</div>
            <div className={`gx-metric__v ${tone(clock.rttMs, 120, 300)}`}>
              {clock.rttMs ?? '—'}
              {clock.rttMs != null && <small>ms</small>}
            </div>
          </div>
          <div className="gx-metric">
            <div className="gx-metric__k">{L('Selisih jam HP', 'Device clock offset')}</div>
            <div className={`gx-metric__v ${Math.abs(clock.offsetMs) > 1000 ? 'gx-metric__v--warn' : ''}`}>
              {clock.synced ? (clock.offsetMs > 0 ? '+' : '') + clock.offsetMs : '—'}
              {clock.synced && <small>ms</small>}
            </div>
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <span className="gx-eyebrow">{L('Latensi gateway (live)', 'Gateway latency (live)')}</span>
            <span className="gx-muted" style={{ fontSize: 11 }}>
              {latency.checkedAt ? `${L('cek', 'checked')} ${relativeTimeId(new Date(latency.checkedAt).toISOString(), Date.now(), lang)}` : ''}
            </span>
          </div>
          <Sparkline data={latency.history} />
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span className="gx-tag">
            <Server size={12} /> {L('Buka', 'Open')} −{leadMs} ms
          </span>
          <span className="gx-tag">{mode === 'browser' ? L('Buka di browser', 'Open in browser') : L('Buka app Shopee', 'Open Shopee app')}</span>
          <span className="gx-tag">{L('Jam: server bot', 'Clock: bot server')}</span>
        </div>
        {Math.abs(clock.offsetMs) > 1000 && (
          <div className="gx-note gx-note--warn">
            <CircleAlert size={15} />
            <span>
              {L(
                `Jam HP kamu selisih ${(clock.offsetMs / 1000).toFixed(1)} dtk dari server. Countdown sudah otomatis dikoreksi, tapi sebaiknya aktifkan "waktu otomatis" di pengaturan HP.`,
                `Your device clock is ${(clock.offsetMs / 1000).toFixed(1)} s off from the server. The countdown is corrected automatically, but turn on "automatic time" in your phone settings.`
              )}
            </span>
          </div>
        )}
      </div>
    </section>
  );
};

/* ------------------------------------------------------------------ */
/* Setup list, quick actions, readiness donut                          */
/* ------------------------------------------------------------------ */

const PAYMENT_LABEL: Record<string, string> = {
  shopeepay: 'ShopeePay',
  spaylater: 'SPayLater',
  spinjam: 'SPinjam',
};

const SectionHead: React.FC<{ title: string; action?: React.ReactNode }> = ({ title, action }) => (
  <div className="gx-sechead">
    <h2>{title}</h2>
    {action}
  </div>
);

interface CheckItem {
  key: string;
  label: string;
  value: string;
  ok: boolean;
  icon: React.ComponentType<any>;
  color: string;
  action?: () => void;
}

const SetupList: React.FC<{
  items: CheckItem[];
  targets: TargetUrl[];
  selected: TargetUrl | null;
  onSelect: (id: string) => void;
  region: AseanCountryCode;
  onSeeAll: () => void;
}> = ({ items, targets, selected, onSelect, region, onSeeAll }) => {
  const { L, lang, locale } = useLang();
  const priceRegion = ((selected?.region as AseanCountryCode) || region) as AseanCountryCode;
  return (
    <section style={{ order: 3 }}>
      <SectionHead
        title={L('Setup war', 'War setup')}
        action={
          <button type="button" className="gx-link" onClick={onSeeAll}>
            {L('Lihat semua', 'See all')}
          </button>
        }
      />
      <div className="gx-card gx-acclist">
        {items
          .filter((i) => i.key !== 'license' && i.key !== 'clock' && i.key !== 'link')
          .map((it) => {
            const Icon = it.icon;
            const right =
              it.key === 'target' && selected
                ? formatAseanCurrency(Number(selected.target_price) || 0, priceRegion)
                : it.ok
                ? L('Siap', 'Ready')
                : L('Atur', 'Set up');
            return (
              <button key={it.key} type="button" className="gx-acc" onClick={it.action}>
                <span className="gx-acc__icon" style={{ background: `${it.color}1A`, color: it.color }}>
                  <Icon size={18} />
                </span>
                <span className="gx-acc__main">
                  <span className="gx-acc__t">{it.label}</span>
                  <span className="gx-acc__s">{it.value}</span>
                </span>
                <span className={`gx-acc__v ${it.ok ? '' : 'gx-acc__v--todo'}`}>{right}</span>
              </button>
            );
          })}
        {targets.length > 1 && (
          <div style={{ padding: '4px 16px 14px' }}>
            <select className="gx-select" value={selected?.id || ''} onChange={(e) => onSelect(e.target.value)} aria-label={L('Ganti target aktif', 'Change active target')}>
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </section>
  );
};

const QuickActions: React.FC<{
  isBotRunning: boolean;
  armed: ArmState | null;
  next: { label: string; epoch: number } | null;
  blocked: string | null;
  onStart: () => void;
  onStop: () => void;
  onArm: (a: ArmState) => void;
  onDisarm: () => void;
  onTarget: () => void;
  onHistory: () => void;
  runMode: 'open' | 'practice';
  onRunMode: (m: 'open' | 'practice') => void;
}> = ({ isBotRunning, armed, next, blocked, onStart, onStop, onArm, onDisarm, onTarget, onHistory, runMode, onRunMode }) => {
  const { L, lang, locale } = useLang();
  return (
  <section style={{ order: 2 }}>
    <SectionHead
      title={L('Aksi cepat', 'Quick actions')}
      action={
        <div className="gx-seg gx-seg--sm" role="radiogroup" aria-label={L('Mode jalan', 'Run mode')}>
          <button type="button" role="radio" aria-checked={runMode === 'open'} aria-pressed={runMode === 'open'} disabled={isBotRunning} onClick={() => onRunMode('open')}>
            {L('Buka Shopee', 'Open Shopee')}
          </button>
          <button type="button" role="radio" aria-checked={runMode === 'practice'} aria-pressed={runMode === 'practice'} disabled={isBotRunning} onClick={() => onRunMode('practice')}>
            {L('Latihan', 'Practice')}
          </button>
        </div>
      }
    />
    <div className="gx-qa">
      <button
        type="button"
        className={`gx-qa__btn ${isBotRunning ? 'gx-qa__btn--stop' : 'gx-qa__btn--go'}`}
        onClick={isBotRunning ? onStop : onStart}
        disabled={!isBotRunning && !!blocked}
      >
        <span className="gx-qa__icon">{isBotRunning ? <Square size={18} fill="currentColor" /> : <Zap size={19} fill="currentColor" />}</span>
        <span>{isBotRunning ? 'Stop' : L('Jalankan', 'Run')}</span>
      </button>
      <button
        type="button"
        className={`gx-qa__btn ${armed ? 'gx-qa__btn--on' : ''}`}
        onClick={() => (armed ? onDisarm() : next && onArm(next))}
        disabled={!armed && (!next || !!blocked || isBotRunning)}
      >
        <span className="gx-qa__icon">{armed ? <X size={18} /> : <CalendarClock size={18} />}</span>
        <span>{armed ? `${L('Batal', 'Cancel')} ${armed.label}` : `Auto ${next?.label || ''}`}</span>
      </button>
      <button type="button" className="gx-qa__btn" onClick={onTarget}>
        <span className="gx-qa__icon">
          <Crosshair size={18} />
        </span>
        <span>{L('Target', 'Target')}</span>
      </button>
      <button type="button" className="gx-qa__btn" onClick={onHistory}>
        <span className="gx-qa__icon">
          <Receipt size={18} />
        </span>
        <span>{L('Riwayat', 'History')}</span>
      </button>
    </div>
    {blocked && !isBotRunning && (
      <div className="gx-note gx-note--warn" style={{ marginTop: 10 }}>
        <CircleAlert size={15} />
        <span>{blocked}</span>
      </div>
    )}
  </section>
  );
};

const Donut: React.FC<{ items: CheckItem[] }> = ({ items }) => {
  const { L, lang, locale } = useLang();
  const r = 42;
  const c = 2 * Math.PI * r;
  const gap = 5;
  const seg = c / items.length;
  return (
    <svg viewBox="0 0 110 110" className="gx-donut" role="img" aria-label={L('Diagram kesiapan', 'Readiness chart')}>
      <circle cx="55" cy="55" r={r} fill="none" stroke="var(--gx-surface-3)" strokeWidth="14" />
      {items.map((it, i) => (
        <circle
          key={it.key}
          cx="55"
          cy="55"
          r={r}
          fill="none"
          stroke={it.ok ? it.color : 'var(--gx-line-strong)'}
          strokeWidth="14"
          strokeDasharray={`${seg - gap} ${c - seg + gap}`}
          strokeDashoffset={-i * seg}
          transform="rotate(-90 55 55)"
          style={{ transition: 'stroke .3s' }}
        />
      ))}
    </svg>
  );
};

const ReadinessCard: React.FC<{ items: CheckItem[] }> = ({ items }) => {
  const { L, lang, locale } = useLang();
  const done = items.filter((i) => i.ok).length;
  const pct = Math.round((done / items.length) * 100);
  return (
    <section className="gx-card gx-ready" style={{ order: 4 }}>
      <div className="gx-ready__top">
        <div>
          <div className="gx-ready__k">{L('Kesiapan war', 'War readiness')}</div>
          <div className="gx-ready__v">{pct}%</div>
          <div className={`gx-ready__d ${pct === 100 ? 'is-ok' : ''}`}>
            {pct === 100 ? <Check size={13} strokeWidth={3} /> : <CircleAlert size={13} />}
            {L(`${done} dari ${items.length} siap`, `${done} of ${items.length} ready`)}
          </div>
        </div>
        <div className="gx-ready__chart">
          <Donut items={items} />
          <span className="gx-ready__center">
            <ShieldCheck size={20} />
          </span>
        </div>
      </div>
      {items.every((it) => it.ok) ? (
        <div className="gx-ready__allok">
          <Check size={15} strokeWidth={3} /> {L('Semua siap. Tinggal pilih sesi & tekan Auto.', 'All set. Just pick a session & press Auto.')}
        </div>
      ) : (
        <ul className="gx-legend">
          {items
            .filter((it) => !it.ok)
            .map((it) => (
              <li key={it.key}>
                <span className="gx-legend__dot" style={{ background: it.color }} />
                <span className="gx-legend__k">{it.label}</span>
                <span className="gx-legend__v">{it.value}</span>
                {it.action ? (
                  <button type="button" className="gx-link" onClick={it.action}>
                    {L('Atur', 'Fix')}
                  </button>
                ) : (
                  <span className="gx-legend__s">{L('Belum', 'Not yet')}</span>
                )}
              </li>
            ))}
        </ul>
      )}
    </section>
  );
};


/* ------------------------------------------------------------------ */
/* Live console                                                        */
/* ------------------------------------------------------------------ */

const TAG_RE = /^\s*(?:[^\[\w]{0,3}\s*)?\[([A-Z0-9][A-Z0-9 _\-]{1,18})\]\s*/;

export const LiveConsole: React.FC<{
  logs: BotLogItem[];
  onClear: () => void;
  onOpenScript?: () => void;
  onCopied: (m: string) => void;
  style?: React.CSSProperties;
}> = ({ logs, onClear, onOpenScript, onCopied, style }) => {
  const { L, lang, locale } = useLang();
  const [filter, setFilter] = useState<'all' | 'success' | 'error'>('all');
  const bodyRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const filtered = useMemo(
    () => logs.filter((l) => (filter === 'all' ? true : filter === 'success' ? l.type === 'success' : l.type === 'error' || l.type === 'warning')),
    [logs, filter]
  );

  useEffect(() => {
    const el = bodyRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [filtered]);

  const copy = async () => {
    const text = filtered.map((l) => `[${l.time}] ${l.text}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      onCopied(L('Log disalin', 'Log copied'));
    } catch {
      onCopied(L('Gagal menyalin log', 'Failed to copy log'));
    }
  };

  return (
    <section className="gx-console" style={style} aria-label={L('Konsol live', 'Live console')}>
      <div className="gx-console__bar">
        <span className="gx-console__title">
          <span className="gx-led" style={{ color: '#3ddc84' }} /> live-console
        </span>
        <div className="gx-console__tabs" role="group" aria-label={L('Filter log', 'Log filter')}>
          {(['all', 'success', 'error'] as const).map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === 'all' ? L('semua', 'all') : f === 'success' ? L('sukses', 'success') : 'error'}
            </button>
          ))}
        </div>
        {onOpenScript && (
          <button type="button" className="gx-console__tool" onClick={onOpenScript} title="Folder script engine">
            <FolderCode size={13} />
          </button>
        )}
        <button type="button" className="gx-console__tool" onClick={copy} title={L('Salin log', 'Copy log')}>
          <Copy size={13} />
        </button>
        <button type="button" className="gx-console__tool" onClick={onClear} title={L('Bersihkan', 'Clear')}>
          <Trash2 size={13} />
        </button>
      </div>
      <div
        className="gx-console__body"
        ref={bodyRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
      >
        {filtered.length === 0 && <div style={{ color: '#50546b' }}>{L('// belum ada log. jalankan bot atau jadwalkan auto-start.', '// no logs yet. run the bot or schedule auto-start.')}</div>}
        {filtered.slice(-200).map((l) => {
          const m = l.text.match(TAG_RE);
          const tag = m ? m[1] : l.type === 'success' ? 'OK' : l.type === 'error' ? 'ERR' : l.type === 'warning' ? 'WARN' : 'INFO';
          const msg = m ? l.text.slice(m[0].length) : l.text;
          return (
            <div key={l.id} className={`gx-logline gx-logline--${l.type}`}>
              <time>{l.time}</time>
              <span className="gx-logline__tag">{tag}</span>
              <span className="gx-logline__msg">{msg}</span>
            </div>
          );
        })}
        <div className="gx-console__prompt">
          ganemax@engine:~$<span className="gx-caret" />
        </div>
      </div>
    </section>
  );
};

/* ------------------------------------------------------------------ */
/* Orders (gaya "recent transactions")                                 */
/* ------------------------------------------------------------------ */

export const OrdersList: React.FC<{ orders: NormalizedOrder[]; limit?: number; region: AseanCountryCode }> = ({ orders, limit, region }) => {
  const { L, lang, locale } = useLang();
  const list = limit ? orders.slice(0, limit) : orders;
  if (!list.length) return <div className="gx-empty">{L('Belum ada checkout tercatat.', 'No checkouts recorded yet.')}</div>;
  return (
    <ul className="gx-list gx-tx">
      {list.map((o) => (
        <li key={o.id} className="gx-row">
          <span className="gx-tx__icon">
            <ShoppingBag size={17} />
          </span>
          <div className="gx-row__main">
            <div className="gx-row__t">{o.name}</div>
            <div className="gx-row__s">
              {o.time ? new Date(o.time).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : '-'} · {o.method} · <span className="gx-mono">{o.sn}</span>
            </div>
          </div>
          <div className="gx-row__end">
            <b className="gx-tx__amt">{formatAseanCurrency(o.price, ((o.region as AseanCountryCode) || region) as AseanCountryCode)}</b>
            {o.speed != null && (
              <span className="gx-muted gx-mono" style={{ fontSize: 11 }}>
                {o.speed} ms
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
};


/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export const DashboardView: React.FC<DashboardViewProps> = (p) => {
  const { L, lang, locale } = useLang();
  const reg = ASEAN_REGIONS[p.region] || ASEAN_REGIONS.ID;
  const lic = licenseInfo(p.user, Date.now(), lang);
  const blocked =
    p.user.role !== 'admin' && lic.tone === 'bad'
      ? L('Masa aktif lisensi habis. Perpanjang via QRIS untuk menjalankan bot.', 'Your license has expired. Renew via QRIS to run the bot.')
      : !p.selectedTarget
      ? L('Belum ada target produk. Tambahkan dulu link produk yang mau di-war.', 'No target product yet. Add the product link you want to grab.')
      : !isValidHttpUrl(p.selectedTarget.url)
      ? L('Link target belum valid. Edit target dan tempel link produk Shopee.', 'Target link is invalid. Edit the target and paste a Shopee product link.')
      : null;

  const ids = parseShopeeLink(p.selectedTarget?.url);
  const linkOk = isValidHttpUrl(p.selectedTarget?.url);

  const pay = p.paymentSettings;
  const payFam = paymentFamily(pay?.payment_method);
  const payOk = !!pay?.payment_method && (payFam !== 'shopeepay' || !!pay?.shopeepay_pin);
  const acc = p.accounts.find((a) => a.id === p.selectedAccountId) || p.accounts[0];
  const addr = p.addresses.find((a) => a.id === p.selectedAddressId) || p.addresses.find((a) => a.is_default) || p.addresses[0];

  const checklist: CheckItem[] = [
    {
      key: 'target',
      label: L('Target produk', 'Target product'),
      value: p.selectedTarget ? p.selectedTarget.title : L('Belum dipilih', 'Not selected'),
      ok: !!p.selectedTarget,
      icon: Crosshair,
      color: '#2F6BFF',
      action: () => p.onOpenTargetModal(p.selectedTarget || undefined),
    },
    {
      key: 'link',
      label: L('Link produk', 'Product link'),
      value: !p.selectedTarget ? '—' : ids ? `ID ${ids.shopId}.${ids.itemId}` : linkOk ? L('Link pendek (dibuka apa adanya)', 'Short link (opened as is)') : L('Link tidak valid', 'Invalid link'),
      ok: linkOk,
      icon: Link2,
      color: '#7B61FF',
      action: () => p.onOpenTargetModal(p.selectedTarget || undefined),
    },
    {
      key: 'account',
      label: L('Akun Shopee', 'Shopee account'),
      value: acc ? `${acc.nickname || acc.username}${acc.cookies ? ' · cookies ✓' : ''}` : L('Belum ada akun', 'No account yet'),
      ok: !!acc,
      icon: UserRound,
      color: '#E2557B',
      action: acc ? () => p.onGoTab('targets') : p.onOpenAccountModal,
    },
    {
      key: 'address',
      label: L('Alamat', 'Address'),
      value: addr ? `${addr.label} · ${addr.recipient_name}` : L('Belum ada alamat', 'No address yet'),
      ok: !!addr,
      icon: MapPin,
      color: '#19B6E6',
      action: addr ? () => p.onGoTab('targets') : p.onOpenAddressModal,
    },
    {
      key: 'payment',
      label: L('Pembayaran', 'Payment'),
      value: pay?.payment_method
        ? `${payFam.toUpperCase()}${payFam === 'shopeepay' ? (pay.shopeepay_pin ? L(' · PIN tersimpan', ' · PIN saved') : L(' · PIN belum diisi', ' · PIN missing')) : ''}`
        : L('Belum diatur', 'Not set'),
      ok: payOk,
      icon: Wallet,
      color: '#F59E0B',
      action: () => p.onGoTab('targets'),
    },
    {
      key: 'clock',
      label: L('Jam server', 'Server clock'),
      value: p.clock.synced ? `${L('Sinkron', 'Synced')} · ${p.clock.offsetMs > 0 ? '+' : ''}${p.clock.offsetMs} ms` : L('Menyinkronkan…', 'Syncing…'),
      ok: p.clock.synced,
      icon: Clock3,
      color: '#14B8A6',
      action: () => p.clock.resync(),
    },
    {
      key: 'license',
      label: L('Lisensi', 'License'),
      value: lic.label,
      ok: lic.tone !== 'bad',
      icon: Timer,
      color: '#16B07A',
      action: p.user.role !== 'admin' ? p.onOpenQris : undefined,
    },
  ];

  const nowEpoch = p.clock.now();
  const next = getNextSession(nowEpoch, reg.flashSaleSchedule, reg.timezone);
  const todayLabel = new Date(nowEpoch).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: reg.timezone });

  return (
    <>
      <div className="gx-overview">
        <div>
          <h1>{L('Ringkasan', 'Overview')}</h1>
          <p>{L('Pantau sesi flash sale & engine kamu di sini', 'Track your flash sale sessions & engine here')}</p>
        </div>
        <div className="gx-overview__row">
          <span className="gx-datepill">
            <CalendarDays size={15} /> {todayLabel}
          </span>
          <button type="button" className="gx-btn gx-btn--primary gx-btn--pill" onClick={() => p.onOpenTargetModal()}>
            <Plus size={16} /> {L('Target', 'Target')}
          </button>
        </div>
      </div>

      {p.announcements.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <AnnouncementCard a={p.announcements[0]} compact onDismiss={p.announcements[0].pinned ? undefined : () => p.onDismissAnnouncement(p.announcements[0].id)} />
          {p.announcements.length > 1 && (
            <button type="button" className="gx-link" style={{ alignSelf: 'flex-start', marginLeft: 4 }} onClick={p.onOpenAnnouncements}>
              {L(`+${p.announcements.length - 1} pengumuman lain`, `+${p.announcements.length - 1} more announcements`)}
            </button>
          )}
        </div>
      )}

      <div className="gx-dash">
        <div className="gx-col">
          <SessionCard
            region={p.region}
            clock={p.clock}
            armed={p.armed}
            onArm={p.onArm}
            onDisarm={p.onDisarm}
            isBotRunning={p.isBotRunning}
            phase={p.phase}
            latencyHistory={p.latency.history}
            blocked={blocked}
          />
          <QuickActions
            isBotRunning={p.isBotRunning}
            armed={p.armed}
            next={next}
            blocked={blocked}
            onStart={p.onStart}
            onStop={p.onStop}
            onArm={p.onArm}
            onDisarm={p.onDisarm}
            onTarget={() => p.onGoTab('targets')}
            onHistory={() => p.onGoTab('analytics')}
            runMode={p.runMode}
            onRunMode={p.onRunMode}
          />
          <EngineMonitor
            phase={p.phase}
            isBotRunning={p.isBotRunning}
            latency={p.latency}
            clock={p.clock}
            leadMs={p.openLeadMs}
            mode={p.botSettings.openMode || 'app'}
            region={p.region}
          />
          <LiveConsole logs={p.logs} onClear={p.onClearLogs} onCopied={p.onCopied} style={{ order: 7 }} />
        </div>

        <div className="gx-col">
          <SetupList
            items={checklist}
            targets={p.targets}
            selected={p.selectedTarget}
            onSelect={p.onSelectTarget}
            region={p.region}
            onSeeAll={() => p.onGoTab('targets')}
          />
          <ReadinessCard items={checklist} />
          <section style={{ order: 5 }}>
            <SectionHead
              title={L('Checkout terakhir', 'Recent checkouts')}
              action={
                <button type="button" className="gx-link" onClick={() => p.onGoTab('analytics')}>
                  {L('Lihat semua', 'See all')}
                </button>
              }
            />
            <div className="gx-card" style={{ padding: '4px 16px' }}>
              <OrdersList orders={p.orders} limit={4} region={p.region} />
            </div>
          </section>
        </div>
      </div>
    </>
  );
};
