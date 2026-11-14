import React, { useEffect, useState } from 'react';
import { CircleCheck, CircleX, ExternalLink, ShoppingBag, UserRound, MapPin, Wallet, Ticket } from 'lucide-react';
import { AseanCountryCode, TargetUrl } from '../../types/index.ts';
import { formatAseanCurrency, ASEAN_REGIONS } from '../../constants/asean.ts';
import { ServerClock, useTicker } from '../../lib/useServerClock.ts';
import { useLang } from '../../lib/i18n.tsx';

export interface FireState {
  target: TargetUrl;
  href: string;
  via: string;
  autoOpened: boolean;
  scheduledEpoch: number | null;
  firedAt: number;
  region: AseanCountryCode;
  accountLabel?: string;
  addressLabel?: string;
  paymentLabel?: string;
  voucher?: string;
  backups?: { id: string; title: string; href: string; price: number; region: AseanCountryCode }[];
}

const Elapsed: React.FC<{ clock: ServerClock; from: number }> = ({ clock, from }) => {
  useTicker(60);
  const ms = Math.max(0, clock.now() - from);
  return (
    <span className="gx-fire__elapsed">
      +{Math.floor(ms / 1000)}.{String(Math.floor(ms % 1000)).padStart(3, '0')} s
    </span>
  );
};

export const FireOverlay: React.FC<{
  state: FireState | null;
  clock: ServerClock;
  onOpen: (href: string) => void;
  onResult: (r: { success: boolean; orderSn?: string; price?: number; note?: string }) => Promise<void> | void;
}> = ({ state, clock, onOpen, onResult }) => {
  const { L } = useLang();
  const [step, setStep] = useState<'open' | 'confirm'>('open');
  const [orderSn, setOrderSn] = useState('');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (state) {
      setStep(state.autoOpened ? 'confirm' : 'open');
      setOrderSn('');
      setPrice(state.target.target_price ? String(state.target.target_price) : '');
      setBusy(false);
    }
  }, [state]);

  if (!state) return null;
  const t = state.target;
  const reg = ASEAN_REGIONS[state.region] || ASEAN_REGIONS.ID;

  const submit = async (success: boolean, note?: string) => {
    setBusy(true);
    try {
      const p = price ? Number(price) : undefined;
      await onResult({ success, orderSn: orderSn.trim() || undefined, price: p != null && isFinite(p) ? p : undefined, note });
    } finally {
      setBusy(false);
    }
  };

  const reminders = [
    state.accountLabel && { icon: UserRound, text: state.accountLabel },
    state.addressLabel && { icon: MapPin, text: state.addressLabel },
    state.paymentLabel && { icon: Wallet, text: state.paymentLabel },
    state.voucher && { icon: Ticket, text: `${L('Voucher', 'Voucher')} ${state.voucher}` },
  ].filter(Boolean) as { icon: React.ComponentType<any>; text: string }[];

  return (
    <div className="gx-overlay gx-overlay--center gx-fire" role="dialog" aria-modal="true" aria-label={L('Sesi flash sale dimulai', 'Flash sale session started')}>
      <div className="gx-fire__card">
        <div className="gx-fire__top">
          <span className="gx-fire__badge">
            <span className="gx-led gx-led--pulse" /> {state.scheduledEpoch != null ? L('Sesi dimulai', 'Session started') : L('Shopee dibuka', 'Shopee opened')}
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

        {reminders.length > 0 && (
          <div className="gx-fire__remind">
            {reminders.map((r, i) => {
              const Icon = r.icon;
              return (
                <span key={i}>
                  <Icon size={13} /> {r.text}
                </span>
              );
            })}
          </div>
        )}

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
              <ExternalLink size={22} /> {L('Buka Shopee sekarang', 'Open Shopee now')}
            </button>
            <p className="gx-fire__hint">
              {L('Langsung tap "Beli Sekarang" lalu bayar.', 'Tap "Buy Now" right away and pay.')} {L('Lewat', 'Via')} {state.via} · {reg.domain}
            </p>
            <button type="button" className="gx-fire__skip" onClick={() => setStep('confirm')}>
              {L('Sudah terbuka', 'Already opened')}
            </button>
          </>
        ) : (
          <>
            <p className="gx-fire__hint" style={{ marginTop: 0 }}>
              {L('Selesaikan checkout di Shopee, lalu laporkan hasilnya supaya tercatat di riwayat.', 'Finish checkout in Shopee, then report the result so it is saved to history.')}
            </p>
            <div className="gx-formgrid gx-formgrid--2">
              <label className="gx-field">
                <span>{L('No. pesanan (opsional)', 'Order no. (optional)')}</span>
                <input value={orderSn} onChange={(e) => setOrderSn(e.target.value)} placeholder={L('dari Pesanan Saya', 'from My Purchases')} autoComplete="off" />
              </label>
              <label className="gx-field">
                <span>
                  {L('Harga dibayar', 'Price paid')} ({reg.currencySymbol})
                </span>
                <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" />
              </label>
            </div>
            <div className="gx-fire__actions">
              <button type="button" className="gx-btn gx-btn--lg gx-btn--primary" disabled={busy} onClick={() => submit(true)}>
                <CircleCheck size={18} /> {L('Berhasil checkout', 'Checked out')}
              </button>
              <button type="button" className="gx-btn gx-btn--lg" disabled={busy} onClick={() => submit(false, 'missed')}>
                <CircleX size={18} /> {L('Tidak dapat', 'Missed it')}
              </button>
            </div>
            {(state.backups?.length ?? 0) > 0 && (
              <div className="gx-fire__backups">
                <div className="gx-eyebrow">{L('Produk utama habis? Buka cadangan:', 'Main product sold out? Open a backup:')}</div>
                <div className="gx-fire__backuplist">
                  {state.backups!.map((bk) => (
                    <button key={bk.id} type="button" className="gx-btn gx-btn--sm" onClick={() => onOpen(bk.href)}>
                      <ShoppingBag size={14} />
                      <span className="gx-fire__bkname">{bk.title}</span>
                      {bk.price > 0 && <b>{formatAseanCurrency(bk.price, bk.region)}</b>}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button type="button" className="gx-fire__skip" onClick={() => onOpen(state.href)}>
              {L('Buka Shopee lagi', 'Open Shopee again')}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
