import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  User,
  ShopeeAccount,
  Address,
  TargetUrl,
  ProxyMesh,
  Schedule,
  ShopeePayment,
  OrderHistoryItem,
  BotLogItem,
  BotStats,
  BotSettings,
  AseanCountryCode,
  Announcement,
  AppTab,
  EnginePhase,
} from './types/index.ts';
import { ASEAN_REGIONS, formatAseanCurrency } from './constants/asean.ts';
import { api } from './services/api.ts';
import { LoginScreen } from './components/LoginScreen.tsx';
import { PaymentGatewayModal } from './components/PaymentGatewayModal.tsx';
import { WhatsappChannelModal } from './components/WhatsappChannelModal.tsx';
import { ControlPanel } from './components/ControlPanel.tsx';
import {
  AddressModal,
  AccountModal,
  TargetUrlModal,
  ProxyModal,
  ScheduleModal,
} from './components/CrudModals.tsx';
import { BulkAccountModal } from './components/BulkAccountModal.tsx';
import { useServerClock, SyncResult } from './lib/useServerClock.ts';
import { getNextSession, formatClock } from './lib/time.ts';
import { parseShopeeLink, buildOpenUrl, isValidHttpUrl } from './lib/shopee.ts';
import { FireOverlay, FireState } from './components/gx/FireOverlay.tsx';
import {
  TopBar,
  Dock,
  AnnouncementDrawer,
  isAnnouncementLive,
  sortAnnouncements,
  useToast,
} from './components/gx/Shell.tsx';
import {
  DashboardView,
  LatencyState,
  ArmState,
  normalizeOrder,
} from './components/gx/DashboardView.tsx';
import { HistoryView } from './components/gx/HistoryView.tsx';
import { AdminPanel } from './components/gx/AdminPanel.tsx';

const DISMISSED_KEY = 'gx_dismissed_announcements';
const readDismissed = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

export const App: React.FC = () => {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('shopee_bot_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isLoginLoading, setIsLoginLoading] = useState(false);

  // Theme & Audio State
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(() => {
    return localStorage.getItem('shopee_bot_theme') === 'dark';
  });
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Data Collections State
  const [accounts, setAccounts] = useState<ShopeeAccount[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [targetUrls, setTargetUrls] = useState<TargetUrl[]>([]);
  const [proxies, setProxies] = useState<ProxyMesh[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<ShopeePayment | null>(null);
  const [orderHistory, setOrderHistory] = useState<OrderHistoryItem[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>(readDismissed);
  const [isAnnDrawerOpen, setIsAnnDrawerOpen] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState<string>(() => {
    try {
      return localStorage.getItem('gx_selected_target') || '';
    } catch {
      return '';
    }
  });
  const [enginePhase, setEnginePhase] = useState<EnginePhase>('idle');
  const [armed, setArmed] = useState<ArmState | null>(null);
  const [latency, setLatency] = useState<LatencyState>({ history: [], last: null, status: null, reachable: null, checkedAt: null });
  const [notifState, setNotifState] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );
  const clockLogRef = useRef<((r: SyncResult, manual: boolean) => void) | null>(null);
  const clock = useServerClock(60_000, (r, m) => clockLogRef.current?.(r, m));
  const toast = useToast();
  const isRunningRef = useRef(false);

  // ASEAN Cross-Border State
  const [selectedRegion, setSelectedRegion] = useState<AseanCountryCode>(() => {
    const saved = localStorage.getItem('ganemax_asean_region');
    return (saved as AseanCountryCode) || 'ID';
  });

  const handleSelectRegion = (region: AseanCountryCode) => {
    setSelectedRegion(region);
    localStorage.setItem('ganemax_asean_region', region);
    const reg = ASEAN_REGIONS[region];
    if (reg) {
      addLog(`🌏 Switch Wilayah Shopee ASEAN: [${reg.code}] ${reg.name} (${reg.domain}). Mata Uang: ${reg.currency} (${reg.currencySymbol}) • Timezone: ${reg.timezoneLabel} • NTP: ${reg.ntpServer}`, 'info');
    }
  };

  const handleDeployAseanProxies = async (region: AseanCountryCode) => {
    const reg = ASEAN_REGIONS[region];
    if (!reg) return;
    addLog(`🚀 Memasang preset Residential Proxy Mesh Shopee ${reg.name} [${reg.code}] (${reg.domain})...`, 'info');
    for (const preset of reg.proxyPreset) {
      await handleSaveProxy({
        host: preset.host,
        port: preset.port,
        region: reg.code,
        status: 'active',
        latency_ms: 12,
      });
    }
    addLog(`✅ Berhasil menambahkan node proxy residential Shopee ${reg.name} ke Cloud Network!`, 'success');
  };

  // Bot Status & Stats State
  const [isBotRunning, setIsBotRunning] = useState(false);
  const [serverLatency, setServerLatency] = useState(12);
  const [stats, setStats] = useState<BotStats>({
    attempts: 0,
    success: 0,
    speed_ms: 12,
    saved_amount: 0,
  });
  const [logs, setLogs] = useState<BotLogItem[]>([
    {
      id: 'init_log',
      time: `${new Date().toLocaleTimeString('id-ID', { hour12: false })}.${String(new Date().getMilliseconds()).padStart(3, '0')}`,
      text: '[SYSTEM] Dashboard GaneMaX.Ai siap. Monitor gateway & jam server berjalan.',
      type: 'info',
    },
  ]);

  // Bot Settings
  const [botSettings, setBotSettings] = useState<BotSettings>(() => {
    const base: BotSettings = {
    botMode: 'turbo',
    threadCount: 8,
    pollRate: 80,
    smartFallback: 'spaylater',
    preFireJitter: -15,
    multiAccMode: 'single',
    userAgentPreset: 'android_app_v2',
    capSolverApiKey: '',
    executionMode: 'aggressive',
    maxRetry: 5,
    retryDelay: 50,
    whitelist: '',
    blacklist: '',
    notifySuccess: true,
    notifyError: true,
    notifyRateLimit: true,
    openLeadMs: 800,
    openMode: "app",
    soundAlert: true,
    vibrateAlert: true,
  };
    try {
      const saved = JSON.parse(localStorage.getItem('gx_bot_settings') || 'null');
      return saved && typeof saved === 'object' ? { ...base, ...saved } : base;
    } catch {
      return base;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('gx_bot_settings', JSON.stringify(botSettings));
    } catch {}
  }, [botSettings]);

  // Modal Visibility States
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isWaModalOpen, setIsWaModalOpen] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  // CRUD Active Item States
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [activeAddress, setActiveAddress] = useState<Address | null>(null);

  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [activeAccount, setActiveAccount] = useState<ShopeeAccount | null>(null);

  const [targetUrlModalOpen, setTargetUrlModalOpen] = useState(false);
  const [activeTargetUrl, setActiveTargetUrl] = useState<TargetUrl | null>(null);

  const [proxyModalOpen, setProxyModalOpen] = useState(false);
  const [activeProxy, setActiveProxy] = useState<ProxyMesh | null>(null);

  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [activeSchedule, setActiveSchedule] = useState<Schedule | null>(null);

  const [bulkAccountModalOpen, setBulkAccountModalOpen] = useState(false);

  const botIntervalRef = useRef<any>(null);
  const botTimeoutsRef = useRef<number[]>([]);

  // Apply Dark Theme class to body
  useEffect(() => {
    if (isDarkTheme) {
      document.body.classList.add('dark-theme');
      localStorage.setItem('shopee_bot_theme', 'dark');
    } else {
      document.body.classList.remove('dark-theme');
      localStorage.setItem('shopee_bot_theme', 'light');
    }
  }, [isDarkTheme]);

  const addLog = useCallback(
    (text: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
      setLogs((prev) => [
        ...prev.slice(-400),
        {
          id: Math.random().toString(36).substring(2, 9),
          time: (() => {
            const d = new Date();
            return `${d.toLocaleTimeString('id-ID', { hour12: false })}.${String(d.getMilliseconds()).padStart(3, '0')}`;
          })(),
          text,
          type,
        },
      ]);
    },
    []
  );

  // Fetch all user collections when authenticated
  const loadAnnouncements = useCallback(async () => {
    const res = await api.get<Announcement[]>('announcements');
    if (res.success && Array.isArray(res.data)) setAnnouncements(res.data);
  }, []);

  const loadUserData = useCallback(async () => {
    if (!currentUser) return;

    try {
      const [accRes, addrRes, urlRes, prxRes, schRes, payRes, ordRes, meRes] = await Promise.all([
        api.get<ShopeeAccount[]>('shopee-accounts'),
        api.get<Address[]>('addresses'),
        api.get<TargetUrl[]>('target-urls'),
        api.get<ProxyMesh[]>('proxies'),
        api.get<Schedule[]>('schedules'),
        api.get<ShopeePayment>('shopee-payments', { single: true }),
        // Ambil semua order milik user lalu urutkan di client (query orderBy+where butuh index Firestore)
        api.get<OrderHistoryItem[]>('order-history'),
        api.get<User>(`users/${currentUser.id}`),
      ]);

      if (accRes.success && accRes.data) setAccounts(accRes.data);
      if (addrRes.success && addrRes.data) setAddresses(addrRes.data);
      if (urlRes.success && urlRes.data) setTargetUrls(urlRes.data);
      if (prxRes.success && prxRes.data) setProxies(prxRes.data);
      if (schRes.success && schRes.data) setSchedules(schRes.data);
      if (payRes.success) setPaymentSettings(payRes.data || null);
      if (ordRes.success && Array.isArray(ordRes.data)) setOrderHistory(ordRes.data);

      // Sinkronkan data lisensi terbaru (masa aktif / status) dari server
      if (meRes.success && meRes.data && meRes.data.id === currentUser.id) {
        const fresh = meRes.data;
        if (JSON.stringify(fresh) !== JSON.stringify(currentUser)) {
          localStorage.setItem('shopee_bot_user', JSON.stringify(fresh));
          setCurrentUser(fresh);
        }
      } else if (!meRes.success && /sesi|login|autentikasi/i.test(meRes.error?.message || '')) {
        // token kadaluarsa -> paksa login ulang
        localStorage.removeItem('shopee_bot_token');
        localStorage.removeItem('shopee_bot_user');
        setCurrentUser(null);
        return;
      }

      if (currentUser.role === 'admin') {
        const usersRes = await api.get<User[]>('users');
        if (usersRes.success && usersRes.data) setUsersList(usersRes.data);
      }
    } catch (err: any) {
      console.warn('Error fetching initial user data:', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, currentUser?.role]);

  useEffect(() => {
    if (currentUser) {
      loadUserData();
      loadAnnouncements();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, loadUserData, loadAnnouncements]);

  // Refresh pengumuman berkala (tiap 2 menit) supaya update admin cepat sampai ke user
  useEffect(() => {
    if (!currentUser) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') loadAnnouncements();
    }, 120_000);
    return () => window.clearInterval(id);
  }, [currentUser, loadAnnouncements]);

  // Audio Playback Handler (/lagu.mp3)
  const handleToggleMusic = () => {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('/lagu.mp3');
        audioRef.current.loop = true;
        audioRef.current.onerror = () => {
          console.warn('Playback error on /lagu.mp3, trying /audio.mp3');
          if (audioRef.current) {
            audioRef.current.src = '/audio.mp3';
            audioRef.current.play().catch(() => {});
          }
        };
      }
      if (isPlayingMusic) {
        audioRef.current.pause();
        setIsPlayingMusic(false);
        addLog('🎵 Musik latar (lagu.mp3) dihentikan.', 'info');
      } else {
        audioRef.current
          .play()
          .then(() => {
            setIsPlayingMusic(true);
            addLog('🎵 Memutar musik latar (lagu.mp3) sukses.', 'info');
          })
          .catch((e) => {
            console.log('Audio autoplay prevented:', e);
            setIsPlayingMusic(false);
          });
      }
    } catch (err) {
      console.error('Audio toggle error:', err);
    }
  };

  // Auth Operations
  const handleLogin = async (u: string, p: string): Promise<boolean> => {
    setIsLoginLoading(true);
    try {
      const res = await api.login(u, p);
      if (res.success && res.data) {
        localStorage.setItem('shopee_bot_token', res.data.token);
        localStorage.setItem('shopee_bot_user', JSON.stringify(res.data.user));
        setCurrentUser(res.data.user);
        addLog(`Selamat datang, ${res.data.user.username}! Sesi bot aktif.`, 'success');
        setIsLoginLoading(false);
        return true;
      }
    } catch (err: any) {
      addLog(`Login gagal: ${err.message}`, 'error');
    }
    setIsLoginLoading(false);
    return false;
  };

  const handleLogout = () => {
    localStorage.removeItem('shopee_bot_token');
    localStorage.removeItem('shopee_bot_user');
    setCurrentUser(null);
    clearBotTimers();
    finishRun('idle');
    setArmed(null);
    setUsersList([]);
    setCurrentTab('dashboard');
    addLog('Sesi Anda telah keluar.', 'info');
  };

  // Target aktif (dipilih user, fallback ke target wilayah aktif / pertama)
  const selectedTarget = useMemo<TargetUrl | null>(() => {
    return (
      targetUrls.find((t) => t.id === selectedTargetId) ||
      targetUrls.find((t) => !t.region || t.region === selectedRegion) ||
      targetUrls[0] ||
      null
    );
  }, [targetUrls, selectedTargetId, selectedRegion]);

  const handleSelectTarget = (id: string) => {
    setSelectedTargetId(id);
    try {
      localStorage.setItem('gx_selected_target', id);
    } catch {}
  };

  const licenseThreadCap = currentUser?.role === 'admin' ? 24 : currentUser?.max_threads || 8;

  // ================================================================
  // ENGINE "ASISTEN WAR" — semua log adalah kejadian nyata
  // ================================================================
  const targetPriceFor = (t: TargetUrl | null) => (t?.target_price ? Number(t.target_price) : 0);
  const openLeadMs = Math.max(0, Math.min(5000, Number(botSettings.openLeadMs ?? 800)));

  const clearBotTimers = () => {
    if (botIntervalRef.current) {
      clearInterval(botIntervalRef.current);
      botIntervalRef.current = null;
    }
    botTimeoutsRef.current.forEach((t) => clearTimeout(t));
    botTimeoutsRef.current = [];
  };

  const finishRun = (phase: EnginePhase) => {
    isRunningRef.current = false;
    setIsBotRunning(false);
    setEnginePhase(phase);
  };

  // --- Suara, getar, wake lock (butuh sentuhan user untuk aktif) ---
  const audioCtxRef = useRef<AudioContext | null>(null);
  const wakeLockRef = useRef<any>(null);
  const primeAlerts = () => {
    try {
      if (!audioCtxRef.current) {
        const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (Ctx) audioCtxRef.current = new Ctx();
      }
      audioCtxRef.current?.resume?.();
    } catch {}
  };
  const beep = (freq = 880, ms = 120) => {
    if (botSettings.soundAlert === false) return;
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = freq;
      g.gain.value = 0.12;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + ms / 1000);
    } catch {}
  };
  const vibrate = (pattern: number | number[]) => {
    if (botSettings.vibrateAlert === false) return;
    try {
      navigator.vibrate?.(pattern);
    } catch {}
  };
  const requestWakeLock = async () => {
    try {
      const wl = (navigator as any).wakeLock;
      if (!wl) {
        addLog('[SYSTEM] Browser tidak mendukung Wake Lock — jaga layar HP tetap menyala manual.', 'warning');
        return;
      }
      wakeLockRef.current = await wl.request('screen');
      addLog('[SYSTEM] Wake Lock aktif: layar tidak akan mati selama menunggu sesi.', 'info');
    } catch (e: any) {
      addLog(`[SYSTEM] Wake Lock ditolak browser (${e?.name || 'error'}).`, 'warning');
    }
  };
  const releaseWakeLock = () => {
    try {
      wakeLockRef.current?.release?.();
    } catch {}
    wakeLockRef.current = null;
  };

  // --- Overlay detik 0 ---
  const [fireState, setFireState] = useState<FireState | null>(null);

  // --- Pemeriksaan sebelum war (sinkron jam, lisensi, gateway, data produk) ---
  const runPrechecks = async (): Promise<boolean> => {
    const reg = ASEAN_REGIONS[selectedRegion] || ASEAN_REGIONS.ID;
    const t = selectedTarget;
    setEnginePhase('sync');
    addLog(`[WAR] Sesi war dimulai · Shopee ${reg.name} (${reg.domain}) · target: ${t?.title || '-'}`, 'info');
    addLog('[NTP] Sinkronisasi jam ke server bot (3 sampel)…', 'info');
    const sync = await clock.resync();
    if (!isRunningRef.current) return false;
    sync.samples.forEach((s, i) => addLog(`[NTP] Sampel #${i + 1}: RTT ${s.rtt} ms · selisih jam ${s.offset > 0 ? '+' : ''}${s.offset} ms`, 'info'));
    if (sync.best) {
      addLog(`[NTP] Jam terkunci ke server (sampel terbaik RTT ${sync.best.rtt} ms). Akurasi ±${Math.ceil(sync.best.rtt / 2)} ms.`, 'success');
    } else {
      addLog('[NTP] Gagal sinkron ke server — memakai jam perangkat.', 'warning');
    }

    const lic = await api.sessionStart();
    if (!isRunningRef.current) return false;
    if (!lic.success) {
      addLog(`[LISENSI] ${lic.error?.message || 'Lisensi tidak valid'}`, 'error');
      toast.show(lic.error?.message || 'Lisensi tidak valid');
      finishRun('error');
      return false;
    }
    addLog('[LISENSI] Lisensi aktif terverifikasi di server.', 'success');

    setEnginePhase('warm');
    const ping = await api.pingGateway(reg.code);
    if (!isRunningRef.current) return false;
    if (ping.success && ping.data) {
      setServerLatency(ping.data.latency_ms);
      if (ping.data.reachable === false) {
        addLog(`[GATEWAY] ${reg.domain} tidak terjangkau dari server bot. Shopee tetap dibuka langsung dari HP kamu.`, 'warning');
      } else {
        addLog(`[GATEWAY] ${reg.domain} → HTTP ${ping.data.status} · ${ping.data.latency_ms} ms`, 'info');
      }
    }

    if (t?.url) {
      const ids = parseShopeeLink(t.url);
      addLog(ids ? `[PRODUK] Link valid · shopid ${ids.shopId} · itemid ${ids.itemId}` : '[PRODUK] Link tanpa ID produk (link pendek) — akan dibuka apa adanya.', ids ? 'info' : 'warning');
      if (ids) {
        addLog('[PRODUK] Mengambil data produk dari Shopee…', 'info');
        const ck = await api.checkItem(reg.code, t.url);
        if (!isRunningRef.current) return false;
        const d = ck.data;
        if (ck.success && d?.item) {
          const it = d.item;
          addLog(`[PRODUK] ${it.name}`, 'success');
          if (it.price != null) addLog(`[PRODUK] Harga sekarang ${formatAseanCurrency(it.price, selectedRegion)}${it.stock != null ? ` · stok ${it.stock}` : ''}`, 'info');
          if (it.flash_sale) {
            const fs = it.flash_sale;
            addLog(
              `[FLASH] Flash sale terdeteksi${fs.price != null ? ` · harga ${formatAseanCurrency(fs.price, selectedRegion)}` : ''}${fs.stock != null ? ` · kuota ${fs.stock}` : ''}${fs.start_time ? ` · mulai ${new Date(fs.start_time).toLocaleTimeString('id-ID')}` : ''}`,
              'success'
            );
          } else {
            addLog('[FLASH] Belum ada data flash sale aktif untuk produk ini.', 'info');
          }
        } else if (d) {
          addLog(`[PRODUK] Data produk tidak bisa diambil: ${d.reason || `HTTP ${d.status}`} (${d.latency_ms} ms). Lanjut tanpa data stok.`, 'warning');
        } else {
          addLog(`[PRODUK] Cek produk gagal: ${ck.error?.message || 'error'}`, 'warning');
        }
      }
    }
    setEnginePhase('armed');
    return true;
  };

  // --- Detik 0: buka Shopee ---
  const fire = (scheduledEpoch: number | null) => {
    const reg = ASEAN_REGIONS[selectedRegion] || ASEAN_REGIONS.ID;
    const t = selectedTarget;
    if (!t?.url) {
      addLog('[ERROR] Target tidak punya link produk.', 'error');
      finishRun('error');
      return;
    }
    setEnginePhase('fire');
    const now = clock.now();
    const delta = scheduledEpoch != null ? now - scheduledEpoch : null;
    const mode = botSettings.openMode === 'browser' ? 'browser' : 'app';
    const { href, via } = buildOpenUrl(t.url, selectedRegion, mode);
    beep(1320, 220);
    vibrate([200, 80, 200]);
    if (scheduledEpoch != null) {
      addLog(
        `[FIRE] Membuka Shopee ${openLeadMs} ms sebelum sesi · jam server ${formatClock(now, reg.timezone)}.${String(now % 1000).padStart(3, '0')} · presisi timer ${delta! >= 0 ? '+' : ''}${delta} ms`,
        'warning'
      );
      const zeroAt = scheduledEpoch + openLeadMs;
      const tZero = window.setTimeout(() => {
        const n = clock.now();
        addLog(`[T-0] Detik 0 sesi · jam server ${formatClock(n, reg.timezone)}.${String(n % 1000).padStart(3, '0')} (selisih ${n - zeroAt >= 0 ? '+' : ''}${n - zeroAt} ms)`, 'warning');
      }, Math.max(0, zeroAt - now));
      botTimeoutsRef.current.push(tZero);
    } else {
      addLog(`[FIRE] Buka manual · jam server ${formatClock(now, reg.timezone)}.${String(now % 1000).padStart(3, '0')}`, 'warning');
    }

    let autoOpened = false;
    if (!href.startsWith('intent:')) {
      try {
        // Catatan: dengan fitur 'noopener' window.open selalu mengembalikan null, jadi opener diputus manual
        const w = window.open(href, '_blank');
        autoOpened = !!w;
        if (w) {
          try {
            w.opener = null;
          } catch {}
        }
      } catch {
        autoOpened = false;
      }
    }
    if (autoOpened) {
      addLog(`[OPEN] Shopee dibuka otomatis lewat ${via}. Selesaikan checkout di Shopee.`, 'success');
    } else {
      addLog(`[OPEN] Tekan tombol "Buka Shopee" di layar — ${href.startsWith('intent:') ? 'Android butuh satu sentuhan untuk masuk app' : 'browser memblokir pembukaan otomatis'}.`, 'warning');
    }
    releaseWakeLock();
    setStats((p) => ({ ...p, attempts: p.attempts + 1 }));
    setFireState({
      target: t,
      href,
      via,
      autoOpened,
      scheduledEpoch,
      firedAt: now,
      region: selectedRegion,
    });
    isRunningRef.current = false;
    setIsBotRunning(false);
    setEnginePhase('done');
    addLog('[WAR] Menunggu konfirmasi hasil checkout dari kamu…', 'info');
    if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
      try {
        new Notification('Sesi flash sale dimulai!', { body: `Buka Shopee sekarang: ${t.title}` });
      } catch {}
    }
  };

  const guardStart = (): boolean => {
    if (currentUser && currentUser.role !== 'admin' && currentUser.expired_at) {
      const exp = new Date(currentUser.expired_at).getTime();
      if (!isNaN(exp) && exp < Date.now()) {
        addLog('[LISENSI] Masa aktif lisensi habis. Perpanjang via QRIS untuk memakai bot.', 'error');
        toast.show('Lisensi habis — perpanjang dulu');
        return false;
      }
    }
    if (!selectedTarget) {
      addLog('[SETUP] Belum ada target produk. Tambahkan link produk di tab Target.', 'error');
      toast.show('Tambahkan target produk dulu');
      return false;
    }
    if (!isValidHttpUrl(selectedTarget.url)) {
      addLog('[SETUP] Link target tidak valid. Edit target dan tempel link produk Shopee.', 'error');
      toast.show('Link target tidak valid');
      return false;
    }
    return true;
  };

  // Tombol "Jalankan": cek semua lalu langsung buka Shopee
  const handleStartBot = async () => {
    if (isRunningRef.current) return;
    if (!guardStart()) return;
    primeAlerts();
    clearBotTimers();
    isRunningRef.current = true;
    setIsBotRunning(true);
    const ok = await runPrechecks();
    if (!ok || !isRunningRef.current) return;
    fire(null);
  };

  const handleStopBot = () => {
    const wasRunning = isRunningRef.current;
    clearBotTimers();
    finishRun('idle');
    releaseWakeLock();
    if (wasRunning) addLog('[WAR] Sesi dihentikan oleh kamu.', 'warning');
  };

  // --- Auto-start terjadwal ---
  const precheckStartedRef = useRef(false);
  const milestonesRef = useRef<Set<string>>(new Set());
  const fireRef = useRef(fire);
  fireRef.current = fire;
  const precheckRef = useRef(runPrechecks);
  precheckRef.current = runPrechecks;

  useEffect(() => {
    if (!armed) return;
    precheckStartedRef.current = false;
    milestonesRef.current = new Set();
    const id = window.setInterval(() => {
      const remain = armed.epoch - clock.now();
      const fireAt = remain - openLeadMs;
      const mark = (k: string, text: string, type: 'info' | 'warning' = 'info') => {
        if (milestonesRef.current.has(k)) return;
        milestonesRef.current.add(k);
        addLog(text, type);
      };

      // Hitung mundur ke sesi
      for (const m of [600, 300, 120, 60, 30]) {
        if (remain <= m * 1000 && remain > (m - 1) * 1000) mark(`m${m}`, `[COUNTDOWN] T-${m >= 60 ? `${m / 60} menit` : `${m} dtk`} menuju sesi ${armed.label}`);
      }
      if (remain <= 10_000 && remain > 0) {
        const sec = Math.ceil(remain / 1000);
        if (!milestonesRef.current.has(`s${sec}`)) {
          mark(`s${sec}`, `[COUNTDOWN] T-${sec}`, sec <= 3 ? 'warning' : 'info');
          if (sec <= 3) beep(880, 90);
        }
      }

      // Mulai cek 60 dtk sebelum sesi
      if (remain <= 60_000 && !precheckStartedRef.current) {
        precheckStartedRef.current = true;
        isRunningRef.current = true;
        setIsBotRunning(true);
        precheckRef.current().then((ok) => {
          if (ok) addLog(`[STANDBY] Semua siap. Shopee dibuka ${openLeadMs} ms sebelum ${armed.label} supaya pas detik 0.`, 'success');
        });
      }

      if (fireAt <= 0) {
        window.clearInterval(id);
        setArmed(null);
        if (remain > -60_000) {
          if (!isRunningRef.current && precheckStartedRef.current) return; // dihentikan user
          isRunningRef.current = true;
          fireRef.current(armed.epoch - openLeadMs);
        } else {
          addLog(`[SCHEDULER] Jadwal ${armed.label} terlewat (HP tidur / tab tertutup). Auto-start dibatalkan.`, 'error');
          finishRun('error');
        }
      }
    }, 25);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armed, openLeadMs]);

  const handleArm = (a: ArmState) => {
    if (!guardStart()) return;
    primeAlerts();
    setArmed(a);
    addLog(`[SCHEDULER] Auto-start dijadwalkan untuk sesi ${a.label}. Pemeriksaan mulai T-60 dtk, Shopee dibuka ${openLeadMs} ms sebelum detik 0.`, 'info');
    addLog('[SCHEDULER] Biarkan halaman ini terbuka & layar menyala sampai sesi dimulai.', 'info');
    requestWakeLock();
    toast.show(`Auto-start sesi ${a.label} aktif — biarkan halaman tetap terbuka`);
  };
  const handleDisarm = () => {
    if (armed) addLog(`[SCHEDULER] Jadwal auto-start ${armed.label} dibatalkan.`, 'info');
    setArmed(null);
    releaseWakeLock();
    if (isRunningRef.current) finishRun('idle');
  };

  // --- Konfirmasi hasil dari user ---
  const handleConfirmResult = async (r: { success: boolean; orderSn?: string; price?: number; note?: string }) => {
    if (!fireState) return;
    const t = fireState.target;
    if (r.success) {
      const res = await api.confirmOrder({
        region: fireState.region,
        targetTitle: t.title,
        price: r.price ?? targetPriceFor(t),
        orderSn: r.orderSn,
        paymentMethod: paymentSettings?.payment_method || '',
        openDelayMs: fireState.scheduledEpoch != null ? fireState.firedAt - fireState.scheduledEpoch : null,
        targetUrl: t.url,
      });
      if (res.success) {
        addLog(`[HASIL] Checkout dikonfirmasi${r.orderSn ? ` · no. pesanan ${r.orderSn}` : ''} · tersimpan di riwayat.`, 'success');
        setStats((p) => ({ ...p, success: p.success + 1 }));
        loadUserData();
      } else {
        addLog(`[HASIL] Gagal menyimpan: ${res.error?.message || 'error'}`, 'error');
      }
    } else {
      addLog(`[HASIL] Tidak dapat${r.note ? `: ${r.note}` : ''}. Coba sesi berikutnya.`, 'warning');
    }
    setFireState(null);
    setEnginePhase('idle');
  };

  // --- Monitor nyala terus: gateway, jam, tab, jaringan ---
  useEffect(() => {
    if (!currentUser) return;
    let alive = true;
    let timer: number | undefined;
    const reg = ASEAN_REGIONS[selectedRegion] || ASEAN_REGIONS.ID;
    const tick = async () => {
      if (document.visibilityState === 'visible') {
        const res = await api.pingGateway(selectedRegion);
        if (!alive) return;
        if (res.success && res.data) {
          const d = res.data;
          setLatency((prev) => ({
            history: d.reachable === false ? prev.history : [...prev.history, d.latency_ms].slice(-40),
            last: d.reachable === false ? null : d.latency_ms,
            status: d.status,
            reachable: d.reachable !== false,
            checkedAt: Date.now(),
          }));
          addLog(
            d.reachable === false
              ? `[GATEWAY] ${reg.domain} tidak terjangkau dari server bot (${d.latency_ms} ms)`
              : `[GATEWAY] ${reg.domain} → HTTP ${d.status} · ${d.latency_ms} ms`,
            d.reachable === false ? 'warning' : 'info'
          );
        } else {
          addLog(`[GATEWAY] Server bot tidak merespons: ${res.error?.message || 'error'}`, 'error');
        }
      }
      if (alive) timer = window.setTimeout(tick, isRunningRef.current || armed ? 5000 : 20000);
    };
    tick();
    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, selectedRegion, armed]);

  // Status sesi tiap menit
  useEffect(() => {
    if (!currentUser) return;
    const id = window.setInterval(() => {
      const reg = ASEAN_REGIONS[selectedRegion] || ASEAN_REGIONS.ID;
      const nxt = getNextSession(clock.now(), reg.flashSaleSchedule, reg.timezone);
      if (!nxt) return;
      const mins = Math.max(0, Math.round((nxt.epoch - clock.now()) / 60000));
      addLog(`[MONITOR] Sesi berikutnya ${nxt.label} ${reg.timezoneLabel.split(' ')[0]} · ${mins >= 60 ? `${Math.floor(mins / 60)} jam ${mins % 60} mnt` : `${mins} mnt`} lagi${armed ? ' · auto-start AKTIF' : ''}`, 'info');
    }, 60_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, selectedRegion, armed]);

  useEffect(() => {
    const onVis = () => {
      if (!armed && !isRunningRef.current) return;
      if (document.visibilityState === 'hidden') addLog('[SYSTEM] Tab disembunyikan — browser bisa memperlambat timer. Kembali ke tab ini sebelum sesi.', 'warning');
      else {
        addLog('[SYSTEM] Tab aktif kembali. Menyinkronkan ulang jam…', 'info');
        if (armed) requestWakeLock();
      }
    };
    const onOff = () => addLog('[NETWORK] Koneksi internet terputus!', 'error');
    const onOn = () => addLog('[NETWORK] Koneksi internet kembali.', 'success');
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('offline', onOff);
    window.addEventListener('online', onOn);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('offline', onOff);
      window.removeEventListener('online', onOn);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armed]);

  // Log sinkron jam berkala (dipanggil oleh hook jam)
  clockLogRef.current = (r: SyncResult, manual: boolean) => {
    if (manual || !r.best) return;
    addLog(`[NTP] Jam disinkron ulang · RTT ${r.best.rtt} ms · selisih ${r.best.offset > 0 ? '+' : ''}${r.best.offset} ms`, 'info');
  };

  // Bersihkan timer saat komponen dilepas
  useEffect(() => () => {
    clearBotTimers();
    releaseWakeLock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // CRUD Operations with Persistence
  const handleSaveAddress = async (data: Partial<Address>) => {
    if (activeAddress?.id) {
      const res = await api.put<Address>('addresses', activeAddress.id, data);
      if (res.success && res.data) {
        setAddresses((prev) => prev.map((a) => (a.id === activeAddress.id ? res.data! : a)));
        addLog(`Alamat "${res.data.label}" berhasil diperbarui.`, 'success');
      }
    } else {
      const res = await api.post<Address>('addresses', data);
      if (res.success && res.data) {
        setAddresses((prev) => [res.data!, ...prev]);
        addLog(`Alamat baru "${res.data.label}" berhasil disimpan.`, 'success');
      }
    }
  };

  const handleDeleteAddress = async (id: string) => {
    if (!confirm('Hapus alamat ini?')) return;
    const res = await api.delete('addresses', id);
    if (res.success) {
      setAddresses((prev) => prev.filter((a) => a.id !== id));
      addLog('Alamat berhasil dihapus.', 'info');
    }
  };

  const handleSaveAccount = async (data: Partial<ShopeeAccount>) => {
    if (activeAccount?.id) {
      const res = await api.put<ShopeeAccount>('shopee-accounts', activeAccount.id, data);
      if (res.success && res.data) {
        setAccounts((prev) => prev.map((a) => (a.id === activeAccount.id ? res.data! : a)));
        addLog(`Akun "${res.data.nickname}" berhasil diperbarui.`, 'success');
      }
    } else {
      const allowedMax = currentUser?.role === 'admin' ? 999 : (currentUser?.max_accounts || 5);
      if (accounts.length >= allowedMax) {
        alert(
          `Batas kuota akun untuk paket lisensi Anda telah tercapai (Maksimal ${allowedMax} Akun).\n\n` +
          `Silakan hubungi Telegram @mrpangeranz untuk perpanjangan atau upgrade kuota lisensi!`
        );
        addLog(`[Batas Kuota Lisensi] Gagal menambah akun: Kuota ${allowedMax} akun penuh. Hubungi Telegram @mrpangeranz.`, 'error');
        return;
      }
      const res = await api.post<ShopeeAccount>('shopee-accounts', data);
      if (res.success && res.data) {
        setAccounts((prev) => [res.data!, ...prev]);
        addLog(`Akun "${res.data.nickname}" berhasil ditambahkan.`, 'success');
      }
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm('Hapus akun ini?')) return;
    const res = await api.delete('shopee-accounts', id);
    if (res.success) {
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      addLog('Akun berhasil dihapus.', 'info');
    }
  };

  const handleSaveBulkAccounts = async (bulkData: Partial<ShopeeAccount>[]) => {
    if (!bulkData || bulkData.length === 0) return;
    const allowedMax = currentUser?.role === 'admin' ? 999 : (currentUser?.max_accounts || 15);
    const availableSlots = Math.max(0, allowedMax - accounts.length);
    if (availableSlots <= 0) {
      alert(`Batas kuota akun Anda (${allowedMax} akun) telah penuh. Silakan upgrade lisensi untuk menambah slot akun.`);
      addLog(`[Batas Kuota] Gagal impor massal: batas ${allowedMax} akun tercapai.`, 'error');
      return;
    }

    const itemsToImport = bulkData.slice(0, availableSlots);
    addLog(`🚀 Memproses impor massal ${itemsToImport.length} akun Shopee ke database...`, 'info');

    const res = await api.post<{ total_imported: number; items: ShopeeAccount[] }>(
      'shopee-accounts/bulk',
      itemsToImport
    );

    if (res.success && res.data?.items) {
      setAccounts((prev) => [...res.data!.items, ...prev]);
      addLog(`✅ Berhasil mengimpor ${res.data.items.length} akun Shopee sekaligus!`, 'success');
    } else {
      // Fallback sequential
      let count = 0;
      for (const item of itemsToImport) {
        const singleRes = await api.post<ShopeeAccount>('shopee-accounts', item);
        if (singleRes.success && singleRes.data) {
          setAccounts((prev) => [singleRes.data!, ...prev]);
          count++;
        }
      }
      addLog(`✅ Selesai mengimpor ${count} akun Shopee ke database.`, 'success');
    }
  };

  const handleSaveTargetUrl = async (data: Partial<TargetUrl>) => {
    if (activeTargetUrl?.id) {
      const res = await api.put<TargetUrl>('target-urls', activeTargetUrl.id, data);
      if (res.success && res.data) {
        setTargetUrls((prev) => prev.map((t) => (t.id === activeTargetUrl.id ? res.data! : t)));
        addLog(`Target produk "${res.data.title}" diperbarui.`, 'success');
      }
    } else {
      const res = await api.post<TargetUrl>('target-urls', data);
      if (res.success && res.data) {
        setTargetUrls((prev) => [res.data!, ...prev]);
        addLog(`Target produk baru "${res.data.title}" berhasil ditambahkan.`, 'success');
      }
    }
  };

  const handleDeleteTargetUrl = async (id: string) => {
    if (!confirm('Hapus target URL ini?')) return;
    const res = await api.delete('target-urls', id);
    if (res.success) {
      setTargetUrls((prev) => prev.filter((t) => t.id !== id));
      addLog('Target URL berhasil dihapus.', 'info');
    }
  };

  const handleSaveProxy = async (data: Partial<ProxyMesh>) => {
    if (activeProxy?.id) {
      const res = await api.put<ProxyMesh>('proxies', activeProxy.id, data);
      if (res.success && res.data) {
        setProxies((prev) => prev.map((p) => (p.id === activeProxy.id ? res.data! : p)));
        addLog(`Proxy ${res.data.host} diperbarui.`, 'success');
      }
    } else {
      const res = await api.post<ProxyMesh>('proxies', data);
      if (res.success && res.data) {
        setProxies((prev) => [res.data!, ...prev]);
        addLog(`Proxy ${res.data.host} berhasil ditambahkan.`, 'success');
      }
    }
  };

  const handleDeleteProxy = async (id: string) => {
    const res = await api.delete('proxies', id);
    if (res.success) {
      setProxies((prev) => prev.filter((p) => p.id !== id));
      addLog('Proxy dihapus.', 'info');
    }
  };

  const handleSaveSchedule = async (data: Partial<Schedule>) => {
    if (activeSchedule?.id) {
      const res = await api.put<Schedule>('schedules', activeSchedule.id, data);
      if (res.success && res.data) {
        setSchedules((prev) => prev.map((s) => (s.id === activeSchedule.id ? res.data! : s)));
        addLog(`Jadwal "${res.data.title}" diperbarui.`, 'success');
      }
    } else {
      const res = await api.post<Schedule>('schedules', data);
      if (res.success && res.data) {
        setSchedules((prev) => [res.data!, ...prev]);
        addLog(`Jadwal "${res.data.title}" berhasil disimpan.`, 'success');
      }
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    const res = await api.delete('schedules', id);
    if (res.success) {
      setSchedules((prev) => prev.filter((s) => s.id !== id));
      addLog('Jadwal dihapus.', 'info');
    }
  };

  const handleUpdatePayment = async (data: Partial<ShopeePayment>) => {
    const payId = paymentSettings?.id || `pay_${currentUser?.id || 'main'}`;
    const res = await api.put<ShopeePayment>('shopee-payments', payId, data);
    if (res.success && res.data) {
      setPaymentSettings(res.data);
      addLog('Pengaturan pembayaran & Telegram berhasil disimpan.', 'success');
    }
  };

  // Cloud Data Synchronization Trigger
  const handleRunMigration = async (force = false) => {
    // force=true menimpa data cloud dengan seed lokal — tombol admin selalu memakai false
    setIsMigrating(true);
    addLog('Menjalankan sinkronisasi data cloud...', 'info');
    try {
      const res = await api.runMigration(force);
      if (res.success) {
        addLog('Sinkronisasi data cloud berhasil 100%!', 'success');
        await loadUserData();
      } else {
        addLog(`Sinkronisasi gagal: ${res.error?.message}`, 'error');
      }
    } catch (err: any) {
      addLog(`Sinkronisasi error: ${err.message}`, 'error');
    }
    setIsMigrating(false);
  };

  // Export & Import Handlers
  const handleExportData = () => {
    const exportData = {
      accounts,
      addresses,
      targetUrls,
      proxies,
      schedules,
      paymentSettings,
      botSettings,
      exported_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shopee-bot-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addLog('Konfigurasi bot berhasil di-export ke file JSON.', 'success');
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        if (parsed.botSettings) setBotSettings(parsed.botSettings);
        addLog('Data konfigurasi bot berhasil di-import.', 'success');
      } catch (err: any) {
        alert('File JSON tidak valid: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const [currentTab, setCurrentTab] = useState<AppTab>('dashboard');

  // Prevent unwanted auto-scroll when entering dashboard or switching tabs
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [currentTab, currentUser?.id]);

  // User biasa tidak boleh berada di tab admin
  useEffect(() => {
    if (currentTab === 'admin' && currentUser?.role !== 'admin') setCurrentTab('dashboard');
  }, [currentTab, currentUser?.role]);

  const handleRequestNotification = () => {
    if (!('Notification' in window)) {
      toast.show('Browser ini tidak mendukung notifikasi');
      return;
    }
    Notification.requestPermission().then((permission) => {
      setNotifState(permission);
      if (permission === 'granted') {
        addLog('Notifikasi browser/HP berhasil diaktifkan!', 'success');
        try {
          new Notification('GaneMaX.Ai', { body: 'Notifikasi aktif. Kamu akan dapat kabar saat checkout selesai.' });
        } catch {}
      } else {
        toast.show('Izin notifikasi ditolak di browser');
      }
    });
  };

  const liveAnnouncements = useMemo(() => sortAnnouncements(announcements.filter((a) => isAnnouncementLive(a))), [announcements]);
  const visibleAnnouncements = liveAnnouncements.filter((a) => a.pinned || !dismissedIds.includes(a.id));
  const unreadCount = visibleAnnouncements.length;
  const dismissAnnouncement = (id: string) => {
    setDismissedIds((prev) => {
      const next = Array.from(new Set([...prev, id])).slice(-100);
      try {
        localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const normalizedOrders = useMemo(
    () =>
      orderHistory
        // Order berstatus 'PAID (200 OK)' dibuat engine lama tanpa checkout sungguhan — tidak ditampilkan
        .filter((o: any) => o.status !== 'PAID (200 OK)')
        .map((o) => normalizeOrder(o as any))
        .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()),
    [orderHistory]
  );

  if (!currentUser) {
    return (
      <>
        <LoginScreen
          onLogin={handleLogin}
          onOpenPaymentModal={() => setIsPayModalOpen(true)}
          isLoading={isLoginLoading}
        />
        <PaymentGatewayModal
          isOpen={isPayModalOpen}
          onClose={() => setIsPayModalOpen(false)}
          username=""
        />
      </>
    );
  }

  const controlPanelProps = {
    currentUser,
    targetUrls,
    paymentSettings,
    botSettings,
    isBotRunning,
    selectedRegion,
    onSelectRegion: handleSelectRegion,
    onStartBot: handleStartBot,
    onStopBot: handleStopBot,
    onUpdatePayment: handleUpdatePayment,
    onUpdateSettings: setBotSettings,
    onOpenTargetUrlModal: (t?: TargetUrl) => {
      setActiveTargetUrl(t || null);
      setTargetUrlModalOpen(true);
    },
    onDeleteTargetUrl: handleDeleteTargetUrl,
    selectedTargetId: selectedTarget?.id || '',
    onSelectTarget: handleSelectTarget,
    onRequestNotification: handleRequestNotification,
  };

  return (
    <div className="gx-shell">
      <TopBar
        user={currentUser}
        tab={currentTab}
        onTab={setCurrentTab}
        isDark={isDarkTheme}
        onToggleTheme={() => setIsDarkTheme(!isDarkTheme)}
        region={selectedRegion}
        onRegion={handleSelectRegion}
        clock={clock}
        unreadCount={unreadCount}
        onOpenAnnouncements={() => setIsAnnDrawerOpen(true)}
        onOpenQris={() => setIsPayModalOpen(true)}
        onOpenWhatsapp={() => setIsWaModalOpen(true)}
        onExport={handleExportData}
        onImport={handleImportData}
        onToggleMusic={handleToggleMusic}
        isPlayingMusic={isPlayingMusic}
        onLogout={handleLogout}
        isBotRunning={isBotRunning}
      />

      <main className="gx-main">
        {currentTab === 'dashboard' && (
          <DashboardView
            user={currentUser}
            region={selectedRegion}
            clock={clock}
            targets={targetUrls}
            selectedTarget={selectedTarget}
            onSelectTarget={handleSelectTarget}
            accounts={accounts}
            addresses={addresses}
            paymentSettings={paymentSettings}
            proxiesCount={proxies.length}
            orders={normalizedOrders}
            stats={stats}
            logs={logs}
            onClearLogs={() => setLogs([])}
            isBotRunning={isBotRunning}
            phase={enginePhase}
            latency={latency}
            botSettings={botSettings}
            openLeadMs={openLeadMs}
            armed={armed}
            onArm={handleArm}
            onDisarm={handleDisarm}
            onStart={handleStartBot}
            onStop={handleStopBot}
            announcements={visibleAnnouncements}
            onDismissAnnouncement={dismissAnnouncement}
            onOpenTargetModal={(t) => {
              setActiveTargetUrl(t || null);
              setTargetUrlModalOpen(true);
            }}
            onOpenAccountModal={() => {
              setActiveAccount(null);
              setAccountModalOpen(true);
            }}
            onOpenAddressModal={() => {
              setActiveAddress(null);
              setAddressModalOpen(true);
            }}
            onGoTab={setCurrentTab}
            onOpenQris={() => setIsPayModalOpen(true)}
            onCopied={toast.show}
          />
        )}

        {currentTab === 'targets' && (
          <>
            <div className="gx-pagehead">
              <div>
                <h1>Target</h1>
                <p>Produk incaran dan notifikasi hasil war.</p>
              </div>
            </div>
            <ControlPanel {...controlPanelProps} section="setup" />
          </>
        )}

        {currentTab === 'engine' && (
          <>
            <div className="gx-pagehead">
              <div>
                <h1>Engine</h1>
                <p>Wilayah Shopee dan pengaturan pembukaan di detik 0.</p>
              </div>
            </div>
            <ControlPanel {...controlPanelProps} section="engine" />
          </>
        )}

        {currentTab === 'analytics' && (
          <HistoryView
            orders={normalizedOrders}
            stats={stats}
            latency={latency}
            clock={clock}
            region={selectedRegion}
            logs={logs}
            onClearLogs={() => setLogs([])}
            onCopied={toast.show}
          />
        )}

        {currentTab === 'admin' && currentUser.role === 'admin' && (
          <AdminPanel
            currentUser={currentUser}
            users={usersList}
            setUsers={setUsersList}
            onAnnouncementsChanged={loadAnnouncements}
            onRunMigration={() => handleRunMigration(false)}
            isMigrating={isMigrating}
            toast={toast.show}
          />
        )}
      </main>

      <Dock
        tab={currentTab}
        onTab={setCurrentTab}
        isAdmin={currentUser.role === 'admin'}
        isBotRunning={isBotRunning}
        onToggleBot={isBotRunning ? handleStopBot : handleStartBot}
      />

      <AnnouncementDrawer
        open={isAnnDrawerOpen}
        onClose={() => setIsAnnDrawerOpen(false)}
        items={liveAnnouncements}
        onEnableNotification={handleRequestNotification}
        notificationState={notifState}
      />

      {toast.node}

      {/* Modals */}
      <PaymentGatewayModal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        username={currentUser?.username || ''}
      />
      <WhatsappChannelModal isOpen={isWaModalOpen} onClose={() => setIsWaModalOpen(false)} />
      <AddressModal
        isOpen={addressModalOpen}
        onClose={() => {
          setAddressModalOpen(false);
          setActiveAddress(null);
        }}
        onSave={handleSaveAddress}
        initialData={activeAddress}
        defaultRegion={selectedRegion}
      />
      <AccountModal
        isOpen={accountModalOpen}
        onClose={() => {
          setAccountModalOpen(false);
          setActiveAccount(null);
        }}
        onSave={handleSaveAccount}
        initialData={activeAccount}
        defaultRegion={selectedRegion}
      />
      <TargetUrlModal
        isOpen={targetUrlModalOpen}
        onClose={() => {
          setTargetUrlModalOpen(false);
          setActiveTargetUrl(null);
        }}
        onSave={handleSaveTargetUrl}
        initialData={activeTargetUrl}
        defaultRegion={selectedRegion}
      />
      <ProxyModal
        isOpen={proxyModalOpen}
        onClose={() => {
          setProxyModalOpen(false);
          setActiveProxy(null);
        }}
        onSave={handleSaveProxy}
        initialData={activeProxy}
        defaultRegion={selectedRegion}
      />
      <ScheduleModal
        isOpen={scheduleModalOpen}
        onClose={() => {
          setScheduleModalOpen(false);
          setActiveSchedule(null);
        }}
        onSave={handleSaveSchedule}
        initialData={activeSchedule}
      />
      <BulkAccountModal
        isOpen={bulkAccountModalOpen}
        onClose={() => setBulkAccountModalOpen(false)}
        onSaveBulk={handleSaveBulkAccounts}
        defaultRegion={selectedRegion}
      />
      <FireOverlay
        state={fireState}
        clock={clock}
        onOpen={(href) => {
          addLog('[OPEN] Shopee dibuka lewat tombol.', 'success');
          if (href.startsWith('intent:')) window.location.href = href;
          else {
            const w = window.open(href, '_blank');
            if (w) {
              try {
                w.opener = null;
              } catch {}
            }
          }
        }}
        onResult={handleConfirmResult}
      />
    </div>
  );
};

export default App;
