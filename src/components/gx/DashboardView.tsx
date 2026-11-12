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
import { ASEAN_REGIONS, formatAseanCurrency } from '../../constants/asean.ts';
import { ServerClock, useTicker } from '../../lib/useServerClock.ts';
import { getNextSession, getSessionSlots, pad, splitDuration, formatClock, tzParts, relativeTimeId } from '../../lib/time.ts';
import { AnnouncementCard, licenseInfo } from './Shell.tsx';
import { parseShopeeLink, isValidHttpUrl } from '../../lib/shopee.ts';

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
    if (a.y === b.y && a.m === b.m && a.d === b.d) return 'hari ini';
    return new Date(target.epoch).toLocaleDateString('id-ID', { weekday: 'long', timeZone: reg.timezone });
  })();

  const armCustom = () => {
    const epoch = new Date(customVal).getTime();
    if (!customVal || isNaN(epoch) || epoch <= now + 3000) return;
    onArm({ epoch, label: formatClock(epoch, reg.timezone).slice(0, 5) });
    setCustomOpen(false);
    setCustomVal('');
  };

  const status = isBotRunning
    ? { text: phase === 'fire' ? 'Mengeksekusi…' : 'Engine berjalan', pulse: true }
    : armed
    ? { text: `Auto-start ${armed.label} aktif`, pulse: true }
    : live
    ? { text: `Sesi ${live.label} berlangsung`, pulse: true }
    : { text: 'Standby', pulse: false };

  return (
    <section className="gx-session" aria-label="Countdown sesi flash sale" style={{ order: 1 }}>
      <div className="gx-session__top">
        <span className="gx-session__label">{armed ? 'Auto-start dalam' : 'Sesi berikutnya dalam'}</span>
        <button type="button" className="gx-session__eye" onClick={() => setShowMs((v) => !v)} aria-label={showMs ? 'Sembunyikan milidetik' : 'Tampilkan milidetik'}>
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
          Target <b>{target?.label || '--:--'}</b> {reg.timezoneLabel.split(' ')[0]} · {dayLabel}
        </span>
      </div>

      <WaveLine data={latencyHistory} />

      <div className="gx-session__slots" role="list" aria-label={isTomorrow ? "Jadwal sesi besok" : "Jadwal sesi hari ini"}>
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
              title={s.status === 'past' ? 'Sesi sudah lewat' : isArmed ? 'Klik untuk batalkan' : `Jadwalkan auto-start ${s.label}`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="gx-session__foot">
        <span className="gx-session__clock">
          <span className="gx-led" style={{ color: clock.synced ? '#7CF5B5' : '#FFD27A' }} />
          Jam server <b>{formatClock(now, reg.timezone)}</b>
        </span>
        {customOpen ? (
          <span className="gx-session__custom">
            <input type="datetime-local" value={customVal} onChange={(e) => setCustomVal(e.target.value)} aria-label="Waktu custom" />
            <button type="button" onClick={armCustom} disabled={!customVal}>
              Set
            </button>
            <button type="button" onClick={() => setCustomOpen(false)} aria-label="Batal">
              <X size={14} />
            </button>
          </span>
        ) : (
          <button type="button" className="gx-session__link" onClick={() => setCustomOpen(true)} disabled={!!blocked}>
            Jam custom
          </button>
        )}
      </div>
    </section>
  );
};


/* ------------------------------------------------------------------ */
/* Engine monitor                                                      */
/* ------------------------------------------------------------------ */

const PHASES: { id: EnginePhase; label: string }[] = [
  { id: 'sync', label: 'Sinkron' },
  { id: 'warm', label: 'Cek produk' },
  { id: 'armed', label: 'Standby' },
  { id: 'fire', label: 'Buka Shopee' },
  { id: 'done', label: 'Konfirmasi' },
];

const Sparkline: React.FC<{ data: number[] }> = ({ data }) => {
  if (data.length < 2) {
    return <div className="gx-empty" style={{ padding: 14 }}>Mengumpulkan data latensi…</div>;
  }
  const w = 300;
  const h = 56;
  const max = Math.max(...data) * 1.15 || 1;
  const min = Math.min(...data) * 0.85;
  const step = w / (data.length - 1);
  const y = (v: number) => h - ((v - min) / (max - min || 1)) * (h - 6) - 3;
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${y(v).toFixed(1)}`);
  return (
    <svg className="gx-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="Grafik latensi gateway">
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
  const reg = ASEAN_REGIONS[region] || ASEAN_REGIONS.ID;
  const idx = PHASES.findIndex((p) => p.id === phase);
  const tone = (v: number | null, good: number, ok: number) =>
    v == null ? '' : v <= good ? 'gx-metric__v--ok' : v <= ok ? 'gx-metric__v--warn' : 'gx-metric__v--bad';
  const avg = latency.history.length ? Math.round(latency.history.reduce((a, b) => a + b, 0) / latency.history.length) : null;

  return (
    <section className="gx-card" style={{ order: 6 }}>
      <div className="gx-card__head">
        <h2 className="gx-card__title">
          <Activity size={16} /> Monitor engine
        </h2>
        <div className="gx-card__aside">
          {phase === 'error' ? (
            <span className="gx-tag gx-tag--bad">Error</span>
          ) : isBotRunning ? (
            <span className="gx-tag gx-tag--flash">
              <span className="gx-led gx-led--pulse" /> Aktif
            </span>
          ) : phase === 'done' ? (
            <span className="gx-tag gx-tag--ok">Selesai</span>
          ) : (
            <span className="gx-tag">Idle</span>
          )}
        </div>
      </div>
      <div className="gx-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="gx-phases" aria-label="Tahap eksekusi">
          {PHASES.map((p, i) => {
            let cls = 'gx-phase';
            if (phase === 'error' && i === Math.max(idx, 0)) cls += ' gx-phase--error';
            else if (phase === 'done' || (idx > -1 && i < idx)) cls += ' gx-phase--done';
            else if (i === idx && p.id === 'fire') cls += ' gx-phase--fire';
            else if (i === idx) cls += ' gx-phase--active';
            return (
              <div key={p.id} className={cls}>
                <div className="gx-phase__bar" />
                <div className="gx-phase__label">{p.label}</div>
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
            <div className="gx-metric__k">Rata-rata</div>
            <div className={`gx-metric__v ${tone(avg, 150, 400)}`}>
              {avg ?? '—'}
              {avg != null && <small>ms</small>}
            </div>
          </div>
          <div className="gx-metric">
            <div className="gx-metric__k">Ping server bot</div>
            <div className={`gx-metric__v ${tone(clock.rttMs, 120, 300)}`}>
              {clock.rttMs ?? '—'}
              {clock.rttMs != null && <small>ms</small>}
            </div>
          </div>
          <div className="gx-metric">
            <div className="gx-metric__k">Selisih jam HP</div>
            <div className={`gx-metric__v ${Math.abs(clock.offsetMs) > 1000 ? 'gx-metric__v--warn' : ''}`}>
              {clock.synced ? (clock.offsetMs > 0 ? '+' : '') + clock.offsetMs : '—'}
              {clock.synced && <small>ms</small>}
            </div>
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <span className="gx-eyebrow">Latensi gateway (live)</span>
            <span className="gx-muted" style={{ fontSize: 11 }}>
              {latency.checkedAt ? `cek ${relativeTimeId(new Date(latency.checkedAt).toISOString())}` : ''}
            </span>
          </div>
          <Sparkline data={latency.history} />
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span className="gx-tag">
            <Server size={12} /> Buka −{leadMs} ms
          </span>
          <span className="gx-tag">{mode === 'browser' ? 'Buka di browser' : 'Buka app Shopee'}</span>
          <span className="gx-tag">NTP {reg.ntpServer}</span>
        </div>
        {Math.abs(clock.offsetMs) > 1000 && (
          <div className="gx-note gx-note--warn">
            <CircleAlert size={15} />
            <span>
              Jam HP kamu selisih {(clock.offsetMs / 1000).toFixed(1)} dtk dari server. Countdown sudah otomatis dikoreksi, tapi sebaiknya aktifkan
              "waktu otomatis" di pengaturan HP.
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
  const priceRegion = ((selected?.region as AseanCountryCode) || region) as AseanCountryCode;
  return (
    <section style={{ order: 3 }}>
      <SectionHead
        title="Setup war"
        action={
          <button type="button" className="gx-link" onClick={onSeeAll}>
            Lihat semua
          </button>
        }
      />
      <div className="gx-card gx-acclist">
        {items
          .filter((i) => i.key !== 'license')
          .map((it) => {
            const Icon = it.icon;
            const right =
              it.key === 'target' && selected
                ? formatAseanCurrency(Number(selected.target_price) || 0, priceRegion)
                : it.ok
                ? 'Siap'
                : 'Atur';
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
            <select className="gx-select" value={selected?.id || ''} onChange={(e) => onSelect(e.target.value)} aria-label="Ganti target aktif">
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
}> = ({ isBotRunning, armed, next, blocked, onStart, onStop, onArm, onDisarm, onTarget, onHistory }) => (
  <section style={{ order: 2 }}>
    <SectionHead title="Aksi cepat" />
    <div className="gx-qa">
      <button
        type="button"
        className={`gx-qa__btn ${isBotRunning ? 'gx-qa__btn--stop' : 'gx-qa__btn--go'}`}
        onClick={isBotRunning ? onStop : onStart}
        disabled={!isBotRunning && !!blocked}
      >
        <span className="gx-qa__icon">{isBotRunning ? <Square size={18} fill="currentColor" /> : <Zap size={19} fill="currentColor" />}</span>
        <span>{isBotRunning ? 'Stop' : 'Jalankan'}</span>
      </button>
      <button
        type="button"
        className={`gx-qa__btn ${armed ? 'gx-qa__btn--on' : ''}`}
        onClick={() => (armed ? onDisarm() : next && onArm(next))}
        disabled={!armed && (!next || !!blocked || isBotRunning)}
      >
        <span className="gx-qa__icon">{armed ? <X size={18} /> : <CalendarClock size={18} />}</span>
        <span>{armed ? `Batal ${armed.label}` : `Auto ${next?.label || ''}`}</span>
      </button>
      <button type="button" className="gx-qa__btn" onClick={onTarget}>
        <span className="gx-qa__icon">
          <Crosshair size={18} />
        </span>
        <span>Target</span>
      </button>
      <button type="button" className="gx-qa__btn" onClick={onHistory}>
        <span className="gx-qa__icon">
          <Receipt size={18} />
        </span>
        <span>Riwayat</span>
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

const Donut: React.FC<{ items: CheckItem[] }> = ({ items }) => {
  const r = 42;
  const c = 2 * Math.PI * r;
  const gap = 5;
  const seg = c / items.length;
  return (
    <svg viewBox="0 0 110 110" className="gx-donut" role="img" aria-label="Diagram kesiapan">
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
  const done = items.filter((i) => i.ok).length;
  const pct = Math.round((done / items.length) * 100);
  return (
    <section className="gx-card gx-ready" style={{ order: 4 }}>
      <div className="gx-ready__top">
        <div>
          <div className="gx-ready__k">Kesiapan war</div>
          <div className="gx-ready__v">{pct}%</div>
          <div className={`gx-ready__d ${pct === 100 ? 'is-ok' : ''}`}>
            {pct === 100 ? <Check size={13} strokeWidth={3} /> : <CircleAlert size={13} />}
            {done} dari {items.length} siap
          </div>
        </div>
        <div className="gx-ready__chart">
          <Donut items={items} />
          <span className="gx-ready__center">
            <ShieldCheck size={20} />
          </span>
        </div>
      </div>
      <ul className="gx-legend">
        {items.map((it) => (
          <li key={it.key}>
            <span className="gx-legend__dot" style={{ background: it.ok ? it.color : 'var(--gx-line-strong)' }} />
            <span className="gx-legend__k">{it.label}</span>
            <span className="gx-legend__v">{it.value}</span>
            <span className={`gx-legend__s ${it.ok ? 'is-ok' : ''}`}>{it.ok ? 'OK' : 'Belum'}</span>
          </li>
        ))}
      </ul>
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
      onCopied('Log disalin');
    } catch {
      onCopied('Gagal menyalin log');
    }
  };

  return (
    <section className="gx-console" style={style} aria-label="Konsol live">
      <div className="gx-console__bar">
        <span className="gx-console__title">
          <span className="gx-led" style={{ color: '#3ddc84' }} /> live-console
        </span>
        <div className="gx-console__tabs" role="group" aria-label="Filter log">
          {(['all', 'success', 'error'] as const).map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === 'all' ? 'semua' : f === 'success' ? 'sukses' : 'error'}
            </button>
          ))}
        </div>
        {onOpenScript && (
          <button type="button" className="gx-console__tool" onClick={onOpenScript} title="Folder script engine">
            <FolderCode size={13} />
          </button>
        )}
        <button type="button" className="gx-console__tool" onClick={copy} title="Salin log">
          <Copy size={13} />
        </button>
        <button type="button" className="gx-console__tool" onClick={onClear} title="Bersihkan">
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
        {filtered.length === 0 && <div style={{ color: '#50546b' }}>// belum ada log. jalankan engine atau jadwalkan auto-start.</div>}
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
  const list = limit ? orders.slice(0, limit) : orders;
  if (!list.length) return <div className="gx-empty">Belum ada checkout tercatat.</div>;
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
              {o.time ? new Date(o.time).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'} · {o.method} · <span className="gx-mono">{o.sn}</span>
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
  const reg = ASEAN_REGIONS[p.region] || ASEAN_REGIONS.ID;
  const lic = licenseInfo(p.user);
  const blocked =
    p.user.role !== 'admin' && lic.tone === 'bad'
      ? 'Masa aktif lisensi habis. Perpanjang via QRIS untuk menjalankan engine.'
      : !p.selectedTarget
      ? 'Belum ada target produk. Tambahkan dulu link produk yang mau di-war.'
      : !isValidHttpUrl(p.selectedTarget.url)
      ? 'Link target belum valid. Edit target dan tempel link produk Shopee.'
      : null;

  const ids = parseShopeeLink(p.selectedTarget?.url);
  const linkOk = isValidHttpUrl(p.selectedTarget?.url);

  const checklist: CheckItem[] = [
    {
      key: 'target',
      label: 'Target produk',
      value: p.selectedTarget ? p.selectedTarget.title : 'Belum dipilih',
      ok: !!p.selectedTarget,
      icon: Crosshair,
      color: '#2F6BFF',
      action: () => p.onOpenTargetModal(p.selectedTarget || undefined),
    },
    {
      key: 'link',
      label: 'Link produk',
      value: !p.selectedTarget ? '—' : ids ? `ID ${ids.shopId}.${ids.itemId}` : linkOk ? 'Link pendek (dibuka apa adanya)' : 'Link tidak valid',
      ok: linkOk,
      icon: Link2,
      color: '#7B61FF',
      action: () => p.onOpenTargetModal(p.selectedTarget || undefined),
    },
    {
      key: 'clock',
      label: 'Jam server',
      value: p.clock.synced ? `Sinkron · selisih ${p.clock.offsetMs > 0 ? '+' : ''}${p.clock.offsetMs} ms` : 'Menyinkronkan…',
      ok: p.clock.synced,
      icon: Clock3,
      color: '#19B6E6',
      action: () => p.clock.resync(),
    },
    {
      key: 'license',
      label: 'Lisensi',
      value: lic.label,
      ok: lic.tone !== 'bad',
      icon: Timer,
      color: '#16B07A',
      action: p.user.role !== 'admin' ? p.onOpenQris : undefined,
    },
  ];

  const nowEpoch = p.clock.now();
  const next = getNextSession(nowEpoch, reg.flashSaleSchedule, reg.timezone);
  const todayLabel = new Date(nowEpoch).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: reg.timezone });

  return (
    <>
      <div className="gx-overview">
        <div>
          <h1>Ringkasan</h1>
          <p>Pantau sesi flash sale & engine kamu di sini</p>
        </div>
        <div className="gx-overview__row">
          <span className="gx-datepill">
            <CalendarDays size={15} /> {todayLabel}
          </span>
          <button type="button" className="gx-btn gx-btn--primary gx-btn--pill" onClick={() => p.onOpenTargetModal()}>
            <Plus size={16} /> Target
          </button>
        </div>
      </div>

      {p.announcements.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {p.announcements.slice(0, 3).map((a) => (
            <AnnouncementCard key={a.id} a={a} compact onDismiss={a.pinned ? undefined : () => p.onDismissAnnouncement(a.id)} />
          ))}
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
              title="Checkout terakhir"
              action={
                <button type="button" className="gx-link" onClick={() => p.onGoTab('analytics')}>
                  Lihat semua
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
