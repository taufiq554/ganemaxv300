import React, { useEffect, useState } from 'react';
import { CircleCheck, CircleX, ExternalLink, ShoppingBag } from 'lucide-react';
import { AseanCountryCode, TargetUrl } from '../../types/index.ts';
import { formatAseanCurrency } from '../../constants/asean.ts';
import { ServerClock, useTicker } from '../../lib/useServerClock.ts';

export interface FireState {
  target: TargetUrl;
  href: string;
  via: string;
  autoOpened: boolean;
  scheduledEpoch: number | null;
  firedAt: number;
  region: AseanCountryCode;
}

const Elapsed: React.FC<{ clock: ServerClock; from: number }> = ({ clock, from }) => {
  useTicker(60);
  const ms = Math.max(0, clock.now() - from);
  return (
    <span className="gx-fire__elapsed">
      +{Math.floor(ms / 1000)}.{String(Math.floor(ms % 1000)).padStart(3, '0')} dtk
    </span>
  );
};

export const FireOverlay: React.FC<{
  state: FireState | null;
  clock: ServerClock;
  onOpen: (href: string) => void;
  onResult: (r: { success: boolean; orderSn?: string; price?: number; note?: string }) => Promise<void> | void;
}> = ({ state, clock, onOpen, onResult }) => {
  const [step, setStep] = useState<'open' | 'confirm'>('open');
  const [orderSn, setOrderSn] = useState('');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (state) {
      setStep(state.autoOpened ? 'confirm' : 'open');
      setOrderSn('');
      setPrice(state.target.target_price ? String(state.target.target_price) : '');
    }
  }, [state]);

  if (!state) return null;
  const t = state.target;

  const submit = async (success: boolean, note?: string) => {
    setBusy(true);
    await onResult({ success, orderSn: orderSn.trim() || undefined, price: price ? Number(price) : undefined, note });
    setBusy(false);
  };

  return (
    <div className="gx-overlay gx-overlay--center gx-fire" role="dialog" aria-modal="true" aria-label="Sesi flash sale dimulai">
      <div className="gx-fire__card">
        <div className="gx-fire__top">
          <span className="gx-fire__badge">
            <span className="gx-led gx-led--pulse" /> {state.scheduledEpoch != null ? "Sesi dimulai" : "Shopee dibuka"}
          </span>
          <Elapsed clock={clock} from={state.scheduledEpoch ?? state.firedAt} />
        </div>
        <div className="gx-fire__product">
          <span className="gx-fire__thumb">
            <ShoppingBag size={22} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="gx-fire__title">{t.title}</div>
            {Number(t.target_price) > 0 && <div className="gx-fire__price">{formatAseanCurrency(Number(t.target_price), state.region)}</div>}
          </div>
        </div>

        {step === 'open' ? (
          <>
            <button
              type="button"
              className="gx-fire__go"
              onClick={() => {
                onOpen(state.href);
                setStep('confirm');
              }}
              autoFocus
            >
              <ExternalLink size={22} /> Buka Shopee sekarang
            </button>
            <p className="gx-fire__hint">Langsung tap "Beli Sekarang" lalu bayar di Shopee. Lewat {state.via}.</p>
            <button type="button" className="gx-fire__skip" onClick={() => setStep('confirm')}>
              Sudah terbuka
            </button>
          </>
        ) : (
          <>
            <p className="gx-fire__hint" style={{ marginTop: 0 }}>
              Selesaikan checkout di Shopee, lalu laporkan hasilnya di sini supaya tercatat di riwayat.
            </p>
            <div className="gx-formgrid gx-formgrid--2">
              <label className="gx-field">
                <span>No. pesanan (opsional)</span>
                <input value={orderSn} onChange={(e) => setOrderSn(e.target.value)} placeholder="dari halaman Pesanan Saya" autoComplete="off" />
              </label>
              <label className="gx-field">
                <span>Harga dibayar</span>
                <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="1000" />
              </label>
            </div>
            <div className="gx-fire__actions">
              <button type="button" className="gx-btn gx-btn--lg gx-btn--primary" disabled={busy} onClick={() => submit(true)}>
                <CircleCheck size={18} /> Berhasil checkout
              </button>
              <button type="button" className="gx-btn gx-btn--lg" disabled={busy} onClick={() => submit(false, 'kehabisan / gagal')}>
                <CircleX size={18} /> Tidak dapat
              </button>
            </div>
            <button type="button" className="gx-fire__skip" onClick={() => onOpen(state.href)}>
              Buka Shopee lagi
            </button>
          </>
        )}
      </div>
    </div>
  );
};
