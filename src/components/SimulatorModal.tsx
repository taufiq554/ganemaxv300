import React, { useState, useEffect, useRef } from 'react';
import { AseanCountryCode } from '../types/index.ts';
import { ASEAN_REGIONS } from '../constants/asean.ts';

interface SimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRegion?: AseanCountryCode;
}

interface SimItem {
  id: string;
  name: string;
  originalPrice: string;
  flashPrice: string;
  image: string;
  store: string;
}

const SIM_ITEMS: SimItem[] = [
  {
    id: 'sim_iphone',
    name: 'Apple iPhone 15 Pro Max 256GB Natural Titanium',
    originalPrice: 'Rp 22.999.000',
    flashPrice: 'Rp 1.000',
    image: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=300&auto=format&fit=crop&q=80',
    store: 'iBox Official Shop Shopee Mall',
  },
  {
    id: 'sim_antam',
    name: 'Logam Mulia Emas Antam 5 Gram CertiCard Press Asli',
    originalPrice: 'Rp 6.850.000',
    flashPrice: 'Rp 1.000',
    image: 'https://images.unsplash.com/photo-1610375461246-83df859d849d?w=300&auto=format&fit=crop&q=80',
    store: 'Butik Emas Antam Official Mall',
  },
  {
    id: 'sim_ps5',
    name: 'Sony PlayStation 5 Slim Disc Edition 1TB Console',
    originalPrice: 'Rp 8.999.000',
    flashPrice: 'Rp 1.000',
    image: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=300&auto=format&fit=crop&q=80',
    store: 'Sony Authorized Store Shopee Mall',
  },
  {
    id: 'sim_motor',
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
}) => {
  const [selectedItem, setSelectedItem] = useState<SimItem>(SIM_ITEMS[0]);
  const [preFireJitter, setPreFireJitter] = useState<number>(-15);
  const [threadCount, setThreadCount] = useState<number>(8);
  const [isSimulating, setIsSimulating] = useState(false);
  const [stepLogs, setStepLogs] = useState<string[]>([]);
  const [executionTimeMs, setExecutionTimeMs] = useState<number | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [orderId, setOrderId] = useState<string>('');

  // Clock ticker
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
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880.0, ctx.currentTime + 0.08); // A5
      osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.16); // D6
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch (_) {}
  };

  const handleStartSimulation = () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setIsFinished(false);
    setExecutionTimeMs(null);
    setStepLogs([]);

    const newOrderId = `241001${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    setOrderId(newOrderId);

    const steps = [
      { text: `[23:59:59.985] [NTP_SYNC] Sinkronisasi Shopee Atomic NTP (Latency: 1.2ms, Drift: -0.04ms)`, delay: 100 },
      { text: `[23:59:59.992] [SOCKET_POOL] Membuka ${threadCount} Multi-Socket HTTP/2 TCP Pool (Handshake pre-warmed)`, delay: 250 },
      { text: `[23:59:59.996] [ANTI_BOT] Menyiapkan token CAPTCHA pre-solve & bypass anti-bot WAF`, delay: 400 },
      { text: `[00:00:00.000] [FLASH_SALE_OPEN] FLASH SALE DIMULAI! Triggering Atomic Pre-fire (${preFireJitter}ms jitter)`, delay: 650 },
      { text: `[00:00:00.005] [ORDER_DISPATCH] Mengirim payload order: SKU #${selectedItem.id} (Diskon voucher 99.99%)`, delay: 850 },
      { text: `[00:00:00.008] [PIN_AUTO_AUTH] Inject PIN ShopeePay otomatis (0.002s instant auth)`, delay: 1050 },
      { text: `[00:00:00.011] [HTTP_200_OK] Transaksi Sukses! Order Confirmed: ID #${newOrderId}`, delay: 1250 },
    ];

    steps.forEach(({ text, delay }, index) => {
      setTimeout(() => {
        setStepLogs((prev) => [...prev, text]);
        if (index === steps.length - 1) {
          setIsSimulating(false);
          setIsFinished(true);
          setExecutionTimeMs(11);
          playSuccessChime();
        }
      }, delay);
    });
  };

  return (
    <div className="modal active">
      <div className="modal-content" style={{ maxWidth: '780px' }}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-bolt text-amber-500"></i>
            <span>Simulasi Checkout Sniping Live (Tes Kecepatan Bot)</span>
          </div>
          <button className="close-btn" onClick={onClose} disabled={isSimulating}>
            &times;
          </button>
        </div>

        <div className="p-4 bg-slate-900 text-white">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-800">
            <div>
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block mb-1">
                <i className="fa-solid fa-clock mr-1"></i> Atomic NTP Clock Shopee Server
              </span>
              <div className="text-3xl sm:text-4xl font-mono font-black text-amber-400">
                {clockString}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[11px] text-slate-400 block font-semibold">Status Engine</span>
                <span className="text-xs font-bold text-emerald-400 inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Multi-Socket Turbo Siap
                </span>
              </div>
              <button
                type="button"
                onClick={handleStartSimulation}
                disabled={isSimulating}
                className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isSimulating ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i> Mengeksekusi...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-play"></i> Mulai Sniping Live
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
                  const it = SIM_ITEMS.find((x) => x.id === e.target.value);
                  if (it) setSelectedItem(it);
                }}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded p-1.5 text-xs font-semibold"
              >
                {SIM_ITEMS.map((item) => (
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
                <option value={8}>8 Sockets Parallel (Rekomendasi)</option>
                <option value={16}>16 Sockets Turbo Aggressive</option>
              </select>
            </div>
          </div>

          {/* Terminal output */}
          <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 font-mono text-xs max-h-48 overflow-y-auto mb-4">
            {stepLogs.length === 0 ? (
              <div className="text-slate-500 py-4 text-center">
                Tekan tombol <strong>"Mulai Sniping Live"</strong> untuk melihat proses sub-milidetik bot secara langsung.
              </div>
            ) : (
              <div className="space-y-1.5">
                {stepLogs.map((log, i) => (
                  <div
                    key={i}
                    className={`${
                      log.includes('HTTP_200_OK')
                        ? 'text-emerald-400 font-bold'
                        : log.includes('FLASH_SALE_OPEN')
                        ? 'text-amber-400 font-bold'
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
                    PESANAN FLASH SALE BERHASIL DITEMBUS!
                  </span>
                </div>
                <span className="font-mono text-xs text-amber-400 font-bold flex items-center gap-1">
                  <i className="fa-solid fa-bolt"></i> Kecepatan: 11 milidetik
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
                  <div>Metode: <strong className="text-emerald-400">ShopeePay Instant</strong></div>
                  <div className="text-emerald-400 font-semibold">Ongkir: Rp 0 (Free Ongkir)</div>
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
            Tutup Simulator
          </button>
          {isFinished && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleStartSimulation}
              style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <i className="fa-solid fa-rotate-right"></i> Tes Ulang Lagi
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
