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
import { ASEAN_REGIONS, formatAseanCurrency, isAseanCode, paymentFamily } from './constants/asean.ts';
import { useLang, readLang } from './lib/i18n.tsx';
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
import { PracticeOverlay, PracticeState, PracticeResult } from './components/gx/PracticeOverlay.tsx';
import { Onboarding, hasOnboarded } from './components/gx/Onboarding.tsx';
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

/** Rapikan nilai pengaturan lama / hasil impor supaya selalu dalam batas yang valid */
function normalizeSettings(x: BotSettings): BotSettings {
  const num = (v: any, d: number, min: number, max: number) => {
    const n = Number(v);
    return isFinite(n) ? Math.max(min, Math.min(max, n)) : d;
  };
  return {
    ...x,
    botMode: ['turbo', 'stealth', 'ai'].includes(x.botMode as any) ? x.botMode : 'turbo',
    threadCount: num(x.threadCount, 4, 1, 24),
    pollRate: Number(x.pollRate) < 2000 ? 5000 : num(x.pollRate, 5000, 2000, 60000),
    maxRetry: num(x.maxRetry, 2, 0, 9),
    retryDelay: num(x.retryDelay, 300, 0, 5000),
    openLeadMs: num(x.openLeadMs, 800, 0, 3000),
    openMode: x.openMode === 'browser' ? 'browser' : 'app',
    runMode: x.runMode === 'practice' ? 'practice' : 'open',
  };
}

export const App: React.FC = () => {
  const { lang, setLang, L, locale } = useLang();
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
  const [showOnboarding, setShowOnboarding] = useState(false);
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

  // ASEAN Cross-Border State (divalidasi: nilai localStorage rusak tidak bikin crash)
  const [selectedRegion, setSelectedRegion] = useState<AseanCountryCode>(() => {
    try {
      const saved = localStorage.getItem('ganemax_asean_region');
      return isAseanCode(saved) ? saved : 'ID';
    } catch {
      return 'ID';
    }
  });

  // Akun & alamat yang dipakai saat war (disimpan per perangkat)
  const [selectedAccountId, setSelectedAccountId] = useState<string>(() => {
    try {
      return localStorage.getItem('gx_selected_account') || '';
    } catch {
      return '';
    }
  });
  const [selectedAddressId, setSelectedAddressId] = useState<string>(() => {
    try {
      return localStorage.getItem('gx_selected_address') || '';
    } catch {
      return '';
    }
  });
  const handleSelectAccount = (id: string) => {
    setSelectedAccountId(id);
    try {
      localStorage.setItem('gx_selected_account', id);
    } catch {}
  };
  const handleSelectAddress = (id: string) => {
    setSelectedAddressId(id);
    try {
      localStorage.setItem('gx_selected_address', id);
    } catch {}
  };

  // Pakai wilayah yang tersimpan di akun kalau perangkat ini belum pernah memilih
  useEffect(() => {
    let hasLocal = false;
    try {
      hasLocal = !!localStorage.getItem('ganemax_asean_region');
    } catch {}
    if (!hasLocal && isAseanCode(currentUser?.preferred_region)) setSelectedRegion(currentUser!.preferred_region!);
  }, [currentUser?.preferred_region]);

  const handleSelectRegion = (region: AseanCountryCode) => {
    if (!isAseanCode(region) || region === selectedRegion) return;
    const reg = ASEAN_REGIONS[region];
    // Jadwal auto-start dihitung dari zona waktu wilayah lama → batalkan supaya tidak meleset
    if (armed) {
      setArmed(null);
      addLog(L('[SCHEDULER] Jadwal auto-start dibatalkan karena wilayah diganti. Pilih ulang sesi.', '[SCHEDULER] Auto-start cancelled because region changed. Pick the session again.'), 'warning');
    }
    setSelectedRegion(region);
    setLatency({ history: [], last: null, status: null, reachable: null, checkedAt: null });
    try {
      localStorage.setItem('ganemax_asean_region', region);
    } catch {}
    addLog(
      L(
        `[WILAYAH] Shopee ${reg.name} (${reg.domain}) · mata uang ${reg.currency} · zona ${reg.timezoneLabel} · sesi ${reg.flashSaleSchedule.join(', ')}`,
        `[REGION] Shopee ${reg.name} (${reg.domain}) · currency ${reg.currency} · timezone ${reg.timezoneLabel} · sessions ${reg.flashSaleSchedule.join(', ')}`
      ),
      'info'
    );
    // Simpan preferensi wilayah ke akun (dipakai di perangkat lain)
    if (currentUser) {
      api.put('users', currentUser.id, { preferred_region: region }).catch(() => {});
    }
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
      text: readLang() === 'en' ? '[SYSTEM] GaneMaX.Ai dashboard ready. Gateway & server clock monitor running.' : '[SYSTEM] Dashboard GaneMaX.Ai siap. Monitor gateway & jam server berjalan.',
      type: 'info',
    },
  ]);

  // Bot Settings
  const [botSettings, setBotSettings] = useState<BotSettings>(() => {
    const base: BotSettings = {
    botMode: 'turbo',
    threadCount: 4,
    pollRate: 5000,
    smartFallback: 'spaylater',
    preFireJitter: -15,
    multiAccMode: 'single',
    userAgentPreset: 'android_app_v2',
    capSolverApiKey: '',
    executionMode: 'aggressive',
    maxRetry: 2,
    retryDelay: 300,
    whitelist: '',
    blacklist: '',
    notifySuccess: true,
    notifyError: true,
    notifyRateLimit: true,
    openLeadMs: 800,
    openMode: "app",
    runMode: "open",
    soundAlert: true,
    vibrateAlert: true,
  };
    try {
      const saved = JSON.parse(localStorage.getItem('gx_bot_settings') || 'null');
      return normalizeSettings(saved && typeof saved === 'object' ? { ...base, ...saved } : base);
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
    if (currentUser && !hasOnboarded()) {
      const t = window.setTimeout(() => setShowOnboarding(true), 600);
      return () => window.clearTimeout(t);
    }
  }, [currentUser?.id]);

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
        addLog(L('[SYSTEM] Musik latar dihentikan.', '[SYSTEM] Background music stopped.'), 'info');
      } else {
        audioRef.current
          .play()
          .then(() => {
            setIsPlayingMusic(true);
            addLog(L('[SYSTEM] Musik latar diputar.', '[SYSTEM] Background music playing.'), 'info');
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
        addLog(L(`[SYSTEM] Selamat datang, ${res.data.user.username}!`, `[SYSTEM] Welcome, ${res.data.user.username}!`), 'success');
        setIsLoginLoading(false);
        return true;
      }
    } catch (err: any) {
      addLog(L(`[SYSTEM] Login gagal: ${err.message}`, `[SYSTEM] Login failed: ${err.message}`), 'error');
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
    addLog(L('[SYSTEM] Kamu sudah keluar.', '[SYSTEM] You have logged out.'), 'info');
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
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) || accounts.find((a) => !a.region || a.region === selectedRegion) || accounts[0] || null;
  const selectedAddress = addresses.find((a) => a.id === selectedAddressId) || addresses.find((a) => a.is_default) || addresses[0] || null;
  const botMode = botSettings.botMode || 'turbo';
  const runMode: 'open' | 'practice' = botSettings.runMode === 'practice' ? 'practice' : 'open';
  const avgLatency = latency.history.length ? latency.history.reduce((x, y) => x + y, 0) / latency.history.length : null;
  const manualLead = Math.max(0, Math.min(5000, Number(botSettings.openLeadMs ?? 800)));
  // Mode AI: jeda buka dihitung dari latensi gateway yang terukur
  const openLeadMs = botMode === 'ai' && avgLatency != null ? Math.round(Math.max(300, Math.min(2500, 500 + avgLatency * 2)) / 50) * 50 : manualLead;
  const standbyPollMs = botMode === 'stealth' ? 30000 : Math.max(2000, Number(botSettings.pollRate) || 5000);
  const pingSamples = Math.max(1, Math.min(8, Number(botSettings.threadCount) || 1, licenseThreadCap));
  const tz = (code: AseanCountryCode) => (ASEAN_REGIONS[code] || ASEAN_REGIONS.ID).timezone;
  const stamp = (n: number) => `${formatClock(n, tz(selectedRegion))}.${String(n % 1000).padStart(3, '0')}`;

  const notify = (kind: 'success' | 'error' | 'ratelimit', title: string, body: string) => {
    const allowed = kind === 'success' ? botSettings.notifySuccess !== false : kind === 'error' ? botSettings.notifyError !== false : botSettings.notifyRateLimit !== false;
    if (!allowed || !('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      new Notification(title, { body });
    } catch {}
  };

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

  // --- Suara, getar, wake lock ---
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
        addLog(L('[SYSTEM] Browser tidak mendukung Wake Lock — jaga layar tetap menyala.', '[SYSTEM] Browser does not support Wake Lock — keep the screen on.'), 'warning');
        return;
      }
      wakeLockRef.current = await wl.request('screen');
      addLog(L('[SYSTEM] Wake Lock aktif: layar tidak akan mati selama menunggu sesi.', '[SYSTEM] Wake Lock on: screen stays awake until the session.'), 'info');
    } catch (e: any) {
      addLog(L(`[SYSTEM] Wake Lock ditolak browser (${e?.name || 'error'}).`, `[SYSTEM] Wake Lock denied by browser (${e?.name || 'error'}).`), 'warning');
    }
  };
  const releaseWakeLock = () => {
    try {
      wakeLockRef.current?.release?.();
    } catch {}
    wakeLockRef.current = null;
  };

  const [fireState, setFireState] = useState<FireState | null>(null);
  const [practiceState, setPracticeState] = useState<PracticeState | null>(null);

  // --- Pemeriksaan sebelum war ---
  const runPrechecks = async (): Promise<boolean> => {
    const reg = ASEAN_REGIONS[selectedRegion] || ASEAN_REGIONS.ID;
    const t = selectedTarget;
    const acc = selectedAccount;
    setEnginePhase('sync');
    addLog(
      runMode === 'practice'
        ? L(`[LATIHAN] Sesi latihan dimulai · Shopee ${reg.name} (${reg.domain}) · mode ${botMode.toUpperCase()} · Shopee tidak dibuka`, `[PRACTICE] Practice session started · Shopee ${reg.name} (${reg.domain}) · ${botMode.toUpperCase()} mode · Shopee will not be opened`)
        : L(`[WAR] Sesi war dimulai · Shopee ${reg.name} (${reg.domain}) · mode ${botMode.toUpperCase()}`, `[WAR] War session started · Shopee ${reg.name} (${reg.domain}) · ${botMode.toUpperCase()} mode`),
      'info'
    );
    addLog(L(`[WAR] Target: ${t?.title || '-'}`, `[WAR] Target: ${t?.title || '-'}`), 'info');
    if (t && isAseanCode(t.region) && t.region !== reg.code) {
      addLog(L(`[WILAYAH] Target ini dari Shopee ${ASEAN_REGIONS[t.region].name}, sedangkan wilayah aktif ${reg.name}. Jam sesi mengikuti wilayah aktif.`, `[REGION] This target is from Shopee ${ASEAN_REGIONS[t.region].name}, but the active region is ${reg.name}. Session times follow the active region.`), 'warning');
    }
    addLog(
      acc ? L(`[AKUN] Memakai akun ${acc.nickname} (@${acc.username})${acc.cookies ? ' · cookies tersedia' : ' · tanpa cookies'}`, `[ACCOUNT] Using ${acc.nickname} (@${acc.username})${acc.cookies ? ' · cookies available' : ' · no cookies'}`) : L('[AKUN] Belum ada akun dipilih — cek produk tanpa login.', '[ACCOUNT] No account selected — product check without login.'),
      acc ? 'info' : 'warning'
    );
    if (selectedAddress) addLog(L(`[ALAMAT] ${selectedAddress.label} · ${selectedAddress.recipient_name}`, `[ADDRESS] ${selectedAddress.label} · ${selectedAddress.recipient_name}`), 'info');
    if (paymentSettings?.payment_method) addLog(L(`[BAYAR] Metode ${paymentSettings.payment_method.toUpperCase()}${paymentSettings.custom_voucher_code ? ` · voucher ${paymentSettings.custom_voucher_code}` : ''}`, `[PAYMENT] Method ${paymentSettings.payment_method.toUpperCase()}${paymentSettings.custom_voucher_code ? ` · voucher ${paymentSettings.custom_voucher_code}` : ''}`), 'info');

    addLog(L('[NTP] Sinkronisasi jam ke server bot (3 sampel)…', '[NTP] Syncing clock with bot server (3 samples)…'), 'info');
    const sync = await clock.resync();
    if (!isRunningRef.current) return false;
    sync.samples.forEach((sm, i) => addLog(L(`[NTP] Sampel #${i + 1}: RTT ${sm.rtt} ms · selisih ${sm.offset > 0 ? '+' : ''}${sm.offset} ms`, `[NTP] Sample #${i + 1}: RTT ${sm.rtt} ms · offset ${sm.offset > 0 ? '+' : ''}${sm.offset} ms`), 'info'));
    if (sync.best) addLog(L(`[NTP] Jam terkunci ke server. Akurasi ±${Math.ceil(sync.best.rtt / 2)} ms.`, `[NTP] Clock locked to server. Accuracy ±${Math.ceil(sync.best.rtt / 2)} ms.`), 'success');
    else addLog(L('[NTP] Gagal sinkron — memakai jam perangkat.', '[NTP] Sync failed — using device clock.'), 'warning');

    const lic = await api.sessionStart();
    if (!isRunningRef.current) return false;
    if (!lic.success) {
      addLog(`[LICENSE] ${lic.error?.message || 'invalid'}`, 'error');
      toast.show(lic.error?.message || L('Lisensi tidak valid', 'Invalid license'));
      notify('error', 'GaneMaX.Ai', lic.error?.message || '');
      finishRun('error');
      return false;
    }
    addLog(L('[LISENSI] Lisensi aktif terverifikasi di server.', '[LICENSE] Active license verified by server.'), 'success');

    setEnginePhase('warm');
    addLog(L(`[GATEWAY] Mengukur ${reg.domain} dengan ${pingSamples} request paralel…`, `[GATEWAY] Measuring ${reg.domain} with ${pingSamples} parallel requests…`), 'info');
    const pings = await Promise.all(Array.from({ length: pingSamples }, () => api.pingGateway(reg.code)));
    if (!isRunningRef.current) return false;
    const okPings = pings.filter((p) => p.success && p.data && p.data.reachable !== false).map((p) => p.data!);
    if (okPings.length) {
      const lats = okPings.map((p) => p.latency_ms);
      const min = Math.min(...lats);
      const avg = Math.round(lats.reduce((x, y) => x + y, 0) / lats.length);
      setServerLatency(min);
      addLog(L(`[GATEWAY] ${okPings.length}/${pingSamples} terjawab · HTTP ${okPings[0].status} · min ${min} ms · rata-rata ${avg} ms`, `[GATEWAY] ${okPings.length}/${pingSamples} answered · HTTP ${okPings[0].status} · min ${min} ms · avg ${avg} ms`), 'info');
      if (okPings.some((p) => p.status === 429)) {
        addLog(L('[GATEWAY] Shopee membatasi request (HTTP 429). Kurangi thread paralel.', '[GATEWAY] Shopee is rate limiting (HTTP 429). Lower parallel threads.'), 'warning');
        notify('ratelimit', 'GaneMaX.Ai', 'HTTP 429');
      }
    } else {
      addLog(L(`[GATEWAY] ${reg.domain} tidak terjangkau dari server bot. Shopee tetap dibuka langsung dari HP kamu.`, `[GATEWAY] ${reg.domain} unreachable from bot server. Shopee will still open directly on your phone.`), 'warning');
    }
    if (botMode === 'ai') addLog(L(`[AI] Jeda buka otomatis: ${openLeadMs} ms (dari latensi terukur).`, `[AI] Auto open lead: ${openLeadMs} ms (from measured latency).`), 'info');

    if (t?.url) {
      const ids = parseShopeeLink(t.url);
      addLog(ids ? L(`[PRODUK] Link valid · shopid ${ids.shopId} · itemid ${ids.itemId}`, `[PRODUCT] Valid link · shopid ${ids.shopId} · itemid ${ids.itemId}`) : L('[PRODUK] Link pendek — dibuka apa adanya.', '[PRODUCT] Short link — opened as is.'), ids ? 'info' : 'warning');
      if (ids && botMode !== 'stealth') {
        const tries = Math.max(1, Math.min(10, (Number(botSettings.maxRetry) || 0) + 1));
        let got = false;
        for (let i = 1; i <= tries && !got; i++) {
          addLog(L(`[PRODUK] Mengambil data produk dari Shopee (percobaan ${i}/${tries})…`, `[PRODUCT] Fetching product data from Shopee (attempt ${i}/${tries})…`), 'info');
          const tRegion = isAseanCode(t.region) ? t.region : reg.code;
          const ck = await api.checkItem(tRegion, t.url, acc?.id);
          if (!isRunningRef.current) return false;
          const d = ck.data;
          if (ck.success && d?.item) {
            got = true;
            const it = d.item;
            addLog(`[PRODUK] ${it.name}${d.with_cookies ? L(' · via akun', ' · via account') : ''}`, 'success');
            if (it.price != null) addLog(L(`[PRODUK] Harga sekarang ${formatAseanCurrency(it.price, tRegion)}${it.stock != null ? ` · stok ${it.stock}` : ''}`, `[PRODUCT] Current price ${formatAseanCurrency(it.price, tRegion)}${it.stock != null ? ` · stock ${it.stock}` : ''}`), 'info');
            if (it.flash_sale) {
              const fs = it.flash_sale;
              addLog(
                L(
                  `[FLASH] Flash sale terdeteksi${fs.price != null ? ` · harga ${formatAseanCurrency(fs.price, tRegion)}` : ''}${fs.stock != null ? ` · kuota ${fs.stock}` : ''}${fs.start_time ? ` · mulai ${new Date(fs.start_time).toLocaleTimeString(locale)}` : ''}`,
                  `[FLASH] Flash sale detected${fs.price != null ? ` · price ${formatAseanCurrency(fs.price, tRegion)}` : ''}${fs.stock != null ? ` · quota ${fs.stock}` : ''}${fs.start_time ? ` · starts ${new Date(fs.start_time).toLocaleTimeString(locale)}` : ''}`
                ),
                'success'
              );
            } else addLog(L('[FLASH] Belum ada data flash sale untuk produk ini.', '[FLASH] No flash sale data for this product yet.'), 'info');
          } else {
            const why = d ? d.reason || `HTTP ${d.status}` : ck.error?.message || 'error';
            addLog(L(`[PRODUK] Ditolak/gagal: ${why}`, `[PRODUCT] Refused/failed: ${why}`), 'warning');
            if (d?.status === 429) notify('ratelimit', 'GaneMaX.Ai', 'HTTP 429');
            if (i < tries) await new Promise((r) => setTimeout(r, Math.max(0, Number(botSettings.retryDelay) || 0)));
          }
        }
        if (!got) addLog(L('[PRODUK] Lanjut tanpa data stok.', '[PRODUCT] Continuing without stock data.'), 'info');
      }
    }
    setEnginePhase('armed');
    return true;
  };

  // --- Detik 0: buka Shopee ---
  const fire = (scheduledEpoch: number | null) => {
    const t = selectedTarget;
    if (!t?.url) {
      addLog(L('[ERROR] Target tidak punya link produk.', '[ERROR] Target has no product link.'), 'error');
      finishRun('error');
      return;
    }
    setEnginePhase('fire');
    const now = clock.now();
    const delta = scheduledEpoch != null ? now - scheduledEpoch : null;

    if (runMode === 'practice') {
      const zeroAt = scheduledEpoch != null ? scheduledEpoch + openLeadMs : now;
      beep(1320, 220);
      vibrate([200, 80, 200]);
      addLog(
        L(
          `[LATIHAN] Tahap buka tercapai · jam server ${stamp(now)} · presisi timer ${delta != null ? `${delta >= 0 ? '+' : ''}${delta} ms` : '—'} · menunggu tap kamu`,
          `[PRACTICE] Open stage reached · server time ${stamp(now)} · timer precision ${delta != null ? `${delta >= 0 ? '+' : ''}${delta} ms` : '—'} · waiting for your tap`
        ),
        'warning'
      );
      releaseWakeLock();
      setPracticeState({ title: t.title, zeroAt, timerDeltaMs: delta, leadMs: openLeadMs });
      isRunningRef.current = false;
      setIsBotRunning(false);
      setEnginePhase('done');
      return;
    }

    const mode = botSettings.openMode === 'browser' ? 'browser' : 'app';
    const targetRegion = isAseanCode(t.region) ? t.region : selectedRegion;
    const { href, via } = buildOpenUrl(t.url, targetRegion, mode);
    beep(1320, 220);
    vibrate([200, 80, 200]);
    if (scheduledEpoch != null) {
      addLog(L(`[FIRE] Membuka Shopee ${openLeadMs} ms sebelum sesi · jam server ${stamp(now)} · presisi timer ${delta! >= 0 ? '+' : ''}${delta} ms`, `[FIRE] Opening Shopee ${openLeadMs} ms before session · server time ${stamp(now)} · timer precision ${delta! >= 0 ? '+' : ''}${delta} ms`), 'warning');
      const zeroAt = scheduledEpoch + openLeadMs;
      const tZero = window.setTimeout(() => {
        const n = clock.now();
        addLog(L(`[T-0] Detik 0 sesi · jam server ${stamp(n)} (selisih ${n - zeroAt >= 0 ? '+' : ''}${n - zeroAt} ms)`, `[T-0] Second zero · server time ${stamp(n)} (offset ${n - zeroAt >= 0 ? '+' : ''}${n - zeroAt} ms)`), 'warning');
      }, Math.max(0, zeroAt - now));
      botTimeoutsRef.current.push(tZero);
    } else {
      addLog(L(`[FIRE] Buka manual · jam server ${stamp(now)}`, `[FIRE] Manual open · server time ${stamp(now)}`), 'warning');
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
    addLog(
      autoOpened
        ? L(`[OPEN] Shopee dibuka otomatis lewat ${via}.`, `[OPEN] Shopee opened automatically via ${via}.`)
        : L(`[OPEN] Tekan tombol "Buka Shopee" — ${href.startsWith('intent:') ? 'Android butuh satu sentuhan untuk masuk app' : 'browser memblokir pembukaan otomatis'}.`, `[OPEN] Tap "Open Shopee" — ${href.startsWith('intent:') ? 'Android needs one tap to enter the app' : 'the browser blocked auto-open'}.`),
      autoOpened ? 'success' : 'warning'
    );
    releaseWakeLock();
    setStats((p) => ({ ...p, attempts: p.attempts + 1 }));
    setFireState({
      target: t,
      href,
      via,
      autoOpened,
      scheduledEpoch,
      firedAt: now,
      region: targetRegion,
      accountLabel: selectedAccount ? `${selectedAccount.nickname} (@${selectedAccount.username})` : '',
      addressLabel: selectedAddress ? `${selectedAddress.label} · ${selectedAddress.recipient_name}` : '',
      paymentLabel: paymentSettings?.payment_method ? paymentSettings.payment_method.split('_')[0].toUpperCase() : '',
      voucher: paymentSettings?.custom_voucher_code || '',
    });
    isRunningRef.current = false;
    setIsBotRunning(false);
    setEnginePhase('done');
    addLog(L('[WAR] Menunggu konfirmasi hasil checkout…', '[WAR] Waiting for checkout result confirmation…'), 'info');
    if (document.visibilityState !== 'visible') notify('success', L('Sesi flash sale dimulai!', 'Flash sale session started!'), t.title);
  };

  const guardStart = (): boolean => {
    if (currentUser && currentUser.role !== 'admin' && currentUser.expired_at) {
      const exp = new Date(currentUser.expired_at).getTime();
      if (!isNaN(exp) && exp < Date.now()) {
        addLog(L('[LISENSI] Masa aktif lisensi habis. Perpanjang via QRIS.', '[LICENSE] License expired. Renew via QRIS.'), 'error');
        toast.show(L('Lisensi habis — perpanjang dulu', 'License expired — renew first'));
        return false;
      }
    }
    if (!selectedTarget) {
      addLog(L('[SETUP] Belum ada target produk. Tambahkan di tab Target.', '[SETUP] No target product yet. Add one in the Target tab.'), 'error');
      toast.show(L('Tambahkan target produk dulu', 'Add a target product first'));
      return false;
    }
    if (!isValidHttpUrl(selectedTarget.url)) {
      addLog(L('[SETUP] Link target tidak valid.', '[SETUP] Target link is invalid.'), 'error');
      toast.show(L('Link target tidak valid', 'Invalid target link'));
      return false;
    }
    return true;
  };

  const handleStartBot = async () => {
    if (isRunningRef.current) return;
    if (!guardStart()) return;
    primeAlerts();
    clearBotTimers();
    isRunningRef.current = true;
    setIsBotRunning(true);
    const ok = await runPrechecks();
    if (!ok || !isRunningRef.current) return;
    if (runMode === 'practice') {
      // Latihan manual: hitung mundur 5 detik lalu bot jalan sendiri seperti sesi sungguhan
      const zeroAt = clock.now() + 5000;
      addLog(L('[LATIHAN] Hitung mundur 5 detik ke detik 0 latihan…', '[PRACTICE] Counting down 5 seconds to practice zero…'), 'info');
      for (let sec = 3; sec >= 1; sec--) {
        const tm = window.setTimeout(() => {
          addLog(`[COUNTDOWN] T-${sec}`, 'warning');
          beep(880, 90);
        }, Math.max(0, zeroAt - sec * 1000 - clock.now()));
        botTimeoutsRef.current.push(tm);
      }
      const tf = window.setTimeout(() => {
        if (isRunningRef.current) fireRef.current(zeroAt - openLeadMs);
      }, Math.max(0, zeroAt - openLeadMs - clock.now()));
      botTimeoutsRef.current.push(tf);
      return;
    }
    fire(null);
  };

  const handleStopBot = () => {
    const wasRunning = isRunningRef.current;
    clearBotTimers();
    finishRun('idle');
    releaseWakeLock();
    if (wasRunning) addLog(L('[WAR] Sesi dihentikan.', '[WAR] Session stopped.'), 'warning');
  };

  const startRef = useRef<() => void>(() => {});

  // --- Auto-start terjadwal ---
  const precheckStartedRef = useRef(false);
  const milestonesRef = useRef<Set<string>>(new Set());
  const fireRef = useRef(fire);
  fireRef.current = fire;
  startRef.current = handleStartBot;
  const precheckRef = useRef(runPrechecks);
  precheckRef.current = runPrechecks;
  const logRef = useRef({ addLog, L, beep });
  logRef.current = { addLog, L, beep };

  useEffect(() => {
    if (!armed) return;
    precheckStartedRef.current = false;
    milestonesRef.current = new Set();
    const id = window.setInterval(() => {
      const { addLog: log, L: tr, beep: bp } = logRef.current;
      const remain = armed.epoch - clock.now();
      const fireAt = remain - openLeadMs;
      const mark = (k: string, text: string, type: 'info' | 'warning' = 'info') => {
        if (milestonesRef.current.has(k)) return;
        milestonesRef.current.add(k);
        log(text, type);
      };
      for (const m of [600, 300, 120, 60, 30]) {
        if (remain <= m * 1000 && remain > (m - 1) * 1000) {
          const lbl = m >= 60 ? tr(`${m / 60} menit`, `${m / 60} min`) : tr(`${m} dtk`, `${m} s`);
          mark(`m${m}`, tr(`[COUNTDOWN] T-${lbl} menuju sesi ${armed.label}`, `[COUNTDOWN] T-${lbl} to session ${armed.label}`));
        }
      }
      if (remain <= 10_000 && remain > 0) {
        const sec = Math.ceil(remain / 1000);
        if (!milestonesRef.current.has(`s${sec}`)) {
          mark(`s${sec}`, `[COUNTDOWN] T-${sec}`, sec <= 3 ? 'warning' : 'info');
          if (sec <= 3) bp(880, 90);
        }
      }
      if (remain <= 60_000 && !precheckStartedRef.current) {
        precheckStartedRef.current = true;
        isRunningRef.current = true;
        setIsBotRunning(true);
        precheckRef.current().then((ok) => {
          if (ok) log(tr(`[STANDBY] Semua siap. Shopee dibuka ${openLeadMs} ms sebelum ${armed.label}.`, `[STANDBY] All set. Shopee opens ${openLeadMs} ms before ${armed.label}.`), 'success');
        });
      }
      if (fireAt <= 0) {
        window.clearInterval(id);
        setArmed(null);
        if (remain > -60_000) {
          if (!isRunningRef.current && precheckStartedRef.current) return;
          isRunningRef.current = true;
          fireRef.current(armed.epoch - openLeadMs);
        } else {
          log(tr(`[SCHEDULER] Jadwal ${armed.label} terlewat (HP tidur / tab tertutup).`, `[SCHEDULER] Schedule ${armed.label} missed (phone asleep / tab closed).`), 'error');
          finishRun('error');
        }
      }
    }, 25);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armed, openLeadMs]);

  const handleArm = (a: ArmState) => {
    if (!guardStart()) return;
    if (a.epoch - clock.now() <= openLeadMs + 1000) {
      toast.show(L('Waktu terlalu dekat, pilih sesi lain', 'Too close, pick another session'));
      return;
    }
    primeAlerts();
    setArmed(a);
    addLog(L(`[SCHEDULER] Auto-start sesi ${a.label}. Cek mulai T-60 dtk, Shopee dibuka ${openLeadMs} ms sebelum detik 0.`, `[SCHEDULER] Auto-start for ${a.label}. Checks start at T-60 s, Shopee opens ${openLeadMs} ms before second zero.`), 'info');
    addLog(L('[SCHEDULER] Biarkan halaman ini terbuka & layar menyala.', '[SCHEDULER] Keep this page open and the screen on.'), 'info');
    requestWakeLock();
    toast.show(L(`Auto-start ${a.label} aktif — biarkan halaman terbuka`, `Auto-start ${a.label} on — keep this page open`));
  };
  const handleDisarm = () => {
    if (armed) addLog(L(`[SCHEDULER] Jadwal ${armed.label} dibatalkan.`, `[SCHEDULER] Schedule ${armed.label} cancelled.`), 'info');
    setArmed(null);
    releaseWakeLock();
    if (isRunningRef.current) finishRun('idle');
  };

  // Jadwal tersimpan → auto-start
  const handleUseSchedule = (sc: Schedule) => {
    const epoch = new Date(sc.target_time).getTime();
    if (isNaN(epoch) || epoch <= clock.now() + openLeadMs + 1000) {
      toast.show(L('Jadwal ini sudah lewat', 'This schedule has passed'));
      return;
    }
    handleArm({ epoch, label: formatClock(epoch, tz(selectedRegion)).slice(0, 5) });
    setCurrentTab('dashboard');
  };

  // --- Hasil latihan ---
  const handlePracticeDone = (r: PracticeResult | null) => {
    if (r) {
      addLog(
        L(
          `[LATIHAN] Waktu reaksi ${r.reactionMs} ms${r.reactionMs < 0 ? ' (tap sebelum detik 0)' : ''} · presisi timer ${r.timerDeltaMs != null ? `${r.timerDeltaMs >= 0 ? '+' : ''}${r.timerDeltaMs} ms` : '—'}`,
          `[PRACTICE] Reaction ${r.reactionMs} ms${r.reactionMs < 0 ? ' (tapped before zero)' : ''} · timer precision ${r.timerDeltaMs != null ? `${r.timerDeltaMs >= 0 ? '+' : ''}${r.timerDeltaMs} ms` : '—'}`
        ),
        'success'
      );
      return; // overlay tetap tampil untuk lihat hasil
    }
    setPracticeState(null);
    setEnginePhase('idle');
  };
  const handlePracticeRetry = () => {
    setPracticeState(null);
    setEnginePhase('idle');
    window.setTimeout(() => startRef.current(), 50);
  };

  // --- Konfirmasi hasil ---
  const handleConfirmResult = async (r: { success: boolean; orderSn?: string; price?: number; note?: string }) => {
    if (!fireState) return;
    const t = fireState.target;
    if (r.success) {
      const res = await api.confirmOrder({
        region: fireState.region,
        targetTitle: t.title,
        price: r.price ?? targetPriceFor(t),
        orderSn: r.orderSn,
        paymentMethod: paymentSettings?.payment_method ? paymentFamily(paymentSettings.payment_method) : '',
        openDelayMs: fireState.scheduledEpoch != null ? fireState.firedAt - fireState.scheduledEpoch : null,
        targetUrl: t.url,
      });
      if (res.success) {
        addLog(L(`[HASIL] Checkout dikonfirmasi${r.orderSn ? ` · no. pesanan ${r.orderSn}` : ''} · tersimpan di riwayat.`, `[RESULT] Checkout confirmed${r.orderSn ? ` · order no. ${r.orderSn}` : ''} · saved to history.`), 'success');
        setStats((p) => ({ ...p, success: p.success + 1 }));
        notify('success', L('Checkout berhasil', 'Checkout success'), t.title);
        loadUserData();
      } else {
        addLog(L(`[HASIL] Gagal menyimpan: ${res.error?.message || 'error'}`, `[RESULT] Failed to save: ${res.error?.message || 'error'}`), 'error');
        toast.show(res.error?.message || 'Error');
        return;
      }
    } else {
      addLog(L('[HASIL] Tidak dapat (kehabisan / gagal). Coba sesi berikutnya.', '[RESULT] Missed (sold out / failed). Try the next session.'), 'warning');
    }
    setFireState(null);
    setEnginePhase('idle');
  };

  // --- Monitor nyala terus ---
  useEffect(() => {
    if (!currentUser) return;
    let alive = true;
    let timer: number | undefined;
    const reg = ASEAN_REGIONS[selectedRegion] || ASEAN_REGIONS.ID;
    const tick = async () => {
      if (document.visibilityState === 'visible') {
        const res = await api.pingGateway(selectedRegion);
        if (!alive) return;
        const { addLog: log, L: tr } = logRef.current;
        if (res.success && res.data) {
          const d = res.data;
          setLatency((prev) => ({
            history: d.reachable === false ? prev.history : [...prev.history, d.latency_ms].slice(-40),
            last: d.reachable === false ? null : d.latency_ms,
            status: d.status,
            reachable: d.reachable !== false,
            checkedAt: Date.now(),
          }));
          log(
            d.reachable === false ? tr(`[GATEWAY] ${reg.domain} tidak terjangkau dari server bot (${d.latency_ms} ms)`, `[GATEWAY] ${reg.domain} unreachable from bot server (${d.latency_ms} ms)`) : `[GATEWAY] ${reg.domain} → HTTP ${d.status} · ${d.latency_ms} ms`,
            d.reachable === false ? 'warning' : 'info'
          );
        } else {
          log(tr(`[GATEWAY] Server bot tidak merespons: ${res.error?.message || 'error'}`, `[GATEWAY] Bot server not responding: ${res.error?.message || 'error'}`), 'error');
        }
      }
      if (alive) timer = window.setTimeout(tick, isRunningRef.current || armed ? standbyPollMs : 20000);
    };
    tick();
    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, selectedRegion, armed, standbyPollMs]);

  useEffect(() => {
    if (!currentUser) return;
    const id = window.setInterval(() => {
      const { addLog: log, L: tr } = logRef.current;
      const reg = ASEAN_REGIONS[selectedRegion] || ASEAN_REGIONS.ID;
      const nxt = getNextSession(clock.now(), reg.flashSaleSchedule, reg.timezone);
      if (!nxt) return;
      const mins = Math.max(0, Math.round((nxt.epoch - clock.now()) / 60000));
      const dur = mins >= 60 ? tr(`${Math.floor(mins / 60)} jam ${mins % 60} mnt`, `${Math.floor(mins / 60)} h ${mins % 60} min`) : tr(`${mins} mnt`, `${mins} min`);
      log(tr(`[MONITOR] Sesi berikutnya ${nxt.label} ${reg.timezoneLabel.split(' ')[0]} · ${dur} lagi${armed ? ' · auto-start AKTIF' : ''}`, `[MONITOR] Next session ${nxt.label} ${reg.timezoneLabel.split(' ')[0]} · in ${dur}${armed ? ' · auto-start ON' : ''}`), 'info');
    }, 60_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, selectedRegion, armed]);

  useEffect(() => {
    const onVis = () => {
      if (!armed && !isRunningRef.current) return;
      const { addLog: log, L: tr } = logRef.current;
      if (document.visibilityState === 'hidden') log(tr('[SYSTEM] Tab disembunyikan — timer browser bisa melambat. Kembali sebelum sesi.', '[SYSTEM] Tab hidden — browser timers may slow down. Come back before the session.'), 'warning');
      else {
        log(tr('[SYSTEM] Tab aktif kembali. Sinkron ulang jam…', '[SYSTEM] Tab active again. Re-syncing clock…'), 'info');
        if (armed) requestWakeLock();
      }
    };
    const onOff = () => logRef.current.addLog(logRef.current.L('[NETWORK] Koneksi internet terputus!', '[NETWORK] Internet connection lost!'), 'error');
    const onOn = () => logRef.current.addLog(logRef.current.L('[NETWORK] Koneksi internet kembali.', '[NETWORK] Internet connection restored.'), 'success');
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

  clockLogRef.current = (r: SyncResult, manual: boolean) => {
    if (manual || !r.best) return;
    addLog(L(`[NTP] Jam disinkron ulang · RTT ${r.best.rtt} ms · selisih ${r.best.offset > 0 ? '+' : ''}${r.best.offset} ms`, `[NTP] Clock re-synced · RTT ${r.best.rtt} ms · offset ${r.best.offset > 0 ? '+' : ''}${r.best.offset} ms`), 'info');
  };

  // Bersihkan timer saat komponen dilepas
  useEffect(() => () => {
    clearBotTimers();
    releaseWakeLock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // CRUD Operations with Persistence
  // ---------------- CRUD (melempar error supaya modal menampilkan pesan & tidak tertutup) ----------------
  const failMsg = (res: { error?: { message?: string } }) => res.error?.message || L('Gagal menyimpan ke server.', 'Failed to save to server.');

  const handleSaveAddress = async (data: Partial<Address>) => {
    const editingId = activeAddress?.id;
    const res = editingId ? await api.put<Address>('addresses', editingId, data) : await api.post<Address>('addresses', data);
    if (!res.success || !res.data) throw new Error(failMsg(res));
    const saved = res.data;
    // Hanya satu alamat utama
    if (saved.is_default) {
      const others = addresses.filter((a) => a.id !== saved.id && a.is_default);
      await Promise.all(others.map((o) => api.put('addresses', o.id, { is_default: false })));
    }
    setAddresses((prev) => {
      const list = editingId ? prev.map((a) => (a.id === editingId ? saved : a)) : [saved, ...prev];
      return saved.is_default ? list.map((a) => (a.id === saved.id ? a : { ...a, is_default: false })) : list;
    });
    addLog(editingId ? L(`[DATA] Alamat "${saved.label}" diperbarui.`, `[DATA] Address "${saved.label}" updated.`) : L(`[DATA] Alamat "${saved.label}" ditambahkan.`, `[DATA] Address "${saved.label}" added.`), 'success');
  };

  const handleDeleteAddress = async (id: string) => {
    if (!confirm(L('Hapus alamat ini?', 'Delete this address?'))) return;
    const res = await api.delete('addresses', id);
    if (res.success) {
      setAddresses((prev) => prev.filter((a) => a.id !== id));
      addLog(L('[DATA] Alamat dihapus.', '[DATA] Address deleted.'), 'info');
    } else toast.show(failMsg(res));
  };

  const accountQuota = currentUser?.role === 'admin' ? 999 : currentUser?.max_accounts || 5;

  const handleSaveAccount = async (data: Partial<ShopeeAccount>) => {
    const editingId = activeAccount?.id;
    if (!editingId && accounts.length >= accountQuota) {
      addLog(L(`[LISENSI] Kuota akun penuh (${accountQuota}). Upgrade paket untuk menambah slot.`, `[LICENSE] Account quota full (${accountQuota}). Upgrade your plan for more slots.`), 'error');
      throw new Error(L(`Kuota akun paket kamu penuh (maks. ${accountQuota} akun). Hubungi Telegram @mrpangeranz untuk upgrade.`, `Your plan's account quota is full (max ${accountQuota}). Contact Telegram @mrpangeranz to upgrade.`));
    }
    const res = editingId ? await api.put<ShopeeAccount>('shopee-accounts', editingId, data) : await api.post<ShopeeAccount>('shopee-accounts', data);
    if (!res.success || !res.data) throw new Error(failMsg(res));
    const saved = res.data;
    setAccounts((prev) => (editingId ? prev.map((a) => (a.id === editingId ? saved : a)) : [saved, ...prev]));
    if (!editingId && !selectedAccountId) handleSelectAccount(saved.id);
    addLog(editingId ? L(`[DATA] Akun "${saved.nickname}" diperbarui.`, `[DATA] Account "${saved.nickname}" updated.`) : L(`[DATA] Akun "${saved.nickname}" ditambahkan.`, `[DATA] Account "${saved.nickname}" added.`), 'success');
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm(L('Hapus akun ini?', 'Delete this account?'))) return;
    const res = await api.delete('shopee-accounts', id);
    if (res.success) {
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      addLog(L('[DATA] Akun dihapus.', '[DATA] Account deleted.'), 'info');
    } else toast.show(failMsg(res));
  };

  const handleSaveBulkAccounts = async (bulkData: Partial<ShopeeAccount>[]) => {
    if (!bulkData || bulkData.length === 0) return;
    const availableSlots = Math.max(0, accountQuota - accounts.length);
    if (availableSlots <= 0) {
      throw new Error(L(`Kuota akun penuh (maks. ${accountQuota}). Upgrade paket untuk menambah slot.`, `Account quota full (max ${accountQuota}). Upgrade your plan for more slots.`));
    }
    const itemsToImport = bulkData.slice(0, availableSlots);
    addLog(L(`[DATA] Mengimpor ${itemsToImport.length} akun Shopee…`, `[DATA] Importing ${itemsToImport.length} Shopee accounts…`), 'info');
    const res = await api.post<{ total_imported: number; items: ShopeeAccount[] }>('shopee-accounts/bulk', itemsToImport);
    let imported: ShopeeAccount[] = [];
    if (res.success && res.data?.items) {
      imported = res.data.items;
    } else {
      for (const item of itemsToImport) {
        const single = await api.post<ShopeeAccount>('shopee-accounts', item);
        if (single.success && single.data) imported.push(single.data);
      }
    }
    if (!imported.length) throw new Error(failMsg(res));
    setAccounts((prev) => [...imported, ...prev]);
    if (!selectedAccountId) handleSelectAccount(imported[0].id);
    const skipped = bulkData.length - itemsToImport.length;
    addLog(
      L(`[DATA] ${imported.length} akun berhasil diimpor${skipped > 0 ? `, ${skipped} dilewati karena kuota` : ''}.`, `[DATA] ${imported.length} accounts imported${skipped > 0 ? `, ${skipped} skipped (quota)` : ''}.`),
      'success'
    );
  };

  const handleSaveTargetUrl = async (data: Partial<TargetUrl>) => {
    const editingId = activeTargetUrl?.id;
    const res = editingId ? await api.put<TargetUrl>('target-urls', editingId, data) : await api.post<TargetUrl>('target-urls', data);
    if (!res.success || !res.data) throw new Error(failMsg(res));
    const saved = res.data;
    setTargetUrls((prev) => (editingId ? prev.map((t) => (t.id === editingId ? saved : t)) : [saved, ...prev]));
    if (!editingId) handleSelectTarget(saved.id);
    addLog(editingId ? L(`[DATA] Target "${saved.title}" diperbarui.`, `[DATA] Target "${saved.title}" updated.`) : L(`[DATA] Target "${saved.title}" ditambahkan & dipilih.`, `[DATA] Target "${saved.title}" added & selected.`), 'success');
  };

  const handleDeleteTargetUrl = async (id: string) => {
    if (!confirm(L('Hapus target ini?', 'Delete this target?'))) return;
    const res = await api.delete('target-urls', id);
    if (res.success) {
      setTargetUrls((prev) => prev.filter((t) => t.id !== id));
      addLog(L('[DATA] Target dihapus.', '[DATA] Target deleted.'), 'info');
    } else toast.show(failMsg(res));
  };

  const handleSaveProxy = async (data: Partial<ProxyMesh>) => {
    const editingId = activeProxy?.id;
    const res = editingId ? await api.put<ProxyMesh>('proxies', editingId, data) : await api.post<ProxyMesh>('proxies', data);
    if (!res.success || !res.data) throw new Error(failMsg(res));
    const saved = res.data;
    setProxies((prev) => (editingId ? prev.map((p) => (p.id === editingId ? saved : p)) : [saved, ...prev]));
    addLog(L(`[PROXY] ${saved.host}:${saved.port} disimpan.`, `[PROXY] ${saved.host}:${saved.port} saved.`), 'success');
  };

  const handleDeleteProxy = async (id: string) => {
    if (!confirm(L('Hapus proxy ini?', 'Delete this proxy?'))) return;
    const res = await api.delete('proxies', id);
    if (res.success) {
      setProxies((prev) => prev.filter((p) => p.id !== id));
      addLog(L('[PROXY] Proxy dihapus.', '[PROXY] Proxy deleted.'), 'info');
    } else toast.show(failMsg(res));
  };

  const [testingProxyId, setTestingProxyId] = useState<string | null>(null);
  const handleTestProxy = async (p: ProxyMesh) => {
    setTestingProxyId(p.id);
    addLog(L(`[PROXY] Tes ${p.host}:${p.port} → tunnel ke Shopee ${p.region || ''}…`, `[PROXY] Testing ${p.host}:${p.port} → tunnel to Shopee ${p.region || ''}…`), 'info');
    const res = await api.testProxy(p.id);
    setTestingProxyId(null);
    if (res.success && res.data) {
      const d = res.data;
      if (d.proxy) setProxies((prev) => prev.map((x) => (x.id === p.id ? d.proxy : x)));
      addLog(
        d.ok
          ? L(`[PROXY] ${p.host}:${p.port} AKTIF · tunnel ke ${d.target} ${d.latency_ms} ms`, `[PROXY] ${p.host}:${p.port} ACTIVE · tunnel to ${d.target} ${d.latency_ms} ms`)
          : L(`[PROXY] ${p.host}:${p.port} MATI · ${d.detail} (${d.latency_ms} ms)`, `[PROXY] ${p.host}:${p.port} DEAD · ${d.detail} (${d.latency_ms} ms)`),
        d.ok ? 'success' : 'error'
      );
    } else {
      addLog(`[PROXY] ${failMsg(res)}`, 'error');
    }
  };

  const handleSaveSchedule = async (data: Partial<Schedule>) => {
    const editingId = activeSchedule?.id;
    const res = editingId ? await api.put<Schedule>('schedules', editingId, data) : await api.post<Schedule>('schedules', data);
    if (!res.success || !res.data) throw new Error(failMsg(res));
    const saved = res.data;
    setSchedules((prev) => (editingId ? prev.map((s) => (s.id === editingId ? saved : s)) : [saved, ...prev]));
    addLog(L(`[JADWAL] "${saved.title}" disimpan.`, `[SCHEDULE] "${saved.title}" saved.`), 'success');
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm(L('Hapus jadwal ini?', 'Delete this schedule?'))) return;
    const res = await api.delete('schedules', id);
    if (res.success) {
      setSchedules((prev) => prev.filter((s) => s.id !== id));
      addLog(L('[JADWAL] Jadwal dihapus.', '[SCHEDULE] Schedule deleted.'), 'info');
    } else toast.show(failMsg(res));
  };

  const handleUpdatePayment = async (data: Partial<ShopeePayment>) => {
    const payId = paymentSettings?.id || `pay_${currentUser?.id || 'main'}`;
    const res = await api.put<ShopeePayment>('shopee-payments', payId, data);
    if (!res.success || !res.data) {
      toast.show(failMsg(res));
      throw new Error(failMsg(res));
    }
    setPaymentSettings(res.data);
    addLog(L('[DATA] Pengaturan pembayaran & notifikasi disimpan.', '[DATA] Payment & notification settings saved.'), 'success');
  };

  // Cloud Data Synchronization Trigger
  const handleRunMigration = async (force = false) => {
    // force=true menimpa data cloud dengan seed lokal — tombol admin selalu memakai false
    setIsMigrating(true);
    addLog(L('[CLOUD] Menjalankan sinkronisasi data cloud…', '[CLOUD] Running cloud data sync…'), 'info');
    try {
      const res = await api.runMigration(force);
      if (res.success) {
        addLog(L('[CLOUD] Sinkronisasi selesai.', '[CLOUD] Sync finished.'), 'success');
        await loadUserData();
      } else {
        addLog(L(`[CLOUD] Sinkronisasi gagal: ${res.error?.message}`, `[CLOUD] Sync failed: ${res.error?.message}`), 'error');
      }
    } catch (err: any) {
      addLog(`[CLOUD] Error: ${err.message}`, 'error');
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
    addLog(L('[DATA] Backup konfigurasi diunduh (JSON).', '[DATA] Settings backup downloaded (JSON).'), 'success');
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      let parsed: any;
      try {
        parsed = JSON.parse(String(evt.target?.result || ''));
        if (!parsed || typeof parsed !== 'object') throw new Error('format');
      } catch (err: any) {
        toast.show(L('File backup tidak valid', 'Invalid backup file'));
        addLog(L(`[DATA] File backup tidak valid: ${err.message}`, `[DATA] Invalid backup file: ${err.message}`), 'error');
        return;
      }
      if (parsed.botSettings && typeof parsed.botSettings === 'object') setBotSettings((prev) => normalizeSettings({ ...prev, ...parsed.botSettings }));
      // Pulihkan data yang belum ada (berdasarkan id) — tidak menimpa data yang sudah ada
      const groups: { key: string; table: string; current: { id: string }[]; setter: (fn: (p: any[]) => any[]) => void; label: string }[] = [
        { key: 'targetUrls', table: 'target-urls', current: targetUrls, setter: setTargetUrls as any, label: L('target', 'targets') },
        { key: 'accounts', table: 'shopee-accounts', current: accounts, setter: setAccounts as any, label: L('akun', 'accounts') },
        { key: 'addresses', table: 'addresses', current: addresses, setter: setAddresses as any, label: L('alamat', 'addresses') },
        { key: 'proxies', table: 'proxies', current: proxies, setter: setProxies as any, label: 'proxy' },
        { key: 'schedules', table: 'schedules', current: schedules, setter: setSchedules as any, label: L('jadwal', 'schedules') },
      ];
      const plan = groups
        .map((g) => {
          const have = new Set(g.current.map((x) => x.id));
          const list = Array.isArray(parsed[g.key]) ? parsed[g.key].filter((x: any) => x && typeof x === 'object' && !have.has(x.id)) : [];
          return { ...g, list };
        })
        .filter((g) => g.list.length);
      if (!plan.length) {
        addLog(L('[DATA] Pengaturan bot dipulihkan. Tidak ada data baru untuk ditambahkan.', '[DATA] Bot settings restored. No new data to add.'), 'success');
        return;
      }
      const summary = plan.map((g) => `${g.list.length} ${g.label}`).join(', ');
      if (!confirm(L(`Pulihkan dari backup: ${summary}?`, `Restore from backup: ${summary}?`))) return;
      for (const g of plan) {
        const items = g.list.map(({ id, user_id, created_at, updated_at, ...rest }: any) => rest);
        const res = await api.post<{ items: any[] }>(`${g.table}/bulk`, items);
        if (res.success && res.data?.items) {
          g.setter((prev) => [...res.data!.items, ...prev]);
          addLog(L(`[DATA] ${res.data.items.length} ${g.label} dipulihkan.`, `[DATA] ${res.data.items.length} ${g.label} restored.`), 'success');
        } else {
          addLog(L(`[DATA] Gagal memulihkan ${g.label}: ${res.error?.message || 'error'}`, `[DATA] Failed to restore ${g.label}: ${res.error?.message || 'error'}`), 'error');
        }
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
      toast.show(L('Browser ini tidak mendukung notifikasi', 'This browser does not support notifications'));
      return;
    }
    Notification.requestPermission().then((permission) => {
      setNotifState(permission);
      if (permission === 'granted') {
        addLog(L('[SYSTEM] Notifikasi browser aktif.', '[SYSTEM] Browser notifications enabled.'), 'success');
        try {
          new Notification('GaneMaX.Ai', { body: L('Notifikasi aktif.', 'Notifications enabled.') });
        } catch {}
      } else {
        toast.show(L('Izin notifikasi ditolak di browser', 'Notification permission denied by the browser'));
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
    accounts,
    addresses,
    proxies,
    schedules,
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
    selectedAccountId: selectedAccount?.id || '',
    onSelectAccount: handleSelectAccount,
    onOpenAccountModal: (a?: ShopeeAccount) => {
      setActiveAccount(a || null);
      setAccountModalOpen(true);
    },
    onOpenBulkAccountModal: () => setBulkAccountModalOpen(true),
    onDeleteAccount: handleDeleteAccount,
    selectedAddressId: selectedAddress?.id || '',
    onSelectAddress: handleSelectAddress,
    onOpenAddressModal: (a?: Address) => {
      setActiveAddress(a || null);
      setAddressModalOpen(true);
    },
    onDeleteAddress: handleDeleteAddress,
    onOpenProxyModal: (px?: ProxyMesh) => {
      setActiveProxy(px || null);
      setProxyModalOpen(true);
    },
    onDeleteProxy: handleDeleteProxy,
    onTestProxy: handleTestProxy,
    testingProxyId,
    onOpenScheduleModal: (sc?: Schedule) => {
      setActiveSchedule(sc || null);
      setScheduleModalOpen(true);
    },
    onDeleteSchedule: handleDeleteSchedule,
    onUseSchedule: handleUseSchedule,
    onRequestNotification: handleRequestNotification,
    maxThreads: licenseThreadCap,
    effectiveLeadMs: openLeadMs,
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
        onOpenGuide={() => setShowOnboarding(true)}
      />

      <main className="gx-main">
        {currentTab === 'dashboard' && (
          <DashboardView
            user={currentUser}
            region={selectedRegion}
            clock={clock}
            targets={targetUrls}
            selectedTarget={selectedTarget}
            selectedAccountId={selectedAccount?.id || ''}
            selectedAddressId={selectedAddress?.id || ''}
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
            onOpenAnnouncements={() => setIsAnnDrawerOpen(true)}
            runMode={runMode}
            onRunMode={(m) => setBotSettings((prev) => ({ ...prev, runMode: m }))}
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
                <h1>{L('Target & akun', 'Targets & accounts')}</h1>
                <p>{L('Produk incaran, akun Shopee, alamat, dan pembayaran.', 'Target products, Shopee accounts, addresses and payment.')}</p>
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
                <p>{L('Wilayah ASEAN, bahasa, jadwal, proxy, dan parameter eksekusi.', 'ASEAN region, language, schedules, proxies and execution parameters.')}</p>
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
      <Onboarding open={showOnboarding} onClose={() => setShowOnboarding(false)} />
      <PracticeOverlay state={practiceState} clock={clock} onDone={handlePracticeDone} onRetry={handlePracticeRetry} />
      <FireOverlay
        state={fireState}
        clock={clock}
        onOpen={(href) => {
          addLog(L('[OPEN] Shopee dibuka lewat tombol.', '[OPEN] Shopee opened via button.'), 'success');
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
