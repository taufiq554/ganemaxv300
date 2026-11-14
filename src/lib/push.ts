import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api.ts';

/**
 * Pengingat sesi lewat Web Push: dikirim dari server, jadi tetap masuk
 * walau tab GaneMaX.Ai sudah ditutup. Berbeda dari Notification biasa
 * yang cuma jalan selama halaman masih terbuka.
 */

export type PushStatus = 'checking' | 'unsupported' | 'disabled' | 'blocked' | 'off' | 'on';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const supported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export function usePushReminder(armEpoch: number | null, armLabel: string) {
  const [status, setStatus] = useState<PushStatus>('checking');
  const [busy, setBusy] = useState(false);
  const [leadMs, setLeadMs] = useState(300_000);
  const [error, setError] = useState<string | null>(null);
  const keyRef = useRef<string | null>(null);
  const endpointRef = useRef<string | null>(null);

  // Cek dukungan browser + konfigurasi server sekali
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!supported()) {
        setStatus('unsupported');
        return;
      }
      const res = await api.pushKey();
      if (!alive) return;
      if (!res.success || !res.data?.enabled || !res.data.public_key) {
        setStatus('disabled');
        return;
      }
      keyRef.current = res.data.public_key;
      if (res.data.lead_ms) setLeadMs(res.data.lead_ms);
      if (Notification.permission === 'denied') {
        setStatus('blocked');
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!alive) return;
        endpointRef.current = sub?.endpoint ?? null;
        setStatus(sub ? 'on' : 'off');
      } catch {
        if (alive) setStatus('off');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const enable = useCallback(async (): Promise<boolean> => {
    if (!supported() || !keyRef.current) return false;
    setBusy(true);
    setError(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setStatus(perm === 'denied' ? 'blocked' : 'off');
        return false;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(keyRef.current).buffer as ArrayBuffer,
        }));
      const res = await api.pushSubscribe(sub.toJSON(), armEpoch, armLabel);
      if (!res.success) {
        setError(res.error?.message || 'Gagal menyimpan langganan di server.');
        return false;
      }
      endpointRef.current = sub.endpoint;
      setStatus('on');
      return true;
    } catch (err: any) {
      setError(err?.message || 'Browser menolak langganan push.');
      return false;
    } finally {
      setBusy(false);
    }
  }, [armEpoch, armLabel]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api.pushUnsubscribe(sub.endpoint);
        await sub.unsubscribe().catch(() => {});
      }
      endpointRef.current = null;
      setStatus('off');
    } catch (err: any) {
      setError(err?.message || 'Gagal mematikan notifikasi.');
    } finally {
      setBusy(false);
    }
  }, []);

  const sendTest = useCallback(async (): Promise<boolean> => {
    if (!endpointRef.current) return false;
    const res = await api.pushTest(endpointRef.current);
    if (!res.success) setError(res.error?.message || 'Notifikasi uji gagal dikirim.');
    return res.success;
  }, []);

  // Setiap jadwal berubah, kirim ulang ke server supaya pengingatnya ikut berubah
  useEffect(() => {
    if (status !== 'on') return;
    let alive = true;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!sub || !alive) return;
        endpointRef.current = sub.endpoint;
        await api.pushSubscribe(sub.toJSON(), armEpoch, armLabel);
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [status, armEpoch, armLabel]);

  return { status, busy, error, leadMs, enable, disable, sendTest };
}
