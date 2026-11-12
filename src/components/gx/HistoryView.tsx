import React, { useMemo, useState } from 'react';
import { Activity, Receipt, Search } from 'lucide-react';
import { AseanCountryCode, BotLogItem, BotStats } from '../../types/index.ts';
import { ServerClock } from '../../lib/useServerClock.ts';
import { LatencyState, LiveConsole, NormalizedOrder, OrdersList } from './DashboardView.tsx';

export const HistoryView: React.FC<{
  orders: NormalizedOrder[];
  stats: BotStats;
  latency: LatencyState;
  clock: ServerClock;
  region: AseanCountryCode;
  logs: BotLogItem[];
  onClearLogs: () => void;
  onCopied: (m: string) => void;
}> = ({ orders, stats, latency, clock, region, logs, onClearLogs, onCopied }) => {
  const [q, setQ] = useState('');
  const filtered = useMemo(
    () => orders.filter((o) => !q || o.name.toLowerCase().includes(q.toLowerCase()) || o.sn.toLowerCase().includes(q.toLowerCase())),
    [orders, q]
  );
  const speeds = orders.map((o) => o.speed).filter((v): v is number => typeof v === 'number');
  const best = speeds.length ? Math.min(...speeds) : null;
  const avg = speeds.length ? Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length) : null;
  const lat = latency.history;
  const max = Math.max(1, ...lat);

  return (
    <>
      <div className="gx-pagehead">
        <div>
          <h1>Riwayat & aktivitas</h1>
          <p>Checkout yang tercatat di akunmu dan performa koneksi engine.</p>
        </div>
      </div>

      <div className="gx-kpis">
        <div className="gx-card gx-kpi">
          <div className="gx-kpi__k">Total checkout</div>
          <div className="gx-kpi__v">{orders.length}</div>
        </div>
        <div className="gx-card gx-kpi">
          <div className="gx-kpi__k">Respons tercepat</div>
          <div className="gx-kpi__v">{best != null ? `${best} ms` : '—'}</div>
        </div>
        <div className="gx-card gx-kpi">
          <div className="gx-kpi__k">Rata-rata respons</div>
          <div className="gx-kpi__v">{avg != null ? `${avg} ms` : '—'}</div>
        </div>
        <div className="gx-card gx-kpi">
          <div className="gx-kpi__k">Sesi ini</div>
          <div className="gx-kpi__v">{stats.success}/{stats.attempts}</div>
          <div className="gx-kpi__d">sukses / request</div>
        </div>
      </div>

      <div className="gx-grid gx-grid--dash">
        <section className="gx-card">
          <div className="gx-card__head">
            <h2 className="gx-card__title">
              <Receipt size={16} /> Semua checkout
            </h2>
          </div>
          <div className="gx-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 11, top: 12, color: 'var(--gx-ink-3)' }} />
              <input className="gx-input" style={{ paddingLeft: 34 }} placeholder="Cari produk / nomor order…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <OrdersList orders={filtered} region={region} />
          </div>
        </section>

        <section className="gx-card">
          <div className="gx-card__head">
            <h2 className="gx-card__title">
              <Activity size={16} /> Latensi gateway
            </h2>
            <div className="gx-card__aside gx-muted" style={{ fontSize: 11.5 }}>
              {lat.length} sampel
            </div>
          </div>
          <div className="gx-card__body">
            {lat.length < 2 ? (
              <div className="gx-empty">Data latensi terkumpul otomatis selama dashboard terbuka.</div>
            ) : (
              <div className="gx-bars" style={{ height: 150, gap: 3 }}>
                {lat.map((v, i) => (
                  <div key={i} className="gx-bar" style={{ cursor: 'default' }} title={`${v} ms`}>
                    <div className="gx-bar__col">
                      <div className="gx-bar__fill" style={{ height: `${(v / max) * 100}%`, background: 'var(--gx-brand)', opacity: 0.35 + (i / lat.length) * 0.65 }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="gx-metrics" style={{ marginTop: 12 }}>
              <div className="gx-metric">
                <div className="gx-metric__k">Ping server bot</div>
                <div className="gx-metric__v">
                  {clock.rttMs ?? '—'}
                  <small>ms</small>
                </div>
              </div>
              <div className="gx-metric">
                <div className="gx-metric__k">Selisih jam HP</div>
                <div className="gx-metric__v">
                  {clock.offsetMs}
                  <small>ms</small>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <LiveConsole logs={logs} onClear={onClearLogs} onCopied={onCopied} />
    </>
  );
};
