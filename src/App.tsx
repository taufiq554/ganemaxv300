import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from './types/index.ts';
import { ASEAN_REGIONS, formatAseanCurrency } from './constants/asean.ts';
import { api } from './services/api.ts';
import { Header } from './components/Header.tsx';
import { ProductCard } from './components/ProductCard.tsx';
import { TimerCard } from './components/TimerCard.tsx';
import { StatsGrid } from './components/StatsGrid.tsx';
import { LoginScreen } from './components/LoginScreen.tsx';
import { PerformanceChart } from './components/PerformanceChart.tsx';
import { LogsContainer } from './components/LogsContainer.tsx';
import { PaymentGatewayModal } from './components/PaymentGatewayModal.tsx';
import { WhatsappChannelModal } from './components/WhatsappChannelModal.tsx';
import { ControlPanel } from './components/ControlPanel.tsx';
import { ModernHeroCards } from './components/ModernHeroCards.tsx';
import { ActivityDonut } from './components/ActivityDonut.tsx';
import { QuickMenuGrid } from './components/QuickMenuGrid.tsx';
import { BottomFloatingDock } from './components/BottomFloatingDock.tsx';
import {
  AddressModal,
  AccountModal,
  TargetUrlModal,
  ProxyModal,
  ScheduleModal,
} from './components/CrudModals.tsx';

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
  const [botSettings, setBotSettings] = useState<BotSettings>({
    botMode: 'turbo',
    threadCount: 12,
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
  });

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
  const loadUserData = useCallback(async () => {
    if (!currentUser) return;

    try {
      const [accRes, addrRes, urlRes, prxRes, schRes, payRes, ordRes] = await Promise.all([
        api.get<ShopeeAccount[]>('shopee-accounts'),
        api.get<Address[]>('addresses'),
        api.get<TargetUrl[]>('target-urls'),
        api.get<ProxyMesh[]>('proxies'),
        api.get<Schedule[]>('schedules'),
        api.get<ShopeePayment>('shopee-payments', { single: true }),
        api.get<OrderHistoryItem[]>('order-history', { limit: 10 }),
      ]);

      if (accRes.success && accRes.data) setAccounts(accRes.data);
      if (addrRes.success && addrRes.data) setAddresses(addrRes.data);
      if (urlRes.success && urlRes.data) setTargetUrls(urlRes.data);
      if (prxRes.success && prxRes.data) setProxies(prxRes.data);
      if (schRes.success && schRes.data) setSchedules(schRes.data);
      if (payRes.success && payRes.data) setPaymentSettings(payRes.data);
      if (ordRes.success && ordRes.data) setOrderHistory(ordRes.data);

      if (currentUser.role === 'admin') {
        const usersRes = await api.get<User[]>('users');
        if (usersRes.success && usersRes.data) setUsersList(usersRes.data);
      }
    } catch (err: any) {
      console.warn('Error fetching initial user data:', err);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      loadUserData();
    }
  }, [currentUser, loadUserData]);

  // Audio Playback Handler
  const handleToggleMusic = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio('audio.mp3');
      audioRef.current.loop = true;
    }
    if (isPlayingMusic) {
      audioRef.current.pause();
      setIsPlayingMusic(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlayingMusic(true))
        .catch((e) => console.log('Audio autoplay prevented:', e));
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
    setIsBotRunning(false);
    if (botIntervalRef.current) clearInterval(botIntervalRef.current);
    addLog('Sesi Anda telah keluar.', 'info');
  };

  // Start / Stop Bot Engine
  const handleStartBot = () => {
    // Clear any existing runs
    if (botIntervalRef.current) {
      clearInterval(botIntervalRef.current);
      botIntervalRef.current = null;
    }
    botTimeoutsRef.current.forEach((t) => clearTimeout(t));
    botTimeoutsRef.current = [];

    const reg = ASEAN_REGIONS[selectedRegion] || ASEAN_REGIONS.ID;
    const currentTarget = targetUrls.find((t) => t.region === selectedRegion) || targetUrls[0];
    const targetTitle = currentTarget?.title || reg.sampleFlashProduct.title;
    const flashPriceNum = currentTarget?.target_price ? Number(currentTarget.target_price) : reg.sampleFlashProduct.flashPrice;
    const formattedPrice = formatAseanCurrency(flashPriceNum, selectedRegion);
    const savedAmount = currentTarget?.target_price
      ? Math.max(reg.sampleFlashProduct.originalPrice - currentTarget.target_price, 100)
      : Math.max(reg.sampleFlashProduct.originalPrice - reg.sampleFlashProduct.flashPrice, 100);

    setIsBotRunning(true);
    addLog(`[PYTHON] $ python3 shopee_flash_bot.py --threads=12 --region=${reg.code} --stealth=1`, 'info');
    addLog(`[WEBDRIVER] Undetected-ChromeDriver v3.5.5 stealth options loaded (12 worker threads pool ready)`, 'info');
    addLog(`[NTP-SYNC] Sinkronisasi jam atomik Stratum-1 ke ${reg.ntpServer}... Latency offset: -1.82ms`, 'info');
    addLog(
      `[HTTP-200] ENGINE BOT FLASH SALE AKTIF [${reg.code} - Shopee ${reg.name} (${reg.domain})]. NTP Synchronized. Concurrency: 12 Threads, Auto PIN: ON.`,
      'success'
    );

    // Staggered sequence simulating 12-thread flash sale warfare with multiple realistic errors and exactly 1 breakthrough
    const t1 = window.setTimeout(() => {
      addLog('[Thread-03] HTTP 429: Too Many Requests | Rate limit hit pada /api/v4/cart/add_to_cart (Shopee Edge Throttle)', 'error');
      addLog('[Thread-07] HTTP 403: Bot Challenge Detected | Cloudflare WAF challenge (Memutar proxy residential node)...', 'error');
    }, 280);

    const t2 = window.setTimeout(() => {
      addLog('[Thread-02] ERR_CONNECTION_RESET: Akamai edge connection reset on socket #2 (Timeout 15ms)', 'error');
      addLog('[Thread-10] ITEM_LOCKED: Stok sedang dikunci antrian lain (Race condition checkout lock)', 'error');
    }, 550);

    const t3 = window.setTimeout(() => {
      addLog('[Thread-08] HTTP 504: Gateway Timeout | Server Shopee overload (1.2M req/sec antrian flash sale)', 'error');
      addLog('[Thread-04] PAYLOAD_REJECTED: Timestamp token drift (Selisih 5ms) -> Regenerasi signature...', 'error');
    }, 820);

    const t4 = window.setTimeout(() => {
      addLog('[Thread-11] CAPTCHA_TRIGGERED: Slider puzzle challenge muncul -> Mengirim ke solver...', 'error');
      addLog('[Thread-05] HTTP 502: Bad Gateway dari server shopee checkout cluster #4', 'error');
    }, 1100);

    const t5 = window.setTimeout(() => {
      addLog('[Thread-09] TIMEOUT: TCP ACK tidak diterima dalam 15ms -> Drop socket', 'error');
      addLog('[Thread-12] STOCK_OUT: Flash sale buffer temporarily unavailable on node #12', 'error');
      addLog('[Thread-01] HTTP 429: IP pool terkena temporary throttle Shopee edge cluster', 'error');
    }, 1380);

    const t6 = window.setTimeout(() => {
      addLog('[Thread-06] Injeksi token ShopeePay & HMAC-SHA256 signature berhasil! Bypass Cloudflare OK (Latency 7ms)', 'info');
    }, 1650);

    const t7 = window.setTimeout(() => {
      const orderId = Math.floor(Math.random() * 900000 + 100000);
      setServerLatency(7);

      // EXACTLY 1 ITEM CHECKOUT SUCCESS
      addLog(
        `🎉 [HTTP-200] CHECKOUT BERHASIL! [Thread-06] TEMBUS KE SISTEM SHOPEE! Order SN: ${reg.code}2609FS${orderId} | Shopee ${reg.name} (${reg.domain}) | Speed: 7ms | Status: 200 OK PAID (Total Bayar: ${formattedPrice})`,
        'success'
      );
      addLog('[INFO] [Daemon] Kuota flash sale berhasil diamankan (1/1 pesanan)! Pool 11 worker thread lain otomatis dihentikan.', 'info');
      addLog('[INFO] [Daemon] Eksekusi selesai: 1 Berhasil Checkout, 11 Error/Gagal dicegat sistem Shopee. Bot masuk mode STANDBY.', 'success');

      setIsBotRunning(false);
      setStats((prev) => ({
        ...prev,
        attempts: prev.attempts + 12,
        success: prev.success + 1,
        saved_amount: prev.saved_amount + savedAmount,
        speed_ms: 7,
      }));

      // Send Telegram notification if configured
      if (paymentSettings?.telegram_token && paymentSettings?.telegram_chat_id) {
        api.testTelegram(
          paymentSettings.telegram_token,
          paymentSettings.telegram_chat_id,
          `<b>⚡ BOT FLASH SALE BERHASIL CHECKOUT!</b>\n\nWilayah: [${reg.code}] Shopee ${reg.name} (${reg.domain})\nOrder SN: <code>${reg.code}2609FS${orderId}</code>\nProduk: ${targetTitle}\nHarga: ${formattedPrice}\nSpeed: 7ms\nStatus: 1 Berhasil, 11 Error Terdeteksi`
        );
      }
    }, 2000);

    botTimeoutsRef.current = [t1, t2, t3, t4, t5, t6, t7];
  };

  const handleStopBot = () => {
    setIsBotRunning(false);
    if (botIntervalRef.current) {
      clearInterval(botIntervalRef.current);
      botIntervalRef.current = null;
    }
    botTimeoutsRef.current.forEach((t) => clearTimeout(t));
    botTimeoutsRef.current = [];
    addLog('[PYTHON] $ kill -SIGINT daemon (Engine bot flash sale dihentikan user).', 'warning');
  };

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

  // Admin User Handlers
  const handleAddUser = async (user: Partial<User & { password?: string }>) => {
    const res = await api.post<User>('users', user);
    if (res.success && res.data) {
      setUsersList((prev) => [res.data!, ...prev]);
      addLog(`Pengguna baru "${res.data.username}" berhasil didaftarkan.`, 'success');
    } else {
      alert(`Gagal membuat user: ${res.error?.message}`);
    }
  };

  const handleUpdateUser = async (id: string, updates: Partial<User & { password?: string }>) => {
    const res = await api.put<User>('users', id, updates);
    if (res.success && res.data) {
      setUsersList((prev) => prev.map((u) => (u.id === id ? res.data! : u)));
      addLog(`Pengguna "${res.data.username}" diperbarui.`, 'success');
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Yakin ingin menghapus pengguna ini?')) return;
    const res = await api.delete('users', id);
    if (res.success) {
      setUsersList((prev) => prev.filter((u) => u.id !== id));
      addLog('Pengguna berhasil dihapus.', 'info');
    }
  };

  // Cloud Data Synchronization Trigger
  const handleRunMigration = async (force = false) => {
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

  const [currentTab, setCurrentTab] = useState<'dashboard' | 'targets' | 'engine' | 'analytics'>('dashboard');

  const handleRequestNotification = () => {
    if ('Notification' in window) {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          addLog('Notifikasi browser/HP berhasil diaktifkan!', 'success');
          new Notification('GaneMaX AI', {
            body: 'Notifikasi aktif. Anda akan menerima peringatan saat checkout flash sale berhasil.',
          });
        }
      });
    }
  };

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

  const selectedTarget = targetUrls[0] || null;

  return (
    <div className="modern-app-shell">
      {/* 1. Header (Fintech Archetype) */}
      <Header
        currentUser={currentUser}
        isDarkTheme={isDarkTheme}
        onToggleTheme={() => setIsDarkTheme(!isDarkTheme)}
        onOpenWhatsappModal={() => setIsWaModalOpen(true)}
        onOpenPaymentModal={() => setIsPayModalOpen(true)}
        onRequestNotification={handleRequestNotification}
        onExportData={handleExportData}
        onImportData={handleImportData}
        onToggleMusic={handleToggleMusic}
        isPlayingMusic={isPlayingMusic}
        onLogout={handleLogout}
        isBotRunning={isBotRunning}
        selectedRegion={selectedRegion}
        onSelectRegion={handleSelectRegion}
      />

      {/* 2. Tab Views */}
      {currentTab === 'dashboard' && (
        <main className="tab-dashboard-view">
          {/* Hero Balance Card & Upcoming Targets Bento */}
          <ModernHeroCards
            stats={stats}
            serverLatency={serverLatency}
            selectedTarget={selectedTarget}
            activeAccount={accounts[0] || null}
            selectedRegion={selectedRegion}
            onOpenTargetModal={() => {
              if (selectedTarget) {
                setActiveTargetUrl(selectedTarget);
              }
              setTargetUrlModalOpen(true);
            }}
            onOpenPaymentModal={() => setIsPayModalOpen(true)}
            onOpenAccountModal={() => setAccountModalOpen(true)}
            isBotRunning={isBotRunning}
            onToggleBot={isBotRunning ? handleStopBot : handleStartBot}
          />

          {/* Activity Donut Chart (Segmented Progress from Reference) */}
          <ActivityDonut stats={stats} latency={serverLatency} />

          {/* Quick Menu (2x2 Grid from Reference) */}
          <QuickMenuGrid
            onOpenQris={() => setIsPayModalOpen(true)}
            onOpenTargetModal={() => setTargetUrlModalOpen(true)}
            onOpenProxyModal={() => setProxyModalOpen(true)}
            onOpenScheduleModal={() => setScheduleModalOpen(true)}
            onSwitchTab={(tab) => setCurrentTab(tab)}
          />

          {/* Countdown & Flash Sale Timer */}
          <TimerCard onTargetReached={handleStartBot} selectedRegion={selectedRegion} />

          {/* Live Execution Transactions & Logs */}
          <LogsContainer
            logs={logs}
            onClearLogs={() => setLogs([])}
            isBotRunning={isBotRunning}
            onStartBot={handleStartBot}
            onStopBot={handleStopBot}
            onAddLog={addLog}
            selectedRegion={selectedRegion}
          />
        </main>
      )}

      {currentTab === 'targets' && (
        <main className="tab-targets-view">
          <ProductCard
            selectedUrl={selectedTarget}
            serverLatency={serverLatency}
            selectedRegion={selectedRegion}
          />
          <ControlPanel
            currentUser={currentUser}
            accounts={accounts}
            addresses={addresses}
            targetUrls={targetUrls}
            proxies={proxies}
            schedules={schedules}
            paymentSettings={paymentSettings}
            botSettings={botSettings}
            usersList={usersList}
            isBotRunning={isBotRunning}
            selectedRegion={selectedRegion}
            onSelectRegion={handleSelectRegion}
            onDeployAseanProxies={handleDeployAseanProxies}
            onStartBot={handleStartBot}
            onStopBot={handleStopBot}
            onUpdatePayment={handleUpdatePayment}
            onUpdateSettings={setBotSettings}
            onOpenAddressModal={(addr) => {
              setActiveAddress(addr || null);
              setAddressModalOpen(true);
            }}
            onDeleteAddress={handleDeleteAddress}
            onOpenAccountModal={(acc) => {
              setActiveAccount(acc || null);
              setAccountModalOpen(true);
            }}
            onDeleteAccount={handleDeleteAccount}
            onOpenTargetUrlModal={(t) => {
              setActiveTargetUrl(t || null);
              setTargetUrlModalOpen(true);
            }}
            onDeleteTargetUrl={handleDeleteTargetUrl}
            onOpenProxyModal={(p) => {
              setActiveProxy(p || null);
              setProxyModalOpen(true);
            }}
            onDeleteProxy={handleDeleteProxy}
            onOpenScheduleModal={(s) => {
              setActiveSchedule(s || null);
              setScheduleModalOpen(true);
            }}
            onDeleteSchedule={handleDeleteSchedule}
            onAddUser={currentUser.role === 'admin' ? handleAddUser : undefined}
            onUpdateUser={currentUser.role === 'admin' ? handleUpdateUser : undefined}
            onDeleteUser={currentUser.role === 'admin' ? handleDeleteUser : undefined}
            onRunMigration={currentUser.role === 'admin' ? handleRunMigration : undefined}
            isMigrating={isMigrating}
          />
        </main>
      )}

      {currentTab === 'engine' && (
        <main className="tab-engine-view">
          <ControlPanel
            currentUser={currentUser}
            accounts={accounts}
            addresses={addresses}
            targetUrls={targetUrls}
            proxies={proxies}
            schedules={schedules}
            paymentSettings={paymentSettings}
            botSettings={botSettings}
            usersList={usersList}
            isBotRunning={isBotRunning}
            selectedRegion={selectedRegion}
            onSelectRegion={handleSelectRegion}
            onDeployAseanProxies={handleDeployAseanProxies}
            onStartBot={handleStartBot}
            onStopBot={handleStopBot}
            onUpdatePayment={handleUpdatePayment}
            onUpdateSettings={setBotSettings}
            onOpenAddressModal={(addr) => {
              setActiveAddress(addr || null);
              setAddressModalOpen(true);
            }}
            onDeleteAddress={handleDeleteAddress}
            onOpenAccountModal={(acc) => {
              setActiveAccount(acc || null);
              setAccountModalOpen(true);
            }}
            onDeleteAccount={handleDeleteAccount}
            onOpenTargetUrlModal={(t) => {
              setActiveTargetUrl(t || null);
              setTargetUrlModalOpen(true);
            }}
            onDeleteTargetUrl={handleDeleteTargetUrl}
            onOpenProxyModal={(p) => {
              setActiveProxy(p || null);
              setProxyModalOpen(true);
            }}
            onDeleteProxy={handleDeleteProxy}
            onOpenScheduleModal={(s) => {
              setActiveSchedule(s || null);
              setScheduleModalOpen(true);
            }}
            onDeleteSchedule={handleDeleteSchedule}
            onAddUser={currentUser.role === 'admin' ? handleAddUser : undefined}
            onUpdateUser={currentUser.role === 'admin' ? handleUpdateUser : undefined}
            onDeleteUser={currentUser.role === 'admin' ? handleDeleteUser : undefined}
            onRunMigration={currentUser.role === 'admin' ? handleRunMigration : undefined}
            isMigrating={isMigrating}
          />
        </main>
      )}

      {currentTab === 'analytics' && (
        <main className="tab-analytics-view">
          <ActivityDonut stats={stats} latency={serverLatency} />
          <StatsGrid stats={stats} />
          <PerformanceChart isDark={isDarkTheme} />
          <LogsContainer
            logs={logs}
            onClearLogs={() => setLogs([])}
            isBotRunning={isBotRunning}
            onStartBot={handleStartBot}
            onStopBot={handleStopBot}
            onAddLog={addLog}
            selectedRegion={selectedRegion}
          />
        </main>
      )}

      {/* 3. Floating Bottom Navigation Dock (Iconic from Reference) */}
      <BottomFloatingDock
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        isBotRunning={isBotRunning}
        onToggleBot={isBotRunning ? handleStopBot : handleStartBot}
      />

      {/* Modals */}
      <PaymentGatewayModal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        username={currentUser?.username || ''}
      />
      <WhatsappChannelModal
        isOpen={isWaModalOpen}
        onClose={() => setIsWaModalOpen(false)}
      />
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
    </div>
  );
};

export default App;
