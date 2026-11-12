import { useCallback, useEffect, useRef, useState } from 'react';

export interface ClockSample {
  rtt: number;
  offset: number;
}

export interface SyncResult {
  samples: ClockSample[];
  best: ClockSample | null;
}

export interface ServerClock {
  /** Waktu sekarang menurut server (ms epoch), sudah dikoreksi latensi jaringan. */
  now: () => number;
  /** Selisih jam perangkat terhadap server (ms). Positif = jam HP terlambat. */
  offsetMs: number;
  /** Round-trip time terbaik ke server API (ms). */
  rttMs: number | null;
  synced: boolean;
  lastSyncAt: number | null;
  resync: () => Promise<SyncResult>;
}

/**
 * Sinkronisasi jam ala NTP sederhana ke endpoint /api/time.
 * Mengambil 3 sampel, memakai sampel dengan RTT paling kecil.
 */
export function useServerClock(intervalMs = 60_000, onSync?: (r: SyncResult, manual: boolean) => void): ServerClock {
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;
  const offsetRef = useRef(0);
  const [offsetMs, setOffsetMs] = useState(0);
  const [rttMs, setRttMs] = useState<number | null>(null);
  const [synced, setSynced] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const busy = useRef(false);

  const sync = useCallback(async (manual = false): Promise<SyncResult> => {
    const result: SyncResult = { samples: [], best: null };
    if (busy.current) return result;
    busy.current = true;
    try {
      for (let i = 0; i < 3; i++) {
        const t0 = performance.now();
        const wall0 = Date.now();
        const res = await fetch('/api/time', { cache: 'no-store' });
        const t1 = performance.now();
        const json = await res.json().catch(() => null);
        const serverNow = Number(json?.data?.now);
        if (!res.ok || !serverNow) continue;
        const rtt = t1 - t0;
        const sample = { rtt: Math.round(rtt), offset: Math.round(serverNow - (wall0 + rtt / 2)) };
        result.samples.push(sample);
        if (!result.best || sample.rtt < result.best.rtt) result.best = sample;
      }
      if (result.best) {
        offsetRef.current = result.best.offset;
        setOffsetMs(result.best.offset);
        setRttMs(result.best.rtt);
        setSynced(true);
        setLastSyncAt(Date.now());
      }
    } catch {
      // tetap pakai jam lokal
    } finally {
      busy.current = false;
    }
    onSyncRef.current?.(result, manual);
    return result;
  }, []);

  useEffect(() => {
    sync();
    const id = window.setInterval(sync, intervalMs);
    const onVis = () => {
      if (document.visibilityState === 'visible') sync();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [sync, intervalMs]);

  const now = useCallback(() => Date.now() + offsetRef.current, []);

  const resync = useCallback(() => sync(true), [sync]);
  return { now, offsetMs, rttMs, synced, lastSyncAt, resync };
}

/** Re-render komponen kecil setiap frame / interval tanpa membebani parent. */
export function useTicker(intervalMs = 50) {
  const [, setT] = useState(0);
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (ts: number) => {
      if (ts - last >= intervalMs) {
        last = ts;
        setT((v) => (v + 1) % 1_000_000);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [intervalMs]);
}
