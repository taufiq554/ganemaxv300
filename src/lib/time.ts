// Utilitas waktu: jam server tersinkron + jadwal sesi flash sale per zona waktu wilayah.

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function getDtf(tz: string) {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    dtfCache.set(tz, f);
  }
  return f;
}

export interface TzParts {
  y: number;
  m: number; // 1-12
  d: number;
  h: number;
  mi: number;
  s: number;
}

export function tzParts(epoch: number, tz: string): TzParts {
  const parts = getDtf(tz).formatToParts(new Date(epoch));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value || 0);
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour') % 24, mi: get('minute'), s: get('second') };
}

/** Selisih (ms) zona waktu terhadap UTC pada epoch tertentu. */
export function tzOffsetMs(epoch: number, tz: string): number {
  const p = tzParts(epoch, tz);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
  return asUtc - Math.floor(epoch / 1000) * 1000;
}

export interface SessionSlot {
  label: string; // "12:00"
  epoch: number; // waktu mulai sesi (UTC ms)
  status: 'past' | 'live' | 'next' | 'later';
}

/** Jendela "LIVE" setelah sesi dimulai (stok flash sale biasanya habis < 2 menit). */
export const LIVE_WINDOW_MS = 2 * 60 * 1000;

/** Hitung semua slot sesi hari ini (zona waktu wilayah) beserta statusnya. */
export function getSessionSlots(now: number, schedule: string[], tz: string, dayRef: number = now): SessionSlot[] {
  const offset = tzOffsetMs(dayRef, tz);
  const p = tzParts(dayRef, tz);
  const slots = schedule
    .map((label) => {
      const [h, mi] = label.split(':').map(Number);
      const epoch = Date.UTC(p.y, p.m - 1, p.d, h, mi, 0) - offset;
      return { label, epoch, status: 'later' as SessionSlot['status'] };
    })
    .sort((a, b) => a.epoch - b.epoch);

  let nextAssigned = false;
  for (const s of slots) {
    if (now >= s.epoch + LIVE_WINDOW_MS) s.status = 'past';
    else if (now >= s.epoch) s.status = 'live';
    else if (!nextAssigned) {
      s.status = 'next';
      nextAssigned = true;
    }
  }
  return slots;
}

/** Sesi berikutnya yang belum dimulai (bisa jatuh ke besok). */
export function getNextSession(now: number, schedule: string[], tz: string): { label: string; epoch: number } | null {
  if (!schedule.length) return null;
  const today = getSessionSlots(now, schedule, tz).find((s) => s.epoch > now);
  if (today) return { label: today.label, epoch: today.epoch };
  const tomorrow = getSessionSlots(now, schedule, tz, now + 24 * 3600 * 1000)[0];
  // slot pertama besok
  return tomorrow ? { label: tomorrow.label, epoch: tomorrow.epoch } : null;
}

export function pad(n: number, len = 2) {
  return String(Math.max(0, Math.floor(n))).padStart(len, '0');
}

export function splitDuration(ms: number) {
  const v = Math.max(0, ms);
  return {
    h: Math.floor(v / 3_600_000),
    m: Math.floor((v % 3_600_000) / 60_000),
    s: Math.floor((v % 60_000) / 1000),
    ms: Math.floor(v % 1000),
  };
}

export function formatClock(epoch: number, tz: string) {
  const p = tzParts(epoch, tz);
  return `${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}`;
}

/** Bulan (YYYY-MM) dalam zona waktu WIB untuk rekap pendapatan. */
export function monthKeyWib(iso: string | number | Date): string {
  const epoch = new Date(iso).getTime();
  if (isNaN(epoch)) return 'invalid';
  const p = tzParts(epoch, 'Asia/Jakarta');
  return `${p.y}-${pad(p.m)}`;
}

export const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export function monthLabel(key: string, short = false) {
  const [y, m] = key.split('-').map(Number);
  const name = MONTH_NAMES_ID[(m || 1) - 1] || '';
  return short ? `${name.slice(0, 3)} ${String(y).slice(2)}` : `${name} ${y}`;
}

export function shiftMonth(key: string, delta: number) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

export function relativeTimeId(iso?: string | null, now = Date.now()) {
  if (!iso) return '-';
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '-';
  const diff = Math.round((now - t) / 1000);
  if (diff < 60) return 'baru saja';
  if (diff < 3600) return `${Math.floor(diff / 60)} mnt lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} hari lalu`;
  return new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}
