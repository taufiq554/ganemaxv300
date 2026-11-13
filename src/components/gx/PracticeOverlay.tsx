import React, { useEffect, useRef, useState } from 'react';
import { Hand, RotateCcw, Timer, Gauge, X } from 'lucide-react';
import { ServerClock, useTicker } from '../../lib/useServerClock.ts';
import { useLang } from '../../lib/i18n.tsx';

export interface PracticeState {
  title: string;
  zeroAt: number; // detik 0 sesi (epoch server)
  timerDeltaMs: number | null; // presisi timer engine saat fire
  leadMs: number;
}

export interface PracticeResult {
  reactionMs: number;
  timerDeltaMs: number | null;
}

const Live: React.FC<{ clock: ServerClock; zeroAt: number }> = ({ clock, zeroAt }) => {
  useTicker(33);
  const d = clock.now() - zeroAt;
  const sign = d < 0 ? '−' : '+';
  const a = Math.abs(d);
  return (
    <span className="gx-prac__clock">
      {sign}
      {Math.floor(a / 1000)}.{String(Math.floor(a % 1000)).padStart(3, '0')} s
    </span>
  );
};

/** Mode latihan: bot menjalankan semua tahap sendiri, lalu mengukur kecepatan tap kamu di detik 0. */
export const PracticeOverlay: React.FC<{
  state: PracticeState | null;
  clock: ServerClock;
  onDone: (r: PracticeResult | null) => void;
  onRetry: () => void;
}> = ({ state, clock, onDone, onRetry }) => {
  const { L } = useLang();
  const [result, setResult] = useState<PracticeResult | null>(null);
  const reported = useRef(false);

  useEffect(() => {
    setResult(null);
    reported.current = false;
  }, [state]);

  if (!state) return null;

  const tap = () => {
    if (result) return;
    const r = { reactionMs: Math.round(clock.now() - state.zeroAt), timerDeltaMs: state.timerDeltaMs };
    setResult(r);
    if (!reported.current) {
      reported.current = true;
      onDone(r);
    }
  };

  const grade = (ms: number) =>
    ms < 0
      ? { t: L('Terlalu cepat — tombol Beli belum aktif', 'Too early — Buy button not active yet'), c: 'var(--gx-bad)' }
      : ms <= 350 ? { t: L('Sangat cepat', 'Very fast'), c: 'var(--gx-ok)' } : ms <= 700 ? { t: L('Cepat', 'Fast'), c: 'var(--gx-brand)' } : ms <= 1200 ? { t: L('Cukup', 'Okay'), c: 'var(--gx-warn)' } : { t: L('Perlu latihan', 'Keep practising'), c: 'var(--gx-bad)' };

  return (
    <div className="gx-overlay gx-overlay--center gx-fire" role="dialog" aria-modal="true" aria-label={L('Latihan detik 0', 'Second-zero practice')}>
      <div className="gx-fire__card">
        <div className="gx-fire__top">
          <span className="gx-fire__badge">
            <Timer size={13} /> {L('Latihan', 'Practice')}
          </span>
          {!result && <Live clock={clock} zeroAt={state.zeroAt} />}
          <button type="button" className="gx-iconbtn" style={{ width: 32, height: 32 }} onClick={() => onDone(null)} aria-label={L('Tutup', 'Close')}>
            <X size={15} />
          </button>
        </div>
        <div className="gx-fire__title" style={{ textAlign: 'center' }}>{state.title}</div>

        {!result ? (
          <>
            <button type="button" className="gx-fire__go" onClick={tap} autoFocus>
              <Hand size={22} /> {L('TAP sekarang!', 'TAP now!')}
            </button>
            <p className="gx-fire__hint">{L('Anggap ini tombol "Beli Sekarang". Tap secepat mungkin.', 'Treat this as the "Buy Now" button. Tap as fast as you can.')}</p>
          </>
        ) : (
          <>
            <div className="gx-prac__result">
              <div>
                <span>{L('Waktu reaksi kamu', 'Your reaction time')}</span>
                <b style={{ color: grade(result.reactionMs).c }}>{result.reactionMs} ms</b>
                <small style={{ color: grade(result.reactionMs).c }}>{grade(result.reactionMs).t}</small>
              </div>
              <div>
                <span>{L('Presisi timer bot', 'Bot timer precision')}</span>
                <b>{result.timerDeltaMs == null ? '—' : `${result.timerDeltaMs >= 0 ? '+' : ''}${result.timerDeltaMs} ms`}</b>
                <small>{L(`Pre-fire ${state.leadMs} ms`, `Pre-fire ${state.leadMs} ms`)}</small>
              </div>
            </div>
            <div className="gx-note">
              <Gauge size={15} />
              <span>
                {L(
                  'Kalau reaksi kamu sering di atas 700 ms, naikkan pre-fire di tab Engine supaya halaman Shopee sudah terbuka lebih awal.',
                  'If your reaction is often above 700 ms, raise pre-fire in the Engine tab so Shopee opens earlier.'
                )}
              </span>
            </div>
            <div className="gx-fire__actions">
              <button type="button" className="gx-btn gx-btn--lg gx-btn--primary" onClick={onRetry}>
                <RotateCcw size={17} /> {L('Ulangi', 'Try again')}
              </button>
              <button type="button" className="gx-btn gx-btn--lg" onClick={() => onDone(null)}>
                {L('Selesai', 'Done')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
