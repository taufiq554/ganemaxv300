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
import { PythonScriptModal } from './components/PythonScriptModal.tsx';
import { useServerClock } from './lib/useServerClock.ts';
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
  ARM_LEAD_MS,
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
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
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
  const clock = useServerClock();
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
      time: new Date().toLocaleTimeString('id-ID'),
      text: 'Engine bot siap diaktifkan. Semua modul terisolasi & terenkripsi aman.',
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
        ...prev.slice(-150),
        {
          id: Math.random().toString(36).substring(2, 9),
          time: new Date().toLocaleTimeString('id-ID'),
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
  const effectiveThreads = Math.max(1, Math.min(Number(botSettings.threadCount) || 8, licenseThreadCap));

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

  // Start / Stop Bot Engine (Real Network & Gateway Execution)
  const handleStartBot = async () => {
    if (isRunningRef.current) return; // cegah eksekusi dobel (auto-start + klik manual)
    if (currentUser && currentUser.role !== 'admin' && currentUser.expired_at) {
      const exp = new Date(currentUser.expired_at).getTime();
      if (!isNaN(exp) && exp < Date.now()) {
        addLog('[LISENSI] Masa aktif lisensi habis. Perpanjang via QRIS untuk menjalankan engine.', 'error');
        toast.show('Lisensi habis — perpanjang dulu untuk menjalankan bot');
        return;
      }
    }
    if (!selectedTarget) {
      addLog('[SETUP] Belum ada target produk. Tambahkan link produk di tab Target.', 'error');
      toast.show('Tambahkan target produk dulu');
      return;
    }
    if (accounts.length === 0) {
      addLog('[SETUP] Belum ada akun Shopee eksekutor. Tambahkan akun di tab Target.', 'error');
      toast.show('Tambahkan akun Shopee dulu');
      return;
    }
    clearBotTimers();
    isRunningRef.current = true;

    const reg = ASEAN_REGIONS[selectedRegion] || ASEAN_REGIONS.ID;
    const currentTarget = selectedTarget;
    const targetTitle = currentTarget?.title || reg.sampleFlashProduct.title;
    const flashPriceNum = currentTarget?.target_price ? Number(currentTarget.target_price) : reg.sampleFlashProduct.flashPrice;
    const formattedPrice = formatAseanCurrency(flashPriceNum, selectedRegion);
    const savedAmount = currentTarget?.target_price
      ? Math.max(reg.sampleFlashProduct.originalPrice - currentTarget.target_price, 100)
      : Math.max(reg.sampleFlashProduct.originalPrice - reg.sampleFlashProduct.flashPrice, 100);

    const activeThreads = effectiveThreads;
    const jitter = Number(botSettings.preFireJitter) || -15;

    setIsBotRunning(true);
    setEnginePhase('sync');
    addLog(`[PYTHON] $ python3 shopee_flash_bot.py --threads=${activeThreads} --region=${reg.code} --stealth=1`, 'info');
    addLog(`[WEBDRIVER] Undetected-ChromeDriver stealth options loaded (${activeThreads} worker threads ready)`, 'info');
    addLog(`[NTP-SYNC] Menghubungkan ke ${reg.ntpServer}...`, 'info');

    try {
      // 1. Real Gateway Ping & Latency Check
      const pingRes = await api.pingGateway(reg.code);
      if (!isRunningRef.current) return; // dihentikan saat menunggu
      const initialPing = pingRes.success ? pingRes.data?.latency_ms || 12 : 14;
      setServerLatency(initialPing);

      addLog(`[NTP-SYNC] Jam tersinkron ke server. Selisih jam perangkat: ${clock.offsetMs}ms, RTT gateway: ${initialPing}ms`, 'success');
      addLog(`[ENGINE] ENGINE BOT FLASH SALE AKTIF [${reg.code} - Shopee ${reg.name} (${reg.domain})]. Concurrency: ${activeThreads} Threads.`, 'success');

      // 2. Milestone Logs
      const t1 = window.setTimeout(() => {
        setEnginePhase('warm');
        addLog(`[TLS-HANDSHAKE] TLS 1.3 session pre-established dengan Shopee Edge Gateway (${reg.domain})`, 'info');
        addLog(`[PRE-WARM] Socket pool ${activeThreads} workers keep-alive OK. Memuat sesi pembayaran.`, 'info');
      }, 1000);

      const t2 = window.setTimeout(() => {
        addLog(`[TARGET] Target: ${targetTitle} | Wilayah: Shopee ${reg.name} | Target Checkout: ${formattedPrice}`, 'info');
        addLog(`[GATEWAY] Memantau status flash sale endpoint /api/v4/item/get... (standby buffer)`, 'info');
      }, 2000);

      const t3 = window.setTimeout(() => {
        setEnginePhase('armed');
        addLog(`[COUNTDOWN] Menunggu detik 00.000... offset jitter ${jitter}ms`, 'info');
        addLog(`[STANDBY] Payload siap, alamat: ${addresses[0]?.label || 'default'}, metode: ${paymentSettings?.payment_method?.toUpperCase() || 'SHOPEEPAY'}`, 'info');
      }, 3200);

      const t4 = window.setTimeout(() => {
        setEnginePhase('fire');
        addLog(`[TRIGGER] Menembakkan ${activeThreads} worker threads ke checkout gateway!`, 'warning');
      }, 4500);

      const t5 = window.setTimeout(async () => {
        // 3. Backend Checkout Execution
        try {
          const res = await api.executeBot({
            region: reg.code,
            targetTitle,
            targetPrice: flashPriceNum,
            threadCount: activeThreads,
            paymentMethod: paymentSettings?.payment_method || 'SHOPEEPAY',
            jitterMs: jitter,
            targetUrl: currentTarget?.url,
          });
          if (!isRunningRef.current) return;

          if (res.success && res.data) {
            const confirmedSn = res.data.order_sn;
            const latencyMs = res.data.latency_ms || 8;
            setServerLatency(latencyMs);

            addLog(
              `[HTTP-200] CHECKOUT BERHASIL! Order SN: ${confirmedSn} | Shopee ${reg.name} | Speed: ${latencyMs}ms | Total: ${formattedPrice}`,
              'success'
            );
            addLog(`[DATABASE] Transaksi ${confirmedSn} disimpan ke riwayat.`, 'success');

            finishRun('done');
            setStats((prev) => ({
              ...prev,
              attempts: prev.attempts + activeThreads,
              success: prev.success + 1,
              saved_amount: prev.saved_amount + savedAmount,
              speed_ms: latencyMs,
            }));
            if (botSettings.notifySuccess !== false && 'Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification('Checkout selesai', { body: `${targetTitle} · ${formattedPrice}` });
              } catch {}
            }

            loadUserData();
          } else {
            addLog(`[ERROR] Eksekusi gateway gagal: ${res.error?.message || 'Server overload'}`, 'error');
            setStats((prev) => ({ ...prev, attempts: prev.attempts + activeThreads }));
            finishRun('error');
          }
        } catch (err: any) {
          addLog(`[ERROR] Gagal memproses order checkout: ${err.message}`, 'error');
          finishRun('error');
        }
      }, 6000);

      botTimeoutsRef.current = [t1, t2, t3, t4, t5];
    } catch (e: any) {
      addLog(`[EXCEPTION] Engine gateway error: ${e.message}`, 'error');
      finishRun('error');
    }
  };

  const handleStopBot = () => {
    const wasRunning = isRunningRef.current;
    clearBotTimers();
    finishRun('idle');
    if (wasRunning) addLog('[PYTHON] $ kill -SIGINT daemon (engine dihentikan user).', 'warning');
  };

  // Simpan referensi fungsi terbaru untuk dipakai timer auto-start
  const startRef = useRef(handleStartBot);
  startRef.current = handleStartBot;

  // Auto-start terjadwal: picu ARM_LEAD_MS sebelum sesi, memakai jam server tersinkron
  useEffect(() => {
    if (!armed) return;
    const id = window.setInterval(() => {
      const remain = armed.epoch - clock.now();
      if (remain <= ARM_LEAD_MS) {
        window.clearInterval(id);
        setArmed(null);
        if (remain > -60_000) {
          addLog(`[SCHEDULER] Auto-start sesi ${armed.label} dipicu (T-${Math.max(0, Math.round(remain))}ms).`, 'warning');
          startRef.current();
        } else {
          addLog(`[SCHEDULER] Jadwal ${armed.label} terlewat, auto-start dibatalkan.`, 'error');
        }
      }
    }, 50);
    return () => window.clearInterval(id);
  }, [armed, clock, addLog]);

  const handleArm = (a: ArmState) => {
    setArmed(a);
    addLog(`[SCHEDULER] Auto-start dijadwalkan untuk sesi ${a.label}. Biarkan tab ini tetap terbuka.`, 'info');
    toast.show(`Auto-start sesi ${a.label} aktif — biarkan halaman tetap terbuka`);
  };
  const handleDisarm = () => {
    if (armed) addLog(`[SCHEDULER] Jadwal auto-start ${armed.label} dibatalkan.`, 'info');
    setArmed(null);
  };

  // Monitor latensi gateway: cek berkala (lebih rapat saat engine jalan)
  useEffect(() => {
    if (!currentUser) return;
    let alive = true;
    let timer: number | undefined;
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
        }
      }
      if (alive) timer = window.setTimeout(tick, isRunningRef.current || armed ? 5000 : 20000);
    };
    tick();
    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [currentUser?.id, selectedRegion, armed]);

  // Bersihkan timer saat komponen dilepas
  useEffect(() => () => clearBotTimers(), []);

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
    accounts,
    addresses,
    targetUrls,
    proxies,
    schedules,
    paymentSettings,
    botSettings,
    usersList,
    isBotRunning,
    selectedRegion,
    onSelectRegion: handleSelectRegion,
    onDeployAseanProxies: handleDeployAseanProxies,
    onStartBot: handleStartBot,
    onStopBot: handleStopBot,
    onUpdatePayment: handleUpdatePayment,
    onUpdateSettings: setBotSettings,
    onOpenAddressModal: (addr?: Address) => {
      setActiveAddress(addr || null);
      setAddressModalOpen(true);
    },
    onDeleteAddress: handleDeleteAddress,
    onOpenAccountModal: (acc?: ShopeeAccount) => {
      setActiveAccount(acc || null);
      setAccountModalOpen(true);
    },
    onOpenBulkAccountModal: () => setBulkAccountModalOpen(true),
    onDeleteAccount: handleDeleteAccount,
    onOpenTargetUrlModal: (t?: TargetUrl) => {
      setActiveTargetUrl(t || null);
      setTargetUrlModalOpen(true);
    },
    onDeleteTargetUrl: handleDeleteTargetUrl,
    onOpenProxyModal: (p?: ProxyMesh) => {
      setActiveProxy(p || null);
      setProxyModalOpen(true);
    },
    onDeleteProxy: handleDeleteProxy,
    onOpenScheduleModal: (sc?: Schedule) => {
      setActiveSchedule(sc || null);
      setScheduleModalOpen(true);
    },
    onDeleteSchedule: handleDeleteSchedule,
    selectedTargetId: selectedTarget?.id || '',
    onSelectTarget: handleSelectTarget,
    maxThreads: licenseThreadCap,
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
            effectiveThreads={effectiveThreads}
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
            onOpenScript={() => setIsScriptModalOpen(true)}
            onOpenQris={() => setIsPayModalOpen(true)}
            onCopied={toast.show}
          />
        )}

        {currentTab === 'targets' && (
          <>
            <div className="gx-pagehead">
              <div>
                <h1>Target & akun</h1>
                <p>Produk incaran, akun Shopee eksekutor, alamat, dan pembayaran.</p>
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
                <p>Wilayah Shopee, proxy, dan parameter eksekusi.</p>
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
      <PythonScriptModal
        isOpen={isScriptModalOpen}
        onClose={() => setIsScriptModalOpen(false)}
        isBotRunning={isBotRunning}
        onStartBot={handleStartBot}
        onStopBot={handleStopBot}
        onAddLog={addLog}
        selectedRegion={selectedRegion}
      />
    </div>
  );
};

export default App;
