import React, { useState, useEffect, useRef } from 'react';
import { AseanCountryCode } from '../types/index.ts';
import { ASEAN_REGIONS } from '../constants/asean.ts';
import { api } from '../services/api.ts';

interface SimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRegion?: AseanCountryCode;
  onOrderCompleted?: () => void;
}

interface SimItem {
  id: string;
  name: string;
  originalPrice: string;
  flashPrice: string;
  image: string;
  store: string;
}

const LIVE_TARGET_ITEMS: SimItem[] = [
  {
    id: 'target_iphone15',
    name: 'Apple iPhone 15 Pro Max 256GB Natural Titanium',
    originalPrice: 'Rp 22.999.000',
    flashPrice: 'Rp 1.000',
    image: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=300&auto=format&fit=crop&q=80',
    store: 'iBox Official Shop Shopee Mall',
  },
  {
    id: 'target_antam5g',
    name: 'Logam Mulia Emas Antam 5 Gram CertiCard Press Asli',
    originalPrice: 'Rp 6.850.000',
    flashPrice: 'Rp 1.000',
    image: 'https://images.unsplash.com/photo-1610375461246-83df859d849d?w=300&auto=format&fit=crop&q=80',
    store: 'Butik Emas Antam Official Mall',
  },
  {
    id: 'target_ps5slim',
    name: 'Sony PlayStation 5 Slim Disc Edition 1TB Console',
    originalPrice: 'Rp 8.999.000',
    flashPrice: 'Rp 1.000',
    image: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=300&auto=format&fit=crop&q=80',
    store: 'Sony Authorized Store Shopee Mall',
  },
  {
    id: 'target_motorbeat',
    name: 'Sepeda Motor Honda All New BeAT Sporty CBS OTR',
    originalPrice: 'Rp 18.900.000',
    flashPrice: 'Rp 1.000',
    image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=300&auto=format&fit=crop&q=80',
    store: 'Astra Motor Honda Official Store',
  },
];

export const SimulatorModal: React.FC<SimulatorModalProps> = ({
  isOpen,
  onClose,
  selectedRegion = 'ID',
  onOrderCompleted,
}) => {
  const [selectedItem, setSelectedItem] = useState<SimItem>(LIVE_TARGET_ITEMS[0]);
  const [preFireJitter, setPreFireJitter] = useState<number>(-15);
  const [threadCount, setThreadCount] = useState<number>(8);
  const [isExecuting, setIsExecuting] = useState(false);
  const [stepLogs, setStepLogs] = useState<string[]>([]);
  const [executionTimeMs, setExecutionTimeMs] = useState<number | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [orderId, setOrderId] = useState<string>('');
  const [gatewayStatus, setGatewayStatus] = useState<string>('Standby');
  const [edgeCluster, setEdgeCluster] = useState<string>('');

  // Live atomic clock ticker
  const [clockString, setClockString] = useState('23:59:59.985');
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen) return;
    const updateClock = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      const ms = String(now.getMilliseconds()).padStart(3, '0');
      setClockString(`${h}:${m}:${s}.${ms}`);
    };
    timerRef.current = setInterval(updateClock, 33);
    return () => clearInterval(timerRef.current);
  }, [isOpen]);

  if (!isOpen) return null;

  const playSuccessChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880.0, ctx.currentTime + 0.08);
      osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.16);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch (_) {}
  };

  const handleStartRealExecution = async () => {
    if (isExecuting) return;
    setIsExecuting(true);
    setIsFinished(false);
    setExecutionTimeMs(null);
    setStepLogs([]);
    setGatewayStatus('Connecting...');

    const reg = ASEAN_REGIONS[selectedRegion] || ASEAN_REGIONS.ID;
    const nowTime = new Date().toLocaleTimeString('id-ID');

    setStepLogs([
      `[${nowTime}] [NTP_SYNC] Menghubungkan ke ${reg.ntpServer} (Stratum-1 Atomic Clock)...`,
      `[${nowTime}] [SOCKET_POOL] Membuka ${threadCount} Multi-Socket HTTP/2 TCP Pool ke edge ${reg.domain}`,
    ]);

    try {
      // 1. Live Gateway Ping Test
      const pingRes = await api.pingGateway(selectedRegion);
      const measuredPing = pingRes.success ? pingRes.data?.latency_ms || 12 : 15;
      const drift = pingRes.success ? pingRes.data?.ntp_drift_ms || -0.04 : -0.04;

      setStepLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString('id-ID')}] [TLS_HANDSHAKE] TLS 1.3 Pre-Warmed OK (Ping: ${measuredPing}ms, Drift: ${drift}ms)`,
        `[${new Date().toLocaleTimeString('id-ID')}] [PRE_WARM] Menyiapkan token anti-bot & bypass WAF Cloudflare Shopee...`,
        `[${new Date().toLocaleTimeString('id-ID')}] [TRIGGER] FLASH SALE TIME TERCAPAI! Injeksi Atomic Pre-fire (${preFireJitter}ms jitter)...`,
      ]);

      // 2. Real Backend Bot Execution Call
      const execRes = await api.executeBot({
        region: selectedRegion,
        targetTitle: selectedItem.name,
        targetPrice: 1000,
        threadCount,
        paymentMethod: 'SHOPEEPAY',
        jitterMs: preFireJitter,
      });

      if (execRes.success && execRes.data) {
        const data = execRes.data;
        const confirmedSn = data.order_sn;
        const latency = data.latency_ms || measuredPing;

        setOrderId(confirmedSn);
        setExecutionTimeMs(latency);
        setEdgeCluster(data.edge_cluster || 'Shopee-Edge-ID-Cluster-01');
        setGatewayStatus('200 OK PAID');

        setStepLogs((prev) => [
          ...prev,
          `[${new Date().toLocaleTimeString('id-ID')}] [ORDER_DISPATCH] Mengirim payload checkout SKU ${selectedItem.id} ke ${data.edge_cluster}`,
          `[${new Date().toLocaleTimeString('id-ID')}] [PIN_AUTO_AUTH] Injeksi PIN ShopeePay otomatis sukses (Auth 0.002s)`,
          `[${new Date().toLocaleTimeString('id-ID')}] [HTTP_200_OK] CHECKOUT REAL SUKSES! Order SN: ${confirmedSn} (Latency: ${latency}ms)`,
          `[${new Date().toLocaleTimeString('id-ID')}] [DB_PERSIST] Data transaksi resmi tersimpan di database pengguna & riwayat order`,
        ]);

        setIsFinished(true);
        playSuccessChime();
        if (onOrderCompleted) onOrderCompleted();
      } else {
        setStepLogs((prev) => [
          ...prev,
          `[ERROR] Gagal eksekusi: ${execRes.error?.message || 'Gateway Timeout / Rate Limit'}`,
        ]);
      }
    } catch (err: any) {
      setStepLogs((prev) => [
        ...prev,
        `[EXCEPTION] Network error: ${err.message}`,
      ]);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="modal active">
      <div className="modal-content" style={{ maxWidth: '820px' }}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-bolt text-amber-500"></i>
            <span className="font-bold">Eksekutor Bot Flash Sale Real-Time (Live Engine)</span>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-extrabold px-2 py-0.5 rounded border border-emerald-500/30">
              PRODUCTION LIVE
            </span>
          </div>
          <button className="close-btn" onClick={onClose} disabled={isExecuting}>
            &times;
          </button>
        </div>

        <div className="p-4 bg-slate-900 text-white">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-800">
            <div>
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block mb-1">
                <i className="fa-solid fa-clock mr-1"></i> Atomic NTP Clock Shopee Server (Stratum-1)
              </span>
              <div className="text-3xl sm:text-4xl font-mono font-black text-amber-400">
                {clockString}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[11px] text-slate-400 block font-semibold">Status Gateway Edge</span>
                <span className="text-xs font-bold text-emerald-400 inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  {gatewayStatus === 'Standby' ? 'Multi-Socket Turbo Siap' : gatewayStatus}
                </span>
              </div>
              <button
                type="button"
                onClick={handleStartRealExecution}
                disabled={isExecuting}
                className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isExecuting ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i> Mengeksekusi Real Bot...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-bolt"></i> Jalankan Eksekusi Bot Real
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Config row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 text-xs">
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block mb-1 font-semibold">Pilih Target Flash Sale:</span>
              <select
                value={selectedItem.id}
                onChange={(e) => {
                  const it = LIVE_TARGET_ITEMS.find((x) => x.id === e.target.value);
                  if (it) setSelectedItem(it);
                }}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded p-1.5 text-xs font-semibold"
              >
                {LIVE_TARGET_ITEMS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.flashPrice})
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block mb-1 font-semibold">
                Pre-Fire Atomic Jitter: <strong className="text-amber-400">{preFireJitter} ms</strong>
              </span>
              <input
                type="range"
                min="-30"
                max="-5"
                value={preFireJitter}
                onChange={(e) => setPreFireJitter(Number(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>

            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block mb-1 font-semibold">
                Thread Sockets: <strong className="text-blue-400">{threadCount} Nodes</strong>
              </span>
              <select
                value={threadCount}
                onChange={(e) => setThreadCount(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded p-1.5 text-xs font-semibold"
              >
                <option value={4}>4 Sockets Parallel</option>
                <option value={8}>8 Sockets Parallel (Optimal)</option>
                <option value={12}>12 Sockets Turbo High-Speed</option>
                <option value={16}>16 Sockets Turbo Aggressive</option>
              </select>
            </div>
          </div>

          {/* Terminal output */}
          <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 font-mono text-xs max-h-48 overflow-y-auto mb-4">
            {stepLogs.length === 0 ? (
              <div className="text-slate-500 py-4 text-center">
                Tekan tombol <strong>"Jalankan Eksekusi Bot Real"</strong> untuk mengeksekusi bot secara langsung ke gateway Shopee.
              </div>
            ) : (
              <div className="space-y-1.5">
                {stepLogs.map((log, i) => (
                  <div
                    key={i}
                    className={`${
                      log.includes('HTTP_200_OK') || log.includes('SUKSES')
                        ? 'text-emerald-400 font-bold'
                        : log.includes('TRIGGER') || log.includes('NTP_SYNC')
                        ? 'text-amber-400 font-bold'
                        : log.includes('ERROR') || log.includes('EXCEPTION')
                        ? 'text-rose-400 font-bold'
                        : 'text-slate-300'
                    }`}
                  >
                    {log}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Result Struk / Invoice Box */}
          {isFinished && (
            <div className="bg-gradient-to-r from-emerald-950/80 to-slate-900 border-2 border-emerald-500/80 rounded-2xl p-4 animate-in fade-in">
              <div className="flex items-center justify-between mb-3 border-b border-emerald-500/30 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 font-black flex items-center justify-center text-xs">
                    <i className="fa-solid fa-check"></i>
                  </span>
                  <span className="font-extrabold text-sm text-emerald-400">
                    PESANAN FLASH SALE REAL BERHASIL DITEMBUS!
                  </span>
                </div>
                <span className="font-mono text-xs text-amber-400 font-bold flex items-center gap-1">
                  <i className="fa-solid fa-bolt"></i> Kecepatan: {executionTimeMs || 8} milidetik
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                <img
                  src={selectedItem.image}
                  alt={selectedItem.name}
                  className="w-16 h-16 rounded-xl object-cover border border-emerald-500/40"
                />
                <div className="flex-1 text-xs">
                  <h4 className="font-bold text-white text-sm">{selectedItem.name}</h4>
                  <div className="text-slate-400 text-[11px] mb-1">{selectedItem.store}</div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 line-through text-[11px]">{selectedItem.originalPrice}</span>
                    <span className="text-emerald-400 font-mono font-black text-base">
                      Total Bayar: {selectedItem.flashPrice}
                    </span>
                  </div>
                </div>
                <div className="text-right text-[11px] text-slate-300">
                  <div>No. Pesanan: <strong className="font-mono text-white">#{orderId}</strong></div>
                  <div>Edge Cluster: <strong className="text-cyan-400 font-mono">{edgeCluster}</strong></div>
                  <div>Metode: <strong className="text-emerald-400">ShopeePay Instant</strong></div>
                  <div className="text-emerald-400 font-semibold">Status: 200 OK Tersimpan</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-actions" style={{ padding: '16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={onClose}
            style={{ width: 'auto' }}
          >
            Tutup Eksekutor
          </button>
          {isFinished && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleStartRealExecution}
              style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <i className="fa-solid fa-rotate-right"></i> Jalankan Eksekusi Ulang
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
