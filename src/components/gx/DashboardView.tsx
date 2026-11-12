import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  CalendarClock,
  Check,
  CircleAlert,
  Copy,
  Crosshair,
  FolderCode,
  MapPin,
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
  Clock3,
  ChevronRight,
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
  effectiveThreads: number;
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
  onOpenScript: () => void;
  onOpenQris: () => void;
  onCopied: (msg: string) => void;
}

/* ------------------------------------------------------------------ */
/* Session hero (countdown sesi flash sale real-time)                  */
/* ------------------------------------------------------------------ */

const SessionHero: React.FC<{
  region: AseanCountryCode;
  clock: ServerClock;
  armed: ArmState | null;
  onArm: (a: ArmState) => void;
  onDisarm: () => void;
  isBotRunning: boolean;
  phase: EnginePhase;
  onStart: () => void;
  onStop: () => void;
  blocked: string | null;
}> = ({ region, clock, armed, onArm, onDisarm, isBotRunning, phase, onStart, onStop, blocked }) => {
  useTicker(41);
  const reg = ASEAN_REGIONS[region] || ASEAN_REGIONS.ID;
  const now = clock.now();
  const slots = getSessionSlots(now, reg.flashSaleSchedule, reg.timezone);
  const live = slots.find((s) => s.status === 'live');
  const next = getNextSession(now, reg.flashSaleSchedule, reg.timezone);
  const target = armed || next;
  const remain = target ? target.epoch - now : 0;
  const d = splitDuration(remain);
  const [customOpen, setCustomOpen] = useState(false);
  const [customVal, setCustomVal] = useState('');

  const targetDayLabel = (() => {
    if (!target) return '';
    const a = tzParts(target.epoch, reg.timezone);
    const b = tzParts(now, reg.timezone);
    if (a.y === b.y && a.m === b.m && a.d === b.d) return 'hari ini';
    return new Date(target.epoch).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', timeZone: reg.timezone });
  })();

  const armCustom = () => {
    if (!customVal) return;
    const epoch = new Date(customVal).getTime();
    if (isNaN(epoch) || epoch <= now + 3000) return;
    onArm({ epoch, label: formatClock(epoch, reg.timezone).slice(0, 5) });
    setCustomOpen(false);
  };

  let statusTag: React.ReactNode;
  if (isBotRunning) {
    statusTag = (
      <span className="gx-tag gx-tag--flash">
        <span className="gx-led gx-led--pulse" /> {phase === 'fire' ? 'Mengeksekusi' : 'Engine berjalan'}
      </span>
    );
  } else if (armed) {
    statusTag = (
      <span className="gx-tag gx-tag--brand">
        <span className="gx-led gx-led--pulse" /> Auto-start terjadwal
      </span>
    );
  } else if (live) {
    statusTag = (
      <span className="gx-tag gx-tag--flash">
        <span className="gx-led gx-led--pulse" /> Sesi {live.label} berlangsung
      </span>
    );
  } else {
    statusTag = <span className="gx-tag">Standby</span>;
  }

  return (
    <section className="gx-hero" aria-label="Countdown sesi flash sale" style={{ order: 1 }}>
      <div className="gx-hero__top">
        <span className="gx-hero__label">{armed ? 'Auto-start dalam' : 'Sesi berikutnya dalam'}</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {statusTag}
          <span className="gx-tag" title={clock.synced ? `Jam tersinkron server, selisih ${clock.offsetMs} ms` : 'Belum tersinkron'}>
            <span className="gx-led" style={{ color: clock.synced ? '#4fe08f' : '#f0a92a' }} />
            {clock.synced ? 'Jam sinkron' : 'Sinkron…'}
          </span>
        </span>
      </div>

      <div className="gx-count" aria-live="off">
        <span>{pad(d.h)}</span>
        <span className="gx-count__sep">:</span>
        <span>{pad(d.m)}</span>
        <span className="gx-count__sep">:</span>
        <span>{pad(d.s)}</span>
        <span className="gx-count__ms">.{pad(d.ms, 3)}</span>
      </div>

      <div className="gx-hero__meta">
        <span>
          Target <b>{target?.label || '--:--'} {reg.timezoneLabel.split(' ')[0]}</b> {targetDayLabel}
        </span>
        <span>
          Jam server <b className="gx-mono">{formatClock(now, reg.timezone)}</b>
        </span>
        <span>
          Shopee <b>{reg.name}</b>
        </span>
      </div>

      <div className="gx-slots" role="list" aria-label="Jadwal sesi flash sale hari ini">
        {slots.map((s) => {
          const isArmed = armed && Math.abs(armed.epoch - s.epoch) < 1000;
          const cls = ['gx-slot', `gx-slot--${s.status}`, isArmed ? 'gx-slot--armed' : ''].join(' ');
          const sub = isArmed ? 'Terjadwal' : s.status === 'past' ? 'Selesai' : s.status === 'live' ? 'Live' : s.status === 'next' ? 'Berikutnya' : 'Nanti';
          return (
            <button
              key={s.label}
              type="button"
              role="listitem"
              className={cls}
              disabled={s.status === 'past' || s.status === 'live'}
              onClick={() => (isArmed ? onDisarm() : onArm({ epoch: s.epoch, label: s.label }))}
              title={s.status === 'past' ? 'Sesi sudah lewat' : isArmed ? 'Klik untuk batalkan' : `Jadwalkan auto-start sesi ${s.label}`}
            >
              {s.label}
              <small>{sub}</small>
            </button>
          );
        })}
      </div>

      {blocked && (
        <div className="gx-note gx-note--bad" style={{ marginTop: 12, background: 'rgba(229,56,59,.12)', color: '#ffd6d7' }}>
          <CircleAlert size={16} />
          <span>{blocked}</span>
        </div>
      )}

      <div className="gx-hero__actions">
        {isBotRunning ? (
          <button type="button" className="gx-btn gx-btn--lg gx-btn--danger" onClick={onStop}>
            <Square size={16} fill="currentColor" /> Hentikan engine
          </button>
        ) : (
          <button type="button" className="gx-btn gx-btn--lg gx-btn--flash" onClick={onStart} disabled={!!blocked}>
            <Zap size={18} fill="currentColor" /> Jalankan sekarang
          </button>
        )}
        {armed ? (
          <button type="button" className="gx-btn gx-btn--lg gx-btn--armed" onClick={onDisarm}>
            <X size={16} /> Batalkan jadwal {armed.label}
          </button>
        ) : (
          <button
            type="button"
            className="gx-btn gx-btn--lg"
            disabled={!next || !!blocked || isBotRunning}
            onClick={() => next && onArm(next)}
            title="Bot otomatis mulai beberapa detik sebelum sesi agar trigger tepat di detik 0"
          >
            <CalendarClock size={17} /> Auto-start sesi {next?.label || ''}
          </button>
        )}
      </div>

      <div className="gx-hero__custom">
        {customOpen ? (
          <>
            <input type="datetime-local" value={customVal} onChange={(e) => setCustomVal(e.target.value)} aria-label="Waktu target custom" />
            <button type="button" className="gx-btn gx-btn--sm" onClick={armCustom} disabled={!customVal}>
              Jadwalkan
            </button>
            <button type="button" className="gx-btn gx-btn--sm gx-btn--ghost" style={{ color: '#8f93ad' }} onClick={() => setCustomOpen(false)}>
              Batal
            </button>
          </>
        ) : (
          <>
            <Clock3 size={14} />
            <span>Pre-fire otomatis {ARM_LEAD_MS / 1000} dtk sebelum target.</span>
            <button type="button" className="gx-link" style={{ color: '#aeb1ff' }} onClick={() => setCustomOpen(true)}>
              Atur jam custom
            </button>
          </>
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
  { id: 'warm', label: 'Pre-warm' },
  { id: 'armed', label: 'Standby' },
  { id: 'fire', label: 'Eksekusi' },
  { id: 'done', label: 'Selesai' },
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
  threads: number;
  mode: string;
  region: AseanCountryCode;
}> = ({ phase, isBotRunning, latency, clock, threads, mode, region }) => {
  const reg = ASEAN_REGIONS[region] || ASEAN_REGIONS.ID;
  const idx = PHASES.findIndex((p) => p.id === phase);
  const tone = (v: number | null, good: number, ok: number) =>
    v == null ? '' : v <= good ? 'gx-metric__v--ok' : v <= ok ? 'gx-metric__v--warn' : 'gx-metric__v--bad';
  const avg = latency.history.length ? Math.round(latency.history.reduce((a, b) => a + b, 0) / latency.history.length) : null;

  return (
    <section className="gx-card" style={{ order: 4 }}>
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
            <Server size={12} /> {threads} thread
          </span>
          <span className="gx-tag">Mode {mode}</span>
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
/* Target + readiness                                                  */
/* ------------------------------------------------------------------ */

const PAYMENT_LABEL: Record<string, string> = {
  shopeepay: 'ShopeePay',
  spaylater: 'SPayLater',
  spinjam: 'SPinjam',
};

const TargetCard: React.FC<{
  targets: TargetUrl[];
  selected: TargetUrl | null;
  onSelect: (id: string) => void;
  region: AseanCountryCode;
  onEdit: (t?: TargetUrl) => void;
}> = ({ targets, selected, onSelect, region, onEdit }) => {
  const reg = ASEAN_REGIONS[region] || ASEAN_REGIONS.ID;
  const priceRegion = ((selected?.region as AseanCountryCode) || region) as AseanCountryCode;
  return (
    <section className="gx-card" style={{ order: 2 }}>
      <div className="gx-card__head">
        <h2 className="gx-card__title">
          <Crosshair size={16} /> Target produk
        </h2>
        <div className="gx-card__aside">
          <button type="button" className="gx-link" onClick={() => onEdit()}>
            + Tambah
          </button>
        </div>
      </div>
      <div className="gx-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {selected ? (
          <div className="gx-target">
            <div className="gx-target__thumb">
              <ShoppingBag size={22} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="gx-target__title">{selected.title}</div>
              <div className="gx-target__price">
                <b>{formatAseanCurrency(Number(selected.target_price) || 0, priceRegion)}</b>
                {selected.variant && <span className="gx-tag">{selected.variant}</span>}
              </div>
              <div style={{ marginTop: 6, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {selected.url && (
                  <a className="gx-link" href={selected.url} target="_blank" rel="noopener noreferrer">
                    Buka di Shopee <ChevronRight size={13} />
                  </a>
                )}
                <button type="button" className="gx-link" onClick={() => onEdit(selected)}>
                  Edit
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="gx-empty">
            Belum ada target. Tempel link produk Shopee {reg.name} yang mau di-war.
            <div style={{ marginTop: 10 }}>
              <button type="button" className="gx-btn gx-btn--sm gx-btn--primary" onClick={() => onEdit()}>
                Tambah target
              </button>
            </div>
          </div>
        )}
        {targets.length > 1 && (
          <select className="gx-select" value={selected?.id || ''} onChange={(e) => onSelect(e.target.value)} aria-label="Pilih target aktif">
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        )}
      </div>
    </section>
  );
};

interface CheckItem {
  key: string;
  label: string;
  value: string;
  ok: boolean;
  icon: React.ComponentType<any>;
  action?: () => void;
  actionLabel?: string;
}

const ReadinessCard: React.FC<{ items: CheckItem[] }> = ({ items }) => {
  const done = items.filter((i) => i.ok).length;
  const pct = Math.round((done / items.length) * 100);
  return (
    <section className="gx-card" style={{ order: 3 }}>
      <div className="gx-card__head">
        <h2 className="gx-card__title">
          <ShieldCheck size={16} /> Kesiapan war
        </h2>
        <div className="gx-card__aside">
          <span className={`gx-tag ${pct === 100 ? 'gx-tag--ok' : 'gx-tag--warn'}`}>
            {done}/{items.length} siap
          </span>
        </div>
      </div>
      <div className="gx-card__body">
        <div className="gx-meter" style={{ marginBottom: 10 }}>
          <span style={{ width: `${pct}%`, background: pct === 100 ? 'var(--gx-ok)' : 'var(--gx-warn)' }} />
        </div>
        <ul className="gx-checklist">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <li key={it.key} className={`gx-check ${it.ok ? '' : 'gx-check--todo'}`}>
                <span className="gx-check__icon">{it.ok ? <Check size={15} strokeWidth={3} /> : <Icon size={15} />}</span>
                <div className="gx-check__txt">
                  <div className="gx-check__k">{it.label}</div>
                  <div className="gx-check__v">{it.value}</div>
                </div>
                {it.action && (
                  <button type="button" className="gx-btn gx-btn--xs" onClick={it.action}>
                    {it.actionLabel || (it.ok ? 'Ubah' : 'Atur')}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
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
/* Orders                                                              */
/* ------------------------------------------------------------------ */

export const OrdersList: React.FC<{ orders: NormalizedOrder[]; limit?: number; region: AseanCountryCode }> = ({ orders, limit, region }) => {
  const list = limit ? orders.slice(0, limit) : orders;
  if (!list.length) return <div className="gx-empty">Belum ada checkout tercatat.</div>;
  return (
    <ul className="gx-list">
      {list.map((o) => (
        <li key={o.id} className="gx-row">
          <span className="gx-check__icon" style={{ background: 'var(--gx-flash-soft)', color: 'var(--gx-flash)' }}>
            <Receipt size={14} />
          </span>
          <div className="gx-row__main">
            <div className="gx-row__t">{o.name}</div>
            <div className="gx-row__s gx-mono">
              {o.sn} · {o.method} · {relativeTimeId(o.time)}
            </div>
          </div>
          <div className="gx-row__end">
            <b>{formatAseanCurrency(o.price, ((o.region as AseanCountryCode) || region) as AseanCountryCode)}</b>
            {o.speed != null && <span className="gx-muted gx-mono" style={{ fontSize: 11 }}>{o.speed} ms</span>}
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
      : p.accounts.length === 0
      ? 'Belum ada akun Shopee eksekutor. Tambahkan akun di tab Target.'
      : null;

  const pay = p.paymentSettings;
  const payMethod = pay?.payment_method ? PAYMENT_LABEL[pay.payment_method] || pay.payment_method : '';
  const needsPin = pay?.payment_method === 'shopeepay';
  const defaultAddress = p.addresses.find((a) => a.is_default) || p.addresses[0];

  const checklist: CheckItem[] = [
    {
      key: 'target',
      label: 'Target produk',
      value: p.selectedTarget ? p.selectedTarget.title : 'Belum dipilih',
      ok: !!p.selectedTarget,
      icon: Crosshair,
      action: () => p.onOpenTargetModal(p.selectedTarget || undefined),
    },
    {
      key: 'account',
      label: 'Akun Shopee',
      value: p.accounts.length ? `${p.accounts.length} akun · ${p.accounts[0].nickname}` : 'Belum ada akun',
      ok: p.accounts.length > 0,
      icon: UserRound,
      action: p.accounts.length ? () => p.onGoTab('targets') : p.onOpenAccountModal,
    },
    {
      key: 'address',
      label: 'Alamat pengiriman',
      value: defaultAddress ? `${defaultAddress.label} · ${defaultAddress.recipient_name}` : 'Belum ada alamat',
      ok: !!defaultAddress,
      icon: MapPin,
      action: defaultAddress ? () => p.onGoTab('targets') : p.onOpenAddressModal,
    },
    {
      key: 'payment',
      label: 'Pembayaran',
      value: payMethod ? `${payMethod}${needsPin ? (pay?.shopeepay_pin ? ' · PIN tersimpan' : ' · PIN belum diisi') : ''}` : 'Belum diatur',
      ok: !!payMethod && (!needsPin || !!pay?.shopeepay_pin),
      icon: Wallet,
      action: () => p.onGoTab('targets'),
    },
    {
      key: 'license',
      label: 'Lisensi',
      value: lic.label + (p.user.expired_at ? ` · s/d ${new Date(p.user.expired_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''),
      ok: lic.tone !== 'bad',
      icon: Timer,
      action: p.user.role !== 'admin' ? p.onOpenQris : undefined,
      actionLabel: 'Perpanjang',
    },
  ];

  const todayKey = (() => {
    const t = tzParts(p.clock.now(), reg.timezone);
    return `${t.y}-${t.m}-${t.d}`;
  })();
  const todayCount = p.orders.filter((o) => {
    const t = new Date(o.time).getTime();
    if (isNaN(t)) return false;
    const z = tzParts(t, reg.timezone);
    return `${z.y}-${z.m}-${z.d}` === todayKey;
  }).length;
  const speeds = p.orders.map((o) => o.speed).filter((v): v is number => typeof v === 'number');
  const avgSpeed = speeds.length ? Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length) : null;

  return (
    <>
      {p.announcements.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {p.announcements.slice(0, 3).map((a) => (
            <AnnouncementCard key={a.id} a={a} compact onDismiss={a.pinned ? undefined : () => p.onDismissAnnouncement(a.id)} />
          ))}
        </div>
      )}

      <div className="gx-dash">
        <div className="gx-col">
          <SessionHero
            region={p.region}
            clock={p.clock}
            armed={p.armed}
            onArm={p.onArm}
            onDisarm={p.onDisarm}
            isBotRunning={p.isBotRunning}
            phase={p.phase}
            onStart={p.onStart}
            onStop={p.onStop}
            blocked={blocked}
          />

          <div className="gx-card" style={{ order: 5 }}>
            <div className="gx-metrics gx-metrics--4" style={{ border: 0 }}>
              <div className="gx-metric">
                <div className="gx-metric__k">Checkout tercatat</div>
                <div className="gx-metric__v">{p.orders.length}</div>
              </div>
              <div className="gx-metric">
                <div className="gx-metric__k">Hari ini</div>
                <div className="gx-metric__v">{todayCount}</div>
              </div>
              <div className="gx-metric">
                <div className="gx-metric__k">Rata-rata respons</div>
                <div className="gx-metric__v">
                  {avgSpeed ?? '—'}
                  {avgSpeed != null && <small>ms</small>}
                </div>
              </div>
              <div className="gx-metric">
                <div className="gx-metric__k">Request sesi ini</div>
                <div className="gx-metric__v">{p.stats.attempts}</div>
              </div>
            </div>
          </div>

          <LiveConsole logs={p.logs} onClear={p.onClearLogs} onOpenScript={p.onOpenScript} onCopied={p.onCopied} style={{ order: 6 }} />
        </div>

        <div className="gx-col">
          <TargetCard targets={p.targets} selected={p.selectedTarget} onSelect={p.onSelectTarget} region={p.region} onEdit={p.onOpenTargetModal} />
          <ReadinessCard items={checklist} />
          <EngineMonitor
            phase={p.phase}
            isBotRunning={p.isBotRunning}
            latency={p.latency}
            clock={p.clock}
            threads={p.effectiveThreads}
            mode={p.botSettings.botMode}
            region={p.region}
          />
          <section className="gx-card" style={{ order: 7 }}>
            <div className="gx-card__head">
              <h2 className="gx-card__title">
                <Receipt size={16} /> Checkout terakhir
              </h2>
              <div className="gx-card__aside">
                <button type="button" className="gx-link" onClick={() => p.onGoTab('analytics')}>
                  Semua <ChevronRight size={13} />
                </button>
              </div>
            </div>
            <div className="gx-card__body">
              <OrdersList orders={p.orders} limit={4} region={p.region} />
            </div>
          </section>
        </div>
      </div>
    </>
  );
};

