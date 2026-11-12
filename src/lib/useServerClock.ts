import { useCallback, useEffect, useRef, useState } from 'react';

export interface ServerClock {
  /** Waktu sekarang menurut server (ms epoch), sudah dikoreksi latensi jaringan. */
  now: () => number;
  /** Selisih jam perangkat terhadap server (ms). Positif = jam HP terlambat. */
  offsetMs: number;
  /** Round-trip time terbaik ke server API (ms). */
  rttMs: number | null;
  synced: boolean;
  lastSyncAt: number | null;
  resync: () => void;
}

/**
 * Sinkronisasi jam ala NTP sederhana ke endpoint /api/time.
 * Mengambil 3 sampel, memakai sampel dengan RTT paling kecil.
 */
export function useServerClock(intervalMs = 60_000): ServerClock {
  const offsetRef = useRef(0);
  const [offsetMs, setOffsetMs] = useState(0);
  const [rttMs, setRttMs] = useState<number | null>(null);
  const [synced, setSynced] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const busy = useRef(false);

  const sync = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      let best: { rtt: number; offset: number } | null = null;
      for (let i = 0; i < 3; i++) {
        const t0 = performance.now();
        const wall0 = Date.now();
        const res = await fetch('/api/time', { cache: 'no-store' });
        const t1 = performance.now();
        const json = await res.json().catch(() => null);
        const serverNow = Number(json?.data?.now);
        if (!res.ok || !serverNow) continue;
        const rtt = t1 - t0;
        const offset = serverNow - (wall0 + rtt / 2);
        if (!best || rtt < best.rtt) best = { rtt, offset };
      }
      if (best) {
        offsetRef.current = best.offset;
        setOffsetMs(Math.round(best.offset));
        setRttMs(Math.round(best.rtt));
        setSynced(true);
        setLastSyncAt(Date.now());
      }
    } catch {
      // tetap pakai jam lokal
    } finally {
      busy.current = false;
    }
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

  return { now, offsetMs, rttMs, synced, lastSyncAt, resync: sync };
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
