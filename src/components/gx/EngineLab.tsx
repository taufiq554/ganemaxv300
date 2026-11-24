import React, { useEffect, useState } from 'react';
import {
  Activity,
  BatteryCharging,
  BatteryMedium,
  Bell,
  CircleCheck,
  CircleAlert,
  Download,
  FlaskConical,
  Gauge,
  Globe2,
  MonitorSmartphone,
  Radar,
  Signal,
  Sun,
  TriangleAlert,
  Wifi,
} from 'lucide-react';
import { AseanCountryCode, BotLogItem, TargetUrl } from '../../types/index.ts';
import { ASEAN_REGIONS } from '../../constants/asean.ts';
import { ServerClock } from '../../lib/useServerClock.ts';
import { api } from '../../services/api.ts';
import { parseShopeeLink } from '../../lib/shopee.ts';
import { useLang } from '../../lib/i18n.tsx';
import { Ring } from './Skeleton.tsx';

/**
 * Ruang uji engine. Semua angka di sini diukur langsung dari HP user — bukan
 * dari server — karena yang menentukan menang-kalah adalah seberapa cepat
 * HP kamu sendiri sampai ke Shopee.
 */

const SHOPEE_HOST: Record<string, string> = {
  ID: 'shopee.co.id',
  MY: 'shopee.com.my',
  SG: 'shopee.sg',
  TH: 'shopee.co.th',
  VN: 'shopee.vn',
  PH: 'shopee.ph',
};

export interface PhonePing {
  cold: number | null;
  warm: number[];
  avg: number | null;
  min: number | null;
  jitter: number | null;
  failed: number;
  at: number;
}

/** Ukur waktu bolak-balik HP → Shopee. Permintaan pertama termasuk DNS + TLS. */
export async function measurePhoneToShopee(region: string, samples = 5): Promise<PhonePing> {
  const host = SHOPEE_HOST[region] || SHOPEE_HOST.ID;
  const once = async () => {
    const t0 = performance.now();
    // no-cors: respons buram, tapi tetap selesai begitu Shopee menjawab
    await fetch(`https://${host}/favicon.ico?gx=${Date.now()}${Math.random()}`, { mode: 'no-cors', cache: 'no-store' });
    return Math.round(performance.now() - t0);
  };
  let cold: number | null = null;
  const warm: number[] = [];
  let failed = 0;
  for (let i = 0; i < samples; i++) {
    try {
      const ms = await once();
      if (i === 0) cold = ms;
      else warm.push(ms);
    } catch {
      failed++;
    }
  }
  const pool = warm.length ? warm : cold != null ? [cold] : [];
  const avg = pool.length ? Math.round(pool.reduce((a, b) => a + b, 0) / pool.length) : null;
  const min = pool.length ? Math.min(...pool) : null;
  const jitter = pool.length > 1 && avg != null ? Math.round(Math.sqrt(pool.reduce((a, b) => a + (b - avg) ** 2, 0) / pool.length)) : null;
  return { cold, warm, avg, min, jitter, failed, at: Date.now() };
}

/**
 * Perkiraan jeda buka dari waktu tempuh HP → Shopee. Membuka halaman produk
 * butuh belasan kali bolak-balik plus waktu render, jadi makin lambat jaringan,
 * makin awal Shopee perlu dibuka. Ini perkiraan, bukan jaminan.
 */
export function leadFromPing(avg: number | null): number | null {
  if (avg == null) return null;
  if (avg < 80) return 2000;
  if (avg < 150) return 3000;
  if (avg < 300) return 5000;
  return 8000;
}

type Device = {
  online: boolean;
  netType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  battery?: number;
  charging?: boolean;
  wakeLock: boolean;
  notif: NotificationPermission | 'unsupported';
  standalone: boolean;
  tz: string;
};

function readDevice(): Device {
  const c: any = (navigator as any).connection;
  return {
    online: navigator.onLine,
    netType: c?.effectiveType,
    downlink: typeof c?.downlink === 'number' ? c.downlink : undefined,
    rtt: typeof c?.rtt === 'number' ? c.rtt : undefined,
    saveData: !!c?.saveData,
    wakeLock: 'wakeLock' in navigator,
    notif: typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
    standalone: window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

export const EngineLab: React.FC<{
  region: AseanCountryCode;
  clock: ServerClock;
  target?: TargetUrl;
  accountId?: string;
  currentLeadMs: number;
  aiMode: boolean;
  logs: BotLogItem[];
  onLog: (text: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
  onApplyLead: (ms: number) => void;
  onPhonePing: (p: PhonePing) => void;
}> = ({ region, clock, target, accountId, currentLeadMs, aiMode, logs, onLog, onApplyLead, onPhonePing }) => {
  const { L } = useLang();
  const reg = ASEAN_REGIONS[region] || ASEAN_REGIONS.ID;
  const [dev, setDev] = useState<Device>(() => readDevice());
  const [ping, setPing] = useState<PhonePing | null>(null);
  const [pinging, setPinging] = useState(false);
  const [dry, setDry] = useState<null | { step: string; done: string[]; bad: string[] }>(null);

  // Pantau perubahan jaringan & baterai secara langsung
  useEffect(() => {
    const refresh = () => setDev((d) => ({ ...readDevice(), battery: d.battery, charging: d.charging }));
    window.addEventListener('online', refresh);
    window.addEventListener('offline', refresh);
    const c: any = (navigator as any).connection;
    c?.addEventListener?.('change', refresh);
    let bat: any = null;
    const onBat = () => bat && setDev((d) => ({ ...d, battery: Math.round(bat.level * 100), charging: bat.charging }));
    (navigator as any).getBattery?.().then((b: any) => {
      bat = b;
      onBat();
      b.addEventListener('levelchange', onBat);
      b.addEventListener('chargingchange', onBat);
    }).catch(() => {});
    return () => {
      window.removeEventListener('online', refresh);
      window.removeEventListener('offline', refresh);
      c?.removeEventListener?.('change', refresh);
      bat?.removeEventListener?.('levelchange', onBat);
      bat?.removeEventListener?.('chargingchange', onBat);
    };
  }, []);

  const runPing = async () => {
    setPinging(true);
    onLog(L(`[LAB] Mengukur HP → ${SHOPEE_HOST[region] || 'shopee'} (5 sampel)…`, `[LAB] Measuring phone → ${SHOPEE_HOST[region] || 'shopee'} (5 samples)…`), 'info');
    const r = await measurePhoneToShopee(region, 5);
    setPing(r);
    setPinging(false);
    onPhonePing(r);
    if (r.avg == null) {
      onLog(L('[LAB] Shopee tidak terjangkau dari HP ini. Cek sinyal atau VPN.', '[LAB] Shopee is unreachable from this phone. Check signal or VPN.'), 'error');
    } else {
      onLog(
        L(
          `[LAB] HP → Shopee: pertama ${r.cold} ms (termasuk DNS+TLS) · stabil ${r.avg} ms · tercepat ${r.min} ms · jitter ±${r.jitter ?? 0} ms`,
          `[LAB] Phone → Shopee: first ${r.cold} ms (incl. DNS+TLS) · steady ${r.avg} ms · best ${r.min} ms · jitter ±${r.jitter ?? 0} ms`
        ),
        'success'
      );
    }
  };

  /** Uji coba lengkap tanpa membuka Shopee — semua tahap diukur sungguhan. */
  const runDry = async () => {
    const done: string[] = [];
    const bad: string[] = [];
    const step = (s: string) => setDry({ step: s, done: [...done], bad: [...bad] });
    onLog(L('[LAB] Uji coba lengkap dimulai — Shopee tidak dibuka.', '[LAB] Full dry run started — Shopee will not be opened.'), 'info');

    step(L('Sinkron jam ke server', 'Syncing clock with server'));
    const sync = await clock.resync();
    if (sync.best) done.push(L(`Jam tersinkron · akurasi ±${Math.ceil(sync.best.rtt / 2)} ms`, `Clock synced · accuracy ±${Math.ceil(sync.best.rtt / 2)} ms`));
    else bad.push(L('Sinkron jam gagal', 'Clock sync failed'));

    step(L('Ukur HP → Shopee', 'Measuring phone → Shopee'));
    const r = await measurePhoneToShopee(region, 5);
    setPing(r);
    onPhonePing(r);
    if (r.avg != null) done.push(L(`HP → Shopee ${r.avg} ms (stabil)`, `Phone → Shopee ${r.avg} ms (steady)`));
    else bad.push(L('Shopee tidak terjangkau dari HP', 'Shopee unreachable from phone'));

    step(L('Cek lisensi', 'Checking license'));
    const lic = await api.sessionStart();
    if (lic.success) done.push(L('Lisensi aktif', 'License active'));
    else bad.push(lic.error?.message || L('Lisensi bermasalah', 'License problem'));

    step(L('Cek link target', 'Checking target link'));
    if (!target?.url) bad.push(L('Belum ada target dipilih', 'No target selected'));
    else if (!parseShopeeLink(target.url)) bad.push(L('Link target tidak memuat ID produk', 'Target link has no product ID'));
    else {
      const ck = await api.checkItem(region, target.url, accountId);
      if (ck.success && ck.data?.item) done.push(L(`Produk terbaca: ${ck.data.item.name}`.slice(0, 70), `Product read: ${ck.data.item.name}`.slice(0, 70)));
      else done.push(L('Link valid (data produk ditolak Shopee — bot tetap bisa membuka)', 'Link valid (product data refused by Shopee — bot can still open it)'));
    }

    setDry({ step: '', done, bad });
    done.forEach((d) => onLog(`[LAB] ✓ ${d}`, 'success'));
    bad.forEach((b) => onLog(`[LAB] ✗ ${b}`, 'error'));
    onLog(
      bad.length
        ? L(`[LAB] Uji coba selesai · ${bad.length} masalah perlu dibereskan sebelum sesi.`, `[LAB] Dry run done · ${bad.length} issue(s) to fix before the session.`)
        : L('[LAB] Uji coba selesai · semua siap.', '[LAB] Dry run done · all clear.'),
      bad.length ? 'warning' : 'success'
    );
  };

  const exportLogs = () => {
    const text = logs.map((l) => `${l.time}  ${l.type.toUpperCase().padEnd(7)}  ${l.text}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ganemax-log-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    onLog(L(`[LAB] ${logs.length} baris log diunduh.`, `[LAB] ${logs.length} log lines downloaded.`), 'info');
  };

  const suggested = leadFromPing(ping?.avg ?? null);
  const tzOk = dev.tz === reg.timezone;
  const NetIcon = dev.netType === 'wifi' ? Wifi : Signal;

  const rows: { icon: React.ComponentType<any>; label: string; value: string; tone: 'ok' | 'warn' | 'bad' }[] = [
    {
      icon: dev.online ? NetIcon : TriangleAlert,
      label: L('Jaringan', 'Network'),
      value: !dev.online
        ? L('Offline', 'Offline')
        : [dev.netType?.toUpperCase(), dev.downlink ? `${dev.downlink} Mbps` : null, dev.rtt ? `RTT ${dev.rtt} ms` : null].filter(Boolean).join(' · ') || L('Online', 'Online'),
      tone: !dev.online ? 'bad' : dev.netType === '2g' || dev.netType === 'slow-2g' ? 'bad' : dev.netType === '3g' || dev.saveData ? 'warn' : 'ok',
    },
    {
      icon: dev.charging ? BatteryCharging : BatteryMedium,
      label: L('Baterai', 'Battery'),
      value: dev.battery != null ? `${dev.battery}%${dev.charging ? L(' · mengisi', ' · charging') : ''}` : L('Tidak terbaca di browser ini', 'Not readable in this browser'),
      tone: dev.battery == null ? 'warn' : dev.battery < 15 && !dev.charging ? 'bad' : dev.battery < 30 && !dev.charging ? 'warn' : 'ok',
    },
    {
      icon: Sun,
      label: L('Layar tetap menyala', 'Keep screen on'),
      value: dev.wakeLock ? L('Didukung', 'Supported') : L('Tidak didukung — matikan auto-kunci manual', 'Not supported — disable auto-lock manually'),
      tone: dev.wakeLock ? 'ok' : 'warn',
    },
    {
      icon: Bell,
      label: L('Notifikasi', 'Notifications'),
      value: dev.notif === 'granted' ? L('Diizinkan', 'Allowed') : dev.notif === 'denied' ? L('Diblokir', 'Blocked') : dev.notif === 'unsupported' ? L('Tidak didukung', 'Unsupported') : L('Belum diizinkan', 'Not allowed yet'),
      tone: dev.notif === 'granted' ? 'ok' : dev.notif === 'denied' ? 'bad' : 'warn',
    },
    {
      icon: MonitorSmartphone,
      label: L('Mode aplikasi', 'App mode'),
      value: dev.standalone ? L('Terpasang (PWA)', 'Installed (PWA)') : L('Browser — pasang ke layar utama agar lebih stabil', 'Browser — install to home screen for stability'),
      tone: dev.standalone ? 'ok' : 'warn',
    },
    {
      icon: Globe2,
      label: L('Zona waktu HP', 'Phone time zone'),
      value: tzOk ? dev.tz : L(`${dev.tz} (Shopee ${reg.name}: ${reg.timezone}) — aman, jam bot pakai server`, `${dev.tz} (Shopee ${reg.name}: ${reg.timezone}) — fine, the bot uses server time`),
      tone: tzOk ? 'ok' : 'warn',
    },
  ];

  return (
    <section className="gx-card gx-lab">
      <div className="gx-card__head">
        <h2 className="gx-card__title">
          <FlaskConical size={16} /> {L('Lab engine', 'Engine lab')}
        </h2>
        <div className="gx-card__aside">
          <button type="button" className="gx-btn gx-btn--xs gx-btn--ghost" onClick={exportLogs} disabled={!logs.length}>
            <Download size={12} /> {L('Ekspor log', 'Export log')}
          </button>
        </div>
      </div>
      <div className="gx-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Ping HP → Shopee */}
        <div className="gx-lab__ping">
          <div className="gx-lab__pinghead">
            <span>
              <Radar size={14} /> {L('Kecepatan HP → Shopee', 'Phone → Shopee speed')}
            </span>
            <button type="button" className="gx-btn gx-btn--xs gx-btn--primary" onClick={runPing} disabled={pinging || !!dry?.step}>
              {pinging ? <Ring size={12} /> : <Activity size={12} />} {pinging ? L('Mengukur…', 'Measuring…') : L('Ukur', 'Measure')}
            </button>
          </div>
          <div className="gx-metrics gx-metrics--4">
            <div className="gx-metric">
              <div className="gx-metric__k">{L('Stabil', 'Steady')}</div>
              <div className={`gx-metric__v ${ping?.avg != null ? (ping.avg < 150 ? 'gx-metric__v--ok' : ping.avg < 300 ? 'gx-metric__v--warn' : 'gx-metric__v--bad') : ''}`}>
                {ping?.avg != null ? `${ping.avg} ms` : '—'}
              </div>
            </div>
            <div className="gx-metric">
              <div className="gx-metric__k">{L('Pertama', 'First')}</div>
              <div className="gx-metric__v">{ping?.cold != null ? `${ping.cold} ms` : '—'}</div>
            </div>
            <div className="gx-metric">
              <div className="gx-metric__k">{L('Tercepat', 'Best')}</div>
              <div className="gx-metric__v">{ping?.min != null ? `${ping.min} ms` : '—'}</div>
            </div>
            <div className="gx-metric">
              <div className="gx-metric__k">Jitter</div>
              <div className="gx-metric__v">{ping?.jitter != null ? `±${ping.jitter}` : '—'}</div>
            </div>
          </div>
          {suggested != null && (
            <div className="gx-lab__suggest">
              <Gauge size={14} />
              <span>
                {L(
                  `Dengan kecepatan ini, Shopee sebaiknya dibuka ±${suggested / 1000} detik lebih awal${suggested === currentLeadMs ? ' — sudah sesuai setelan kamu.' : '.'}`,
                  `At this speed, open Shopee about ${suggested / 1000} s early${suggested === currentLeadMs ? ' — matches your setting.' : '.'}`
                )}
              </span>
              {suggested !== currentLeadMs && !aiMode && (
                <button type="button" className="gx-btn gx-btn--xs" onClick={() => onApplyLead(suggested)}>
                  {L('Pakai', 'Apply')}
                </button>
              )}
            </div>
          )}
          {ping?.avg == null && ping && (
            <p className="gx-hint gx-hint--warn" style={{ margin: 0 }}>
              {L('Shopee tidak terjangkau dari HP ini. Cek sinyal, matikan VPN, atau coba jaringan lain.', 'Shopee is unreachable from this phone. Check signal, turn off VPN, or try another network.')}
            </p>
          )}
        </div>

        {/* Diagnostik perangkat */}
        <ul className="gx-list gx-lab__dev">
          {rows.map((r) => {
            const Icon = r.icon;
            return (
              <li key={r.label} className="gx-row">
                <span className={`gx-lab__dot gx-lab__dot--${r.tone}`}>
                  <Icon size={14} />
                </span>
                <div className="gx-row__main">
                  <div className="gx-row__t">{r.label}</div>
                  <div className="gx-row__s">{r.value}</div>
                </div>
              </li>
            );
          })}
        </ul>

        {/* Uji coba lengkap */}
        <div className="gx-lab__dry">
          <button type="button" className="gx-btn gx-btn--primary" onClick={runDry} disabled={!!dry?.step || pinging}>
            {dry?.step ? <Ring size={14} /> : <FlaskConical size={15} />}
            {dry?.step ? dry.step + '…' : L('Uji coba lengkap', 'Full dry run')}
          </button>
          <small className="gx-muted">
            {L('Sinkron jam, ukur HP → Shopee, cek lisensi & link target — tanpa membuka Shopee.', 'Clock sync, phone → Shopee, license & target link — without opening Shopee.')}
          </small>
          {dry && !dry.step && (
            <ul className="gx-lab__result gx-reveal">
              {dry.done.map((d) => (
                <li key={d} className="ok">
                  <CircleCheck size={13} /> {d}
                </li>
              ))}
              {dry.bad.map((d) => (
                <li key={d} className="bad">
                  <CircleAlert size={13} /> {d}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
};
