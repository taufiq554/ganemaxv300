import { BotLogItem } from '../types/index.ts';

/**
 * Penyimpanan lokal untuk hal-hal yang harus selamat dari reload / tab dibuang browser:
 * jadwal auto-start dan riwayat log sesi.
 */

const ARM_KEY = 'gx_armed_v1';
const LOG_KEY = 'gx_logs_v1';
const MAX_LOGS = 400;

export interface StoredArm {
  epoch: number;
  label: string;
  targetId?: string;
  region?: string;
  savedAt: number;
}

export function loadArmed(): StoredArm | null {
  try {
    const raw = localStorage.getItem(ARM_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!v || typeof v.epoch !== 'number' || typeof v.label !== 'string') return null;
    // Jadwal yang sudah lewat lebih dari 2 menit dianggap hangus
    if (v.epoch < Date.now() - 120_000) {
      localStorage.removeItem(ARM_KEY);
      return null;
    }
    return v as StoredArm;
  } catch {
    return null;
  }
}

export function saveArmed(a: StoredArm | null) {
  try {
    if (a) localStorage.setItem(ARM_KEY, JSON.stringify(a));
    else localStorage.removeItem(ARM_KEY);
  } catch {}
}

export function loadLogs(): BotLogItem[] | null {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!Array.isArray(v) || v.length === 0) return null;
    return v
      .filter((x) => x && typeof x.text === 'string' && typeof x.time === 'string')
      .slice(-MAX_LOGS)
      .map((x, i) => ({
        id: typeof x.id === 'string' ? x.id : `restored_${i}`,
        time: x.time,
        text: x.text,
        type: ['info', 'success', 'error', 'warning'].includes(x.type) ? x.type : 'info',
      })) as BotLogItem[];
  } catch {
    return null;
  }
}

/** Ditulis dengan jeda supaya tidak membebani saat log masuk beruntun. */
let logTimer: number | undefined;
export function saveLogs(logs: BotLogItem[]) {
  if (typeof window === 'undefined') return;
  window.clearTimeout(logTimer);
  logTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(LOG_KEY, JSON.stringify(logs.slice(-MAX_LOGS)));
    } catch {
      // kuota penuh — simpan versi pendek saja
      try {
        localStorage.setItem(LOG_KEY, JSON.stringify(logs.slice(-80)));
      } catch {}
    }
  }, 800);
}

export function clearStoredLogs() {
  try {
    localStorage.removeItem(LOG_KEY);
  } catch {}
}
