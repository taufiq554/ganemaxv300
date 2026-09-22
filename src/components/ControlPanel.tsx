import React, { useState } from 'react';
import {
  User,
  ShopeeAccount,
  Address,
  TargetUrl,
  ProxyMesh,
  Schedule,
  ShopeePayment,
  BotSettings,
  AseanCountryCode,
} from '../types/index.ts';
import { ASEAN_REGIONS, ALL_ASEAN_CODES } from '../constants/asean.ts';

interface ControlPanelProps {
  currentUser: User | null;
  accounts: ShopeeAccount[];
  addresses: Address[];
  targetUrls: TargetUrl[];
  proxies: ProxyMesh[];
  schedules: Schedule[];
  paymentSettings: ShopeePayment | null;
  botSettings: BotSettings;
  usersList: User[];
  isBotRunning: boolean;
  selectedRegion?: AseanCountryCode;
  onSelectRegion?: (code: AseanCountryCode) => void;
  onDeployAseanProxies?: (code: AseanCountryCode) => Promise<void>;
  onStartBot: () => void;
  onStopBot: () => void;
  onUpdatePayment: (data: Partial<ShopeePayment>) => Promise<void>;
  onUpdateSettings: (settings: BotSettings) => void;
  onOpenAddressModal: (address?: Address) => void;
  onDeleteAddress: (id: string) => Promise<void>;
  onOpenAccountModal: (account?: ShopeeAccount) => void;
  onDeleteAccount: (id: string) => Promise<void>;
  onOpenTargetUrlModal: (target?: TargetUrl) => void;
  onDeleteTargetUrl: (id: string) => Promise<void>;
  onOpenProxyModal: (proxy?: ProxyMesh) => void;
  onDeleteProxy: (id: string) => Promise<void>;
  onOpenScheduleModal: (schedule?: Schedule) => void;
  onDeleteSchedule: (id: string) => Promise<void>;
  // Admin user operations
  onAddUser?: (user: Partial<User & { password?: string }>) => Promise<void>;
  onUpdateUser?: (id: string, updates: Partial<User & { password?: string }>) => Promise<void>;
  onDeleteUser?: (id: string) => Promise<void>;
  onRunMigration?: (force?: boolean) => Promise<void>;
  isMigrating?: boolean;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
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
  selectedRegion = 'ID',
  onSelectRegion,
  onDeployAseanProxies,
  onStartBot,
  onStopBot,
  onUpdatePayment,
  onUpdateSettings,
  onOpenAddressModal,
  onDeleteAddress,
  onOpenAccountModal,
  onDeleteAccount,
  onOpenTargetUrlModal,
  onDeleteTargetUrl,
  onOpenProxyModal,
  onDeleteProxy,
  onOpenScheduleModal,
  onDeleteSchedule,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onRunMigration,
  isMigrating,
}) => {
  const [selectedTargetId, setSelectedTargetId] = useState<string>(targetUrls[0]?.id || '');
  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.id || '');
  const [selectedAddressId, setSelectedAddressId] = useState<string>(addresses[0]?.id || '');
  const [isDeployingProxies, setIsDeployingProxies] = useState(false);

  // Payment local state
  const [payMethod, setPayMethod] = useState(paymentSettings?.payment_method || 'shopeepay');
  const [shopeepayPin, setShopeepayPin] = useState(paymentSettings?.shopeepay_pin || '');
  const [customVoucher, setCustomVoucher] = useState(paymentSettings?.custom_voucher_code || '');
  const [autoOngkir, setAutoOngkir] = useState(paymentSettings?.auto_ongkir || 'true');
  const [autoDiscount, setAutoDiscount] = useState(paymentSettings?.auto_discount || 'true');
  const [payFallback, setPayFallback] = useState(paymentSettings?.payment_fallback || 'spaylater');
  const [tgToken, setTgToken] = useState(paymentSettings?.telegram_token || '');
  const [tgChatId, setTgChatId] = useState(paymentSettings?.telegram_chat_id || '');
  const [isSavingPay, setIsSavingPay] = useState(false);

  // Admin Add User form state
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');
  const [newPlan, setNewPlan] = useState<string>('30_hari');
  const [customMaxAccounts, setCustomMaxAccounts] = useState<number>(5);
  const [customMaxThreads, setCustomMaxThreads] = useState<number>(12);
  const [customDeviceLimit, setCustomDeviceLimit] = useState<number>(3);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [copiedUserId, setCopiedUserId] = useState<string | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});

  const LICENSE_TIERS = [
    { id: '1_hari', label: '1 Hari (Trial 24 Jam)', priceRp: 'Rp 25.000', priceUsd: '$2', days: 1, maxAccounts: 1, maxThreads: 2, deviceLimit: 1 },
    { id: '3_hari', label: '3 Hari (Weekend Flash)', priceRp: 'Rp 50.000', priceUsd: '$4', days: 3, maxAccounts: 2, maxThreads: 4, deviceLimit: 1 },
    { id: '7_hari', label: '7 Hari (1 Minggu Pro)', priceRp: 'Rp 100.000', priceUsd: '$7', days: 7, maxAccounts: 3, maxThreads: 8, deviceLimit: 2 },
    { id: '30_hari', label: '30 Hari (1 Bulan Starter)', priceRp: 'Rp 150.000', priceUsd: '$11', days: 30, maxAccounts: 5, maxThreads: 12, deviceLimit: 3 },
    { id: '60_hari', label: '60 Hari (2 Bulan Best Value)', priceRp: 'Rp 250.000', priceUsd: '$18', days: 60, maxAccounts: 10, maxThreads: 16, deviceLimit: 5 },
    { id: '365_hari', label: '365 Hari (1 Tahun VIP)', priceRp: 'Rp 1.000.000', priceUsd: '$70', days: 365, maxAccounts: 25, maxThreads: 24, deviceLimit: 10 },
    { id: 'lifetime', label: 'Lifetime (Sultan Unlimited)', priceRp: 'Rp 1.800.000', priceUsd: '$125', days: 36500, maxAccounts: 999, maxThreads: 32, deviceLimit: 99 },
  ];

  const currentRegionInfo = ASEAN_REGIONS[selectedRegion] || ASEAN_REGIONS.ID;

  const handlePlanChange = (planId: string) => {
    setNewPlan(planId);
    const tier = LICENSE_TIERS.find((t) => t.id === planId);
    if (tier) {
      setCustomMaxAccounts(tier.maxAccounts);
      setCustomMaxThreads(tier.maxThreads);
      setCustomDeviceLimit(tier.deviceLimit);
    }
  };

  const handleGeneratePassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let res = '';
    for (let i = 0; i < 8; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(res);
  };

  const handleSavePayment = async () => {
    setIsSavingPay(true);
    await onUpdatePayment({
      payment_method: payMethod,
      shopeepay_pin: shopeepayPin,
      custom_voucher_code: customVoucher,
      auto_ongkir: autoOngkir,
      auto_discount: autoDiscount,
      payment_fallback: payFallback,
      telegram_token: tgToken,
      telegram_chat_id: tgChatId,
    });
    setIsSavingPay(false);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newPassword || !onAddUser) return;
    setIsAddingUser(true);

    const selectedConfig = LICENSE_TIERS.find((p) => p.id === newPlan) || LICENSE_TIERS[3];
    const expiryDate = new Date(Date.now() + selectedConfig.days * 24 * 3600 * 1000).toISOString();

    await onAddUser({
      username: newUsername.trim(),
      password: newPassword.trim(),
      plain_password: newPassword.trim(),
      role: newRole,
      license_plan: newPlan,
      max_accounts: customMaxAccounts || selectedConfig.maxAccounts,
      max_threads: customMaxThreads || selectedConfig.maxThreads,
      device_limit: customDeviceLimit || selectedConfig.deviceLimit,
      expired_at: expiryDate,
      status: 'active',
    });

    setNewUsername('');
    setNewPassword('');
    setIsAddingUser(false);
  };

  const handleExtendExpiry = async (user: User, additionalDays: number) => {
    if (!onUpdateUser) return;
    const currentBase = user.expired_at && new Date(user.expired_at).getTime() > Date.now()
      ? new Date(user.expired_at).getTime()
      : Date.now();
    const newExpiry = new Date(currentBase + additionalDays * 24 * 3600 * 1000).toISOString();
    await onUpdateUser(user.id, { expired_at: newExpiry, status: 'active' });
  };

  const handleCopyAccountInfo = (user: User) => {
    const tier = LICENSE_TIERS.find((p) => p.id === user.license_plan);
    const planName = tier ? `${tier.label} (${tier.priceRp})` : user.license_plan || '1 Bulan';
    const expiryStr = user.expired_at
      ? new Date(user.expired_at).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }) + ' WIB'
      : 'Lifetime (Selamanya)';

    const text =
      `Halo kak, konfirmasi pembayaran Anda telah kami terima! Berikut detail akun lisensi bot GaneMaX AI Anda:\n\n` +
      `👤 Username : ${user.username}\n` +
      `🔑 Password : ${user.plain_password || '(Sesuai yang dibuat)'}\n` +
      `📦 Paket    : ${planName}\n` +
      `⏳ Aktif s/d: ${expiryStr}\n` +
      `⚡ Batas    : Max ${user.max_accounts || 5} Akun | ${user.max_threads || 12} Threads | ${user.device_limit || 3} Perangkat\n` +
      `🌐 Link Bot : ${window.location.origin}/app\n\n` +
      `Panduan Cepat:\n` +
      `1. Login di website bot di atas dengan username & password Anda\n` +
      `2. Masukkan URL Produk Shopee yang mau dibeli pada tab "Target Produk"\n` +
      `3. Simpan akun & metode pembayaran (ShopeePay/SPayLater/COD)\n` +
      `4. Klik "AKTIFKAN BOT" sebelum waktu flash sale dimulai\n\n` +
      `Jika butuh bantuan teknis, hubungi Telegram @mrpangeranz. Selamat berburu Flash Sale! 🚀`;

    navigator.clipboard.writeText(text);
    setCopiedUserId(user.id);
    setTimeout(() => setCopiedUserId(null), 2500);
  };

  const togglePasswordVisibility = (userId: string) => {
    setRevealedPasswords((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  return (
    <div className="control-panel">
      {/* 0. ASEAN REGION HUB */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a, #1e293b)',
          border: '1px solid #334155',
          borderRadius: '16px',
          padding: '16px 20px',
          color: '#ffffff',
          marginBottom: '20px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>🌏</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: '14px', letterSpacing: '0.02em' }}>
                ASEAN Cross-Border Engine Hub
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                Target Server: <span style={{ color: '#38bdf8', fontWeight: 700 }}>Shopee {currentRegionInfo.name} ({currentRegionInfo.domain})</span> • Mata Uang: <span style={{ color: '#4ade80', fontWeight: 700 }}>{currentRegionInfo.currency}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', background: 'rgba(255,255,255,0.08)', padding: '4px 10px', borderRadius: '20px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
            <span>NTP: {currentRegionInfo.ntpServer}</span>
          </div>
        </div>

        {/* Region Selector Chips */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
          {ALL_ASEAN_CODES.map((code) => {
            const reg = ASEAN_REGIONS[code];
            const isSelected = selectedRegion === code;
            return (
              <button
                key={code}
                type="button"
                onClick={() => onSelectRegion && onSelectRegion(code)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '10px',
                  fontSize: '12px',
                  fontWeight: isSelected ? 800 : 500,
                  background: isSelected ? '#2563eb' : 'rgba(255,255,255,0.06)',
                  color: isSelected ? '#ffffff' : '#cbd5e1',
                  border: isSelected ? '1px solid #60a5fa' : '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{reg.flag}</span>
                <span>{reg.name}</span>
                <span style={{ fontSize: '10px', opacity: 0.8 }}>({reg.currency})</span>
              </button>
            );
          })}
        </div>

        {/* Fast Region Info Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '11px', color: '#94a3b8' }}>
          <div>
            ⚡ Jam Flash Sale Shopee {currentRegionInfo.name}: <strong>{currentRegionInfo.flashSaleSchedule.join(', ')}</strong> ({currentRegionInfo.timezoneLabel})
          </div>
          {onDeployAseanProxies && (
            <button
              type="button"
              onClick={async () => {
                setIsDeployingProxies(true);
                await onDeployAseanProxies(selectedRegion);
                setIsDeployingProxies(false);
              }}
              disabled={isDeployingProxies}
              style={{
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <i className={`fa-solid ${isDeployingProxies ? 'fa-spinner fa-spin' : 'fa-bolt'} mr-1`}></i>
              {isDeployingProxies ? 'Memasang Proxy...' : `Pasang Preset Proxy Residential ${currentRegionInfo.name}`}
            </button>
          )}
        </div>
      </div>

      {/* 1. TARGET PRODUK */}
      <div className="section-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fa-solid fa-crosshairs" style={{ color: '#2563eb' }}></i>
          <span>Target Produk Flash Sale ({targetUrls.length} Tersimpan)</span>
        </div>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => onOpenTargetUrlModal()}
          style={{ width: 'auto' }}
        >
          <i className="fa-solid fa-plus"></i> Tambah URL
        </button>
      </div>

      <div className="form-group">
        <label>Pilih Target URL Produk Aktif:</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select
            value={selectedTargetId}
            onChange={(e) => setSelectedTargetId(e.target.value)}
            style={{ flex: 1 }}
          >
            {targetUrls.length === 0 && <option value="">Belum ada target URL</option>}
            {targetUrls.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} - Rp {t.target_price.toLocaleString('id-ID')}
              </option>
            ))}
          </select>
          {selectedTargetId && (
            <>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  const item = targetUrls.find((t) => t.id === selectedTargetId);
                  if (item) onOpenTargetUrlModal(item);
                }}
                title="Edit Target"
              >
                <i className="fa-solid fa-pen-to-square"></i>
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => onDeleteTargetUrl(selectedTargetId)}
                title="Hapus Target"
              >
                <i className="fa-solid fa-trash-can"></i>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. AKUN SHOPEE */}
      <div className="section-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fa-solid fa-user-shield" style={{ color: '#2563eb' }}></i>
          <span>Akun Shopee Eksekutor</span>
        </div>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => onOpenAccountModal()}
          style={{ width: 'auto' }}
        >
          <i className="fa-solid fa-plus"></i> Tambah Akun
        </button>
      </div>

      <div className="form-group">
        <label>Pilih Akun yang Digunakan:</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            style={{ flex: 1 }}
          >
            {accounts.length === 0 && <option value="">Belum ada akun Shopee</option>}
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nickname} (@{a.username})
              </option>
            ))}
          </select>
          {selectedAccountId && (
            <>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  const acc = accounts.find((a) => a.id === selectedAccountId);
                  if (acc) onOpenAccountModal(acc);
                }}
                title="Edit Akun"
              >
                <i className="fa-solid fa-pen-to-square"></i>
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => onDeleteAccount(selectedAccountId)}
                title="Hapus Akun"
              >
                <i className="fa-solid fa-trash-can"></i>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 3. ALAMAT PENGIRIMAN */}
      <div className="section-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fa-solid fa-map-location-dot" style={{ color: '#2563eb' }}></i>
          <span>Alamat Pengiriman Default</span>
        </div>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => onOpenAddressModal()}
          style={{ width: 'auto' }}
        >
          <i className="fa-solid fa-plus"></i> Tambah Alamat
        </button>
      </div>

      <div className="form-group">
        <label>Pilih Alamat Checkout:</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select
            value={selectedAddressId}
            onChange={(e) => setSelectedAddressId(e.target.value)}
            style={{ flex: 1 }}
          >
            {addresses.length === 0 && <option value="">Belum ada alamat</option>}
            {addresses.map((addr) => (
              <option key={addr.id} value={addr.id}>
                {addr.label} ({addr.recipient_name} - {addr.phone})
              </option>
            ))}
          </select>
          {selectedAddressId && (
            <>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  const ad = addresses.find((a) => a.id === selectedAddressId);
                  if (ad) onOpenAddressModal(ad);
                }}
                title="Edit Alamat"
              >
                <i className="fa-solid fa-pen-to-square"></i>
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => onDeleteAddress(selectedAddressId)}
                title="Hapus Alamat"
              >
                <i className="fa-solid fa-trash-can"></i>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 4. PEMBAYARAN & TELEGRAM NOTIFIKASI */}
      <div className="section-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fa-solid fa-credit-card" style={{ color: '#2563eb' }}></i>
          <span>Metode Pembayaran & Telegram</span>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Metode Pembayaran ({currentRegionInfo.name})</label>
          <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
            {currentRegionInfo.popularPaymentMethods.map((pm) => (
              <option key={pm.id} value={pm.id}>
                {pm.label}
              </option>
            ))}
            <option value="shopeepay">ShopeePay Default</option>
            <option value="spaylater">SPayLater</option>
            <option value="cod">Cash on Delivery (COD)</option>
          </select>
        </div>
        <div className="form-group">
          <label>PIN ShopeePay (Bypass Prompt)</label>
          <input
            type="password"
            value={shopeepayPin}
            onChange={(e) => setShopeepayPin(e.target.value)}
            placeholder="6 digit PIN"
            maxLength={6}
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Kode Voucher Khusus (Opsional)</label>
          <input
            type="text"
            value={customVoucher}
            onChange={(e) => setCustomVoucher(e.target.value)}
            placeholder="FS1000 atau KLAIMDISKON"
          />
        </div>
        <div className="form-group">
          <label>Fallback Pembayaran Jika Gagal</label>
          <select value={payFallback} onChange={(e) => setPayFallback(e.target.value)}>
            <option value="spaylater">SPayLater</option>
            <option value="cod">COD</option>
            <option value="none">Jangan Fallback</option>
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Auto Klaim Gratis Ongkir</label>
          <select value={autoOngkir} onChange={(e) => setAutoOngkir(e.target.value)}>
            <option value="true">Aktif (Rekomendasi)</option>
            <option value="false">Nonaktif</option>
          </select>
        </div>
        <div className="form-group">
          <label>Auto Pasang Voucher Diskon</label>
          <select value={autoDiscount} onChange={(e) => setAutoDiscount(e.target.value)}>
            <option value="true">Aktif</option>
            <option value="false">Nonaktif</option>
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Telegram Bot Token (Opsional)</label>
          <input
            type="text"
            value={tgToken}
            onChange={(e) => setTgToken(e.target.value)}
            placeholder="8703715665:AAFBw..."
          />
        </div>
        <div className="form-group">
          <label>Telegram Chat ID (Opsional)</label>
          <input
            type="text"
            value={tgChatId}
            onChange={(e) => setTgChatId(e.target.value)}
            placeholder="987654321"
          />
        </div>
      </div>

      <button
        type="button"
        className="btn btn-outline"
        onClick={handleSavePayment}
        disabled={isSavingPay}
        style={{ marginBottom: '20px' }}
      >
        <i className="fa-solid fa-floppy-disk"></i>{' '}
        {isSavingPay ? 'Menyimpan ke Firestore...' : 'Simpan Konfigurasi Pembayaran'}
      </button>

      {/* 5. PROXY MESH & JADWAL */}
      <div className="section-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fa-solid fa-network-wired" style={{ color: '#2563eb' }}></i>
          <span>Proxy Rotator & Node Mesh ({proxies.length} Aktif)</span>
        </div>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => onOpenProxyModal()}
          style={{ width: 'auto' }}
        >
          <i className="fa-solid fa-plus"></i> Tambah Proxy
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {proxies.map((p) => (
          <div
            key={p.id}
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              padding: '6px 12px',
              borderRadius: '10px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#22c55e',
              }}
            ></span>
            <b>{p.host}:{p.port}</b>
            <span style={{ color: '#64748b' }}>({p.latency_ms || 12}ms)</span>
            <button
              type="button"
              onClick={() => onDeleteProxy(p.id)}
              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}
            >
              &times;
            </button>
          </div>
        ))}
      </div>

      {/* 6. ADVANCED BOT TUNING */}
      <div className="section-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fa-solid fa-sliders" style={{ color: '#2563eb' }}></i>
          <span>Parameter Tuning Engine</span>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Mode Eksekusi</label>
          <select
            value={botSettings.botMode}
            onChange={(e) => onUpdateSettings({ ...botSettings, botMode: e.target.value as any })}
          >
            <option value="turbo">⚡ TURBO MODE (Maksimal Kecepatan)</option>
            <option value="stealth">🛡️ STEALTH MODE (Anti Banned / Humanized)</option>
            <option value="ai">🧠 AI PREDICTIVE MODE</option>
          </select>
        </div>
        <div className="form-group">
          <label>Jumlah Thread Paralel</label>
          <input
            type="number"
            value={botSettings.threadCount}
            onChange={(e) => onUpdateSettings({ ...botSettings, threadCount: Number(e.target.value) })}
            min={1}
            max={50}
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Polling Rate Target (ms)</label>
          <input
            type="number"
            value={botSettings.pollRate}
            onChange={(e) => onUpdateSettings({ ...botSettings, pollRate: Number(e.target.value) })}
            min={20}
            max={1000}
          />
        </div>
        <div className="form-group">
          <label>Pre-fire Jitter Offset (ms)</label>
          <input
            type="number"
            value={botSettings.preFireJitter}
            onChange={(e) => onUpdateSettings({ ...botSettings, preFireJitter: Number(e.target.value) })}
            placeholder="-15"
          />
        </div>
      </div>

      {/* 7. ADMIN PANEL (HANYA DITAMPILKAN UNTUK ROLE ADMIN) */}
      {currentUser?.role === 'admin' && (
        <div
          style={{
            marginTop: '28px',
            padding: '20px',
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.05), rgba(124, 58, 237, 0.05))',
            borderRadius: '16px',
            border: '1px solid rgba(37, 99, 235, 0.2)',
          }}
        >
          <div className="section-title">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-crown" style={{ color: '#f59e0b' }}></i>
              <span style={{ color: '#1e3a8a', fontWeight: 800 }}>Administrator Control Hub — Kelola Lisensi & Pengguna</span>
            </div>
            {onRunMigration && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => onRunMigration(true)}
                disabled={isMigrating}
                style={{ width: 'auto', background: '#3b82f6', color: 'white', borderColor: '#3b82f6' }}
              >
                <i className={`fa-solid ${isMigrating ? 'fa-spinner fa-spin' : 'fa-arrows-rotate'}`}></i>{' '}
                {isMigrating ? 'Sinkronisasi...' : 'Sinkronisasi Firestore'}
              </button>
            )}
          </div>

          <div
            style={{
              padding: '12px 16px',
              background: '#ffffff',
              border: '1px solid #bfdbfe',
              borderRadius: '12px',
              fontSize: '12px',
              color: '#1e40af',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div>
              <i className="fa-brands fa-telegram text-sky-500 mr-2 text-base"></i>
              <strong>Alur Aktivasi Pembeli:</strong> User transfer via QRIS lalu DM Telegram <strong>@mrpangeranz</strong>. Buatkan akun di form berikut, lalu klik <strong>"Salin Info Akun"</strong> untuk mengirim data ke pembeli.
            </div>
            <a
              href="https://t.me/mrpangeranz"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: '#0284c7',
                color: '#ffffff',
                padding: '6px 12px',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '11px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <i className="fa-brands fa-telegram"></i> Buka Telegram @mrpangeranz
            </a>
          </div>

          {/* Tabel Referensi Resmi Harga & Batasan Lisensi Bot */}
          <div style={{ marginBottom: '20px', background: '#ffffff', borderRadius: '12px', border: '1px solid #bfdbfe', padding: '16px', overflowX: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ fontWeight: 800, fontSize: '13px', color: '#1e3a8a' }}>
                <i className="fa-solid fa-table-list mr-1 text-blue-600"></i> Tabel Resmi Harga & Batasan Kuota Lisensi Bot (Firestore Synced)
              </div>
              <span style={{ fontSize: '11px', color: '#64748b' }}>Pembayaran via QRIS / DM Telegram <strong>@mrpangeranz</strong></span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#eff6ff', borderBottom: '2px solid #bfdbfe', color: '#1e40af' }}>
                  <th style={{ padding: '6px 8px' }}>Paket Lisensi</th>
                  <th style={{ padding: '6px 8px' }}>Harga (IDR)</th>
                  <th style={{ padding: '6px 8px' }}>Harga (ASEAN/USD)</th>
                  <th style={{ padding: '6px 8px' }}>Masa Aktif</th>
                  <th style={{ padding: '6px 8px' }}>Batas Akun</th>
                  <th style={{ padding: '6px 8px' }}>Batas Thread</th>
                  <th style={{ padding: '6px 8px' }}>Device</th>
                  <th style={{ padding: '6px 8px' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {LICENSE_TIERS.map((tier) => (
                  <tr key={tier.id} style={{ borderBottom: '1px solid #e2e8f0', background: newPlan === tier.id ? '#f0fdf4' : 'transparent' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 700, color: '#0f172a' }}>{tier.label}</td>
                    <td style={{ padding: '6px 8px', fontWeight: 700, color: '#16a34a' }}>{tier.priceRp}</td>
                    <td style={{ padding: '6px 8px', color: '#0369a1' }}>{tier.priceUsd}</td>
                    <td style={{ padding: '6px 8px' }}>{tier.days >= 36500 ? 'Permanen' : `${tier.days} Hari`}</td>
                    <td style={{ padding: '6px 8px', fontWeight: 600 }}>{tier.maxAccounts >= 999 ? 'Unlimited' : `${tier.maxAccounts} Akun`}</td>
                    <td style={{ padding: '6px 8px', fontWeight: 600 }}>{tier.maxThreads} Threads</td>
                    <td style={{ padding: '6px 8px' }}>{tier.deviceLimit} Perangkat</td>
                    <td style={{ padding: '6px 8px' }}>
                      <button
                        type="button"
                        onClick={() => handlePlanChange(tier.id)}
                        style={{
                          background: newPlan === tier.id ? '#15803d' : '#e0e7ff',
                          color: newPlan === tier.id ? '#ffffff' : '#3730a3',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '3px 8px',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: '10px',
                        }}
                      >
                        {newPlan === tier.id ? 'Terpilih' : 'Pilih Paket'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Form Tambah Pengguna & Lisensi Baru */}
          <form onSubmit={handleCreateUser} style={{ marginBottom: '24px' }}>
            <div className="form-row">
              <div className="form-group">
                <label>Username Pembeli</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="misal: flashbuyer88"
                  required
                />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>Password Baru</label>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#2563eb',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    <i className="fa-solid fa-dice"></i> Buat Acak
                  </button>
                </div>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="password123"
                  required
                />
              </div>

              <div className="form-group">
                <label>Paket Lisensi Pembelian</label>
                <select
                  value={newPlan}
                  onChange={(e) => handlePlanChange(e.target.value)}
                >
                  {LICENSE_TIERS.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.label} ({plan.priceRp} / {plan.priceUsd})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Role Akses</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                >
                  <option value="user">User Biasa (Member)</option>
                  <option value="admin">Administrator VIP</option>
                </select>
              </div>
            </div>

            {/* Custom Quota Settings Per User */}
            <div className="form-row" style={{ marginTop: '10px', background: 'rgba(255,255,255,0.7)', padding: '10px 14px', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label style={{ fontSize: '11px' }}>Batas Akun Shopee</label>
                <input
                  type="number"
                  value={customMaxAccounts}
                  onChange={(e) => setCustomMaxAccounts(Number(e.target.value))}
                  min={1}
                  max={999}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label style={{ fontSize: '11px' }}>Batas Engine Threads</label>
                <input
                  type="number"
                  value={customMaxThreads}
                  onChange={(e) => setCustomMaxThreads(Number(e.target.value))}
                  min={1}
                  max={32}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label style={{ fontSize: '11px' }}>Batas Maksimal Perangkat</label>
                <input
                  type="number"
                  value={customDeviceLimit}
                  onChange={(e) => setCustomDeviceLimit(Number(e.target.value))}
                  min={1}
                  max={99}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={isAddingUser}
              style={{ width: 'auto', background: '#1d4ed8', borderColor: '#1d4ed8', marginTop: '12px' }}
            >
              <i className="fa-solid fa-user-plus"></i>{' '}
              {isAddingUser ? 'Menyimpan ke Firestore...' : 'Aktivasi Lisensi Pengguna Baru'}
            </button>
          </form>

          {/* Tabel Pengguna & Lisensi */}
          <div style={{ overflowX: 'auto', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '12px',
                textAlign: 'left',
              }}
            >
              <thead>
                <tr style={{ borderBottom: '2px solid #cbd5e1', background: '#f8fafc', color: '#334155' }}>
                  <th style={{ padding: '10px 12px' }}>User & Password</th>
                  <th style={{ padding: '10px 12px' }}>Paket Lisensi</th>
                  <th style={{ padding: '10px 12px' }}>Batas Kuota</th>
                  <th style={{ padding: '10px 12px' }}>Masa Aktif Firestore</th>
                  <th style={{ padding: '10px 12px' }}>Role</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Aksi Kelola</th>
                </tr>
              </thead>
              <tbody>
                {usersList.map((u) => {
                  const isPasswordRevealed = !!revealedPasswords[u.id];
                  const passwordToDisplay = isPasswordRevealed
                    ? (u.plain_password || '••••••••')
                    : '••••••••';

                  // Calculate remaining days
                  let expiryLabel = 'Lifetime / Permanen';
                  let isExpired = false;
                  if (u.expired_at) {
                    const expiryMs = new Date(u.expired_at).getTime();
                    const diffDays = Math.ceil((expiryMs - Date.now()) / (1000 * 3600 * 24));
                    if (diffDays <= 0) {
                      isExpired = true;
                      expiryLabel = 'EXPIRED (Habis)';
                    } else {
                      expiryLabel = `Sisa ${diffDays} Hari (${new Date(u.expired_at).toLocaleDateString('id-ID')})`;
                    }
                  }

                  const planObj = LICENSE_TIERS.find((p) => p.id === u.license_plan);
                  const displayPlan = planObj ? planObj.label : (u.license_plan || 'Standar');

                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{u.username}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', color: '#64748b', fontSize: '11px' }}>
                          <span style={{ fontFamily: 'monospace' }}>PW: {passwordToDisplay}</span>
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(u.id)}
                            style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: 0 }}
                            title="Tampilkan / Sembunyikan Password"
                          >
                            <i className={`fa-solid ${isPasswordRevealed ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                          </button>
                        </div>
                      </td>

                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontWeight: 600, color: '#334155' }}>{displayPlan}</span>
                      </td>

                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontSize: '11px', color: '#475569' }}>
                          <div><b>{u.max_accounts || 5}</b> Akun</div>
                          <div style={{ color: '#64748b' }}>{u.max_threads || 12} Th • {u.device_limit || 3} Dev</div>
                        </div>
                      </td>

                      <td style={{ padding: '10px 12px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: isExpired ? '#fee2e2' : '#ecfdf5',
                            color: isExpired ? '#b91c1c' : '#047857',
                          }}
                        >
                          {expiryLabel}
                        </span>
                      </td>

                      <td style={{ padding: '10px 12px' }}>
                        <span className={`app-role-chip ${u.role}`}>{u.role}</span>
                      </td>

                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontWeight: 700, color: u.status === 'active' ? '#16a34a' : '#dc2626' }}>
                          {u.status === 'active' ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>

                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
                          {/* 1-Click Copy Info Akun untuk Telegram */}
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            style={{
                              padding: '4px 8px',
                              fontSize: '11px',
                              width: 'auto',
                              background: copiedUserId === u.id ? '#10b981' : '#f0f9ff',
                              color: copiedUserId === u.id ? '#ffffff' : '#0369a1',
                              borderColor: '#bae6fd',
                              fontWeight: 700,
                            }}
                            onClick={() => handleCopyAccountInfo(u)}
                            title="Salin template info akun untuk dikirimkan ke Telegram pembeli"
                          >
                            <i className={`fa-solid ${copiedUserId === u.id ? 'fa-check' : 'fa-copy'}`}></i>{' '}
                            {copiedUserId === u.id ? 'Tersalin!' : 'Salin Info (Telegram)'}
                          </button>

                          {/* Quick Extend Buttons */}
                          {onUpdateUser && (
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              style={{ padding: '4px 8px', fontSize: '11px', width: 'auto', color: '#047857', borderColor: '#a7f3d0' }}
                              onClick={() => handleExtendExpiry(u, 30)}
                              title="Perpanjang masa aktif akun +30 Hari di Firestore"
                            >
                              +30 Hari
                            </button>
                          )}

                          {onUpdateUser && (
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              style={{ padding: '4px 8px', fontSize: '11px', width: 'auto' }}
                              onClick={() => {
                                const newStatus = u.status === 'active' ? 'disabled' : 'active';
                                onUpdateUser(u.id, { status: newStatus });
                              }}
                            >
                              {u.status === 'active' ? 'Nonaktif' : 'Aktifkan'}
                            </button>
                          )}

                          {onDeleteUser && u.id !== currentUser.id && (
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              style={{ padding: '4px 8px', fontSize: '11px', color: '#ef4444', borderColor: '#fecaca', width: 'auto' }}
                              onClick={() => {
                                if (confirm(`Yakin ingin menghapus lisensi pengguna @${u.username}?`)) {
                                  onDeleteUser(u.id);
                                }
                              }}
                              title="Hapus Pengguna"
                            >
                              <i className="fa-solid fa-trash-can"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 8. BOT ACTION BUTTONS */}
      <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
        {!isBotRunning ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={onStartBot}
            style={{
              padding: '14px',
              fontSize: '15px',
              fontWeight: 700,
              background: '#22c55e',
              borderColor: '#22c55e',
            }}
          >
            <i className="fa-solid fa-play"></i> AKTIFKAN BOT FLASH SALE
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            onClick={onStopBot}
            style={{
              padding: '14px',
              fontSize: '15px',
              fontWeight: 700,
              background: '#ef4444',
              borderColor: '#ef4444',
            }}
          >
            <i className="fa-solid fa-stop"></i> HENTIKAN BOT SEKARANG
          </button>
        )}
      </div>
    </div>
  );
};
