import React, { useEffect, useState } from 'react';
import {
  Crosshair,
  UserRound,
  MapPin,
  Wallet,
  Globe,
  Network,
  SlidersHorizontal,
  Plus,
  Pencil,
  Trash2,
  FileUp,
  Eye,
  EyeOff,
  Save,
  Ban,
  Zap,
  Square,
  Send,
} from 'lucide-react';
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
import { ASEAN_REGIONS, ALL_ASEAN_CODES, formatAseanCurrency } from '../constants/asean.ts';
import { AseanFlag } from './AseanFlag.tsx';
import { api } from '../services/api.ts';

interface ControlPanelProps {
  section: 'setup' | 'engine';
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
  onOpenBulkAccountModal?: () => void;
  onDeleteAccount: (id: string) => Promise<void>;
  onOpenTargetUrlModal: (target?: TargetUrl) => void;
  onDeleteTargetUrl: (id: string) => Promise<void>;
  onOpenProxyModal: (proxy?: ProxyMesh) => void;
  onDeleteProxy: (id: string) => Promise<void>;
  onOpenScheduleModal: (schedule?: Schedule) => void;
  onDeleteSchedule: (id: string) => Promise<void>;
  selectedTargetId: string;
  onSelectTarget: (id: string) => void;
  maxThreads: number;
}

const Card: React.FC<{ icon: React.ReactNode; title: string; aside?: React.ReactNode; children: React.ReactNode }> = ({ icon, title, aside, children }) => (
  <section className="gx-card">
    <div className="gx-card__head">
      <h2 className="gx-card__title">
        {icon} {title}
      </h2>
      {aside && <div className="gx-card__aside">{aside}</div>}
    </div>
    <div className="gx-card__body">{children}</div>
  </section>
);

const RowActions: React.FC<{ onEdit: () => void; onDelete: () => void; label: string }> = ({ onEdit, onDelete, label }) => (
  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
    <button type="button" className="gx-iconbtn" style={{ width: 32, height: 32 }} onClick={onEdit} aria-label={`Edit ${label}`}>
      <Pencil size={14} />
    </button>
    <button type="button" className="gx-iconbtn" style={{ width: 32, height: 32 }} onClick={onDelete} aria-label={`Hapus ${label}`}>
      <Trash2 size={14} />
    </button>
  </div>
);

export const ControlPanel: React.FC<ControlPanelProps> = (props) => {
  const {
    section,
    currentUser,
    accounts,
    addresses,
    targetUrls,
    proxies,
    paymentSettings,
    botSettings,
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
    onOpenBulkAccountModal,
    onDeleteAccount,
    onOpenTargetUrlModal,
    onDeleteTargetUrl,
    onOpenProxyModal,
    onDeleteProxy,
    selectedTargetId,
    onSelectTarget,
    maxThreads,
  } = props;

  const reg = ASEAN_REGIONS[selectedRegion] || ASEAN_REGIONS.ID;
  const [isDeployingProxies, setIsDeployingProxies] = useState(false);

  // ---- Payment form (disinkronkan saat data dari server datang — sebelumnya form kosong kalau data telat termuat)
  const [payMethod, setPayMethod] = useState('shopeepay');
  const [shopeepayPin, setShopeepayPin] = useState('');
  const [customVoucher, setCustomVoucher] = useState('');
  const [autoOngkir, setAutoOngkir] = useState('true');
  const [autoDiscount, setAutoDiscount] = useState('true');
  const [payFallback, setPayFallback] = useState('spaylater');
  const [tgToken, setTgToken] = useState('');
  const [tgChatId, setTgChatId] = useState('');
  const [isSavingPay, setIsSavingPay] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tgTest, setTgTest] = useState<'idle' | 'sending' | 'ok' | 'fail'>('idle');

  useEffect(() => {
    const p = paymentSettings;
    setPayMethod(p?.payment_method && p.payment_method !== 'cod' ? p.payment_method : 'shopeepay');
    setShopeepayPin(p?.shopeepay_pin || '');
    setCustomVoucher(p?.custom_voucher_code || '');
    setAutoOngkir(p?.auto_ongkir || 'true');
    setAutoDiscount(p?.auto_discount || 'true');
    setPayFallback(p?.payment_fallback && p.payment_fallback !== 'cod' ? p.payment_fallback : 'spaylater');
    setTgToken(p?.telegram_token || '');
    setTgChatId(p?.telegram_chat_id || '');
  }, [paymentSettings]);

  const pinInvalid = payMethod === 'shopeepay' && shopeepayPin !== '' && !/^\d{6}$/.test(shopeepayPin);

  const handleSavePayment = async () => {
    if (pinInvalid) return;
    setIsSavingPay(true);
    await onUpdatePayment({
      payment_method: payMethod === 'cod' ? 'shopeepay' : payMethod,
      shopeepay_pin: shopeepayPin,
      custom_voucher_code: customVoucher.trim(),
      auto_ongkir: autoOngkir,
      auto_discount: autoDiscount,
      payment_fallback: payFallback === 'cod' ? 'spaylater' : payFallback,
      telegram_token: tgToken.trim(),
      telegram_chat_id: tgChatId.trim(),
    });
    setIsSavingPay(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const testTelegram = async () => {
    if (!tgToken || !tgChatId) return;
    setTgTest('sending');
    const ok = await api.testTelegram(tgToken.trim(), tgChatId.trim(), '✅ Notifikasi GaneMaX.Ai terhubung. Kamu akan dapat pesan di sini saat checkout selesai.');
    setTgTest(ok ? 'ok' : 'fail');
    setTimeout(() => setTgTest('idle'), 3000);
  };

  const actionBar = (
    <div style={{ display: 'flex', gap: 10 }}>
      {isBotRunning ? (
        <button type="button" className="gx-btn gx-btn--lg gx-btn--danger gx-btn--block" onClick={onStopBot}>
          <Square size={16} fill="currentColor" /> Hentikan engine
        </button>
      ) : (
        <button type="button" className="gx-btn gx-btn--lg gx-btn--flash gx-btn--block" onClick={onStartBot}>
          <Zap size={18} fill="currentColor" /> Jalankan bot sekarang
        </button>
      )}
    </div>
  );

  /* ================================================================ */
  if (section === 'setup') {
    const maxAcc = currentUser?.role === 'admin' ? null : currentUser?.max_accounts || 5;
    return (
      <div className="gx-grid gx-grid--2" style={{ alignItems: 'start' }}>
        <div className="gx-col">
          <Card
            icon={<Crosshair size={16} />}
            title={`Target produk (${targetUrls.length})`}
            aside={
              <button type="button" className="gx-btn gx-btn--xs gx-btn--primary" onClick={() => onOpenTargetUrlModal()}>
                <Plus size={13} /> Tambah
              </button>
            }
          >
            {targetUrls.length === 0 ? (
              <div className="gx-empty">Belum ada target. Tambah link produk Shopee yang mau di-war.</div>
            ) : (
              <ul className="gx-list" role="radiogroup" aria-label="Target aktif">
                {targetUrls.map((t) => {
                  const active = t.id === selectedTargetId;
                  return (
                    <li key={t.id} className="gx-row">
                      <input
                        type="radio"
                        name="active-target"
                        checked={active}
                        onChange={() => onSelectTarget(t.id)}
                        aria-label={`Jadikan ${t.title} target aktif`}
                        style={{ accentColor: 'var(--gx-brand)', width: 16, height: 16, flexShrink: 0 }}
                      />
                      <div className="gx-row__main" onClick={() => onSelectTarget(t.id)} style={{ cursor: 'pointer' }}>
                        <div className="gx-row__t">{t.title}</div>
                        <div className="gx-row__s">
                          <span className="gx-mono" style={{ color: 'var(--gx-flash)', fontWeight: 700 }}>
                            {formatAseanCurrency(Number(t.target_price) || 0, ((t.region as AseanCountryCode) || selectedRegion) as AseanCountryCode)}
                          </span>
                          {t.variant ? ` · ${t.variant}` : ''}
                          {active ? ' · aktif' : ''}
                        </div>
                      </div>
                      <RowActions label={t.title} onEdit={() => onOpenTargetUrlModal(t)} onDelete={() => onDeleteTargetUrl(t.id)} />
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card
            icon={<UserRound size={16} />}
            title={`Akun Shopee (${accounts.length}${maxAcc ? `/${maxAcc}` : ''})`}
            aside={
              <>
                {onOpenBulkAccountModal && (
                  <button type="button" className="gx-btn gx-btn--xs" onClick={onOpenBulkAccountModal}>
                    <FileUp size={13} /> Import
                  </button>
                )}
                <button type="button" className="gx-btn gx-btn--xs gx-btn--primary" onClick={() => onOpenAccountModal()}>
                  <Plus size={13} /> Tambah
                </button>
              </>
            }
          >
            {accounts.length === 0 ? (
              <div className="gx-empty">Belum ada akun Shopee. Tambahkan akun beserta cookies login.</div>
            ) : (
              <ul className="gx-list">
                {accounts.map((a) => (
                  <li key={a.id} className="gx-row">
                    <span className="gx-avatar" style={{ width: 32, height: 32, fontSize: 13 }}>
                      {(a.nickname || a.username || '?').slice(0, 1)}
                    </span>
                    <div className="gx-row__main">
                      <div className="gx-row__t">{a.nickname}</div>
                      <div className="gx-row__s">
                        @{a.username}
                        {a.region ? ` · ${a.region}` : ''} · {a.cookies ? 'cookies tersimpan' : 'tanpa cookies'}
                      </div>
                    </div>
                    <RowActions label={a.nickname} onEdit={() => onOpenAccountModal(a)} onDelete={() => onDeleteAccount(a.id)} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            icon={<MapPin size={16} />}
            title={`Alamat pengiriman (${addresses.length})`}
            aside={
              <button type="button" className="gx-btn gx-btn--xs gx-btn--primary" onClick={() => onOpenAddressModal()}>
                <Plus size={13} /> Tambah
              </button>
            }
          >
            {addresses.length === 0 ? (
              <div className="gx-empty">Belum ada alamat checkout.</div>
            ) : (
              <ul className="gx-list">
                {addresses.map((a) => (
                  <li key={a.id} className="gx-row">
                    <div className="gx-row__main">
                      <div className="gx-row__t">
                        {a.label} {a.is_default && <span className="gx-tag gx-tag--ok" style={{ marginLeft: 4 }}>Utama</span>}
                      </div>
                      <div className="gx-row__s">
                        {a.recipient_name} · {a.phone}
                      </div>
                      <div className="gx-row__s">{a.full_address}</div>
                    </div>
                    <RowActions label={a.label} onEdit={() => onOpenAddressModal(a)} onDelete={() => onDeleteAddress(a.id)} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="gx-col">
          <Card icon={<Wallet size={16} />} title="Pembayaran & notifikasi">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="gx-note">
                <Ban size={15} />
                <span>COD tidak tersedia untuk flash sale. Gunakan ShopeePay, SPayLater, atau SPinjam.</span>
              </div>
              <div className="gx-formgrid gx-formgrid--2">
                <label className="gx-field">
                  <span>Metode utama</span>
                  <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                    <option value="shopeepay">ShopeePay</option>
                    <option value="spaylater">SPayLater</option>
                    <option value="spinjam">SPinjam</option>
                    {reg.popularPaymentMethods
                      .filter((pm) => !['shopeepay', 'spaylater', 'spinjam', 'cod'].includes(pm.id))
                      .map((pm) => (
                        <option key={pm.id} value={pm.id}>
                          {pm.label}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="gx-field">
                  <span>PIN ShopeePay</span>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPin ? 'text' : 'password'}
                      value={shopeepayPin}
                      onChange={(e) => setShopeepayPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="6 digit"
                      inputMode="numeric"
                      autoComplete="off"
                      style={{ paddingRight: 40 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin((v) => !v)}
                      aria-label={showPin ? 'Sembunyikan PIN' : 'Lihat PIN'}
                      style={{ position: 'absolute', right: 6, top: 6, border: 0, background: 'none', color: 'var(--gx-ink-3)', cursor: 'pointer', padding: 4 }}
                    >
                      {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {pinInvalid && <small style={{ color: 'var(--gx-bad)' }}>PIN harus 6 digit angka</small>}
                </label>
                <label className="gx-field">
                  <span>Fallback jika saldo kurang</span>
                  <select value={payFallback} onChange={(e) => setPayFallback(e.target.value)}>
                    <option value="spaylater">SPayLater</option>
                    <option value="spinjam">SPinjam</option>
                    <option value="shopeepay">ShopeePay</option>
                    <option value="none">Jangan fallback</option>
                  </select>
                </label>
                <label className="gx-field">
                  <span>Kode voucher (opsional)</span>
                  <input value={customVoucher} onChange={(e) => setCustomVoucher(e.target.value)} placeholder="misal: FS1000" />
                </label>
              </div>
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                <label className="gx-switch">
                  <input type="checkbox" checked={autoOngkir === 'true'} onChange={(e) => setAutoOngkir(e.target.checked ? 'true' : 'false')} />
                  Auto klaim gratis ongkir
                </label>
                <label className="gx-switch">
                  <input type="checkbox" checked={autoDiscount === 'true'} onChange={(e) => setAutoDiscount(e.target.checked ? 'true' : 'false')} />
                  Auto pasang voucher
                </label>
              </div>

              <div className="gx-menudiv" style={{ margin: '4px 0' }} />
              <div className="gx-eyebrow">Notifikasi Telegram (opsional)</div>
              <div className="gx-formgrid gx-formgrid--2">
                <label className="gx-field">
                  <span>Bot token</span>
                  <input value={tgToken} onChange={(e) => setTgToken(e.target.value)} placeholder="123456:ABC…" autoComplete="off" />
                </label>
                <label className="gx-field">
                  <span>Chat ID</span>
                  <input value={tgChatId} onChange={(e) => setTgChatId(e.target.value)} placeholder="987654321" inputMode="numeric" />
                </label>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="gx-btn gx-btn--primary" onClick={handleSavePayment} disabled={isSavingPay || pinInvalid}>
                  <Save size={15} /> {isSavingPay ? 'Menyimpan…' : saved ? 'Tersimpan' : 'Simpan pengaturan'}
                </button>
                <button type="button" className="gx-btn" onClick={testTelegram} disabled={!tgToken || !tgChatId || tgTest === 'sending'}>
                  <Send size={14} />
                  {tgTest === 'sending' ? 'Mengirim…' : tgTest === 'ok' ? 'Terkirim' : tgTest === 'fail' ? 'Gagal — cek token' : 'Tes Telegram'}
                </button>
              </div>
            </div>
          </Card>
          {actionBar}
        </div>
      </div>
    );
  }

  /* ================================================================ */
  // section === 'engine'
  return (
    <div className="gx-grid gx-grid--2" style={{ alignItems: 'start' }}>
      <div className="gx-col">
        <Card icon={<Globe size={16} />} title="Wilayah Shopee">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="gx-chips">
              {ALL_ASEAN_CODES.map((code) => (
                <button key={code} type="button" className="gx-chip" aria-pressed={selectedRegion === code} onClick={() => onSelectRegion?.(code)}>
                  <AseanFlag code={code} size="xs" />
                  {ASEAN_REGIONS[code].name}
                </button>
              ))}
            </div>
            <div className="gx-metrics">
              <div className="gx-metric">
                <div className="gx-metric__k">Domain</div>
                <div className="gx-metric__v" style={{ fontSize: 13, whiteSpace: 'normal' }}>{reg.domain}</div>
              </div>
              <div className="gx-metric">
                <div className="gx-metric__k">Mata uang</div>
                <div className="gx-metric__v" style={{ fontSize: 13, whiteSpace: 'normal' }}>{reg.currency}</div>
              </div>
              <div className="gx-metric">
                <div className="gx-metric__k">Zona waktu</div>
                <div className="gx-metric__v" style={{ fontSize: 13, whiteSpace: 'normal' }}>{reg.timezoneLabel}</div>
              </div>
              <div className="gx-metric">
                <div className="gx-metric__k">Sesi flash sale</div>
                <div className="gx-metric__v" style={{ fontSize: 13, whiteSpace: 'normal' }}>{reg.flashSaleSchedule.join(' · ')}</div>
              </div>
            </div>
          </div>
        </Card>

        <Card
          icon={<Network size={16} />}
          title={`Proxy (${proxies.length})`}
          aside={
            <button type="button" className="gx-btn gx-btn--xs gx-btn--primary" onClick={() => onOpenProxyModal()}>
              <Plus size={13} /> Tambah
            </button>
          }
        >
          {proxies.length === 0 ? (
            <div className="gx-empty">Belum ada proxy. Bot memakai IP server langsung.</div>
          ) : (
            <div className="gx-chips">
              {proxies.map((p) => (
                <span key={p.id} className="gx-proxychip">
                  <span className="gx-led" style={{ color: p.status === 'dead' ? 'var(--gx-bad)' : 'var(--gx-ok)' }} />
                  <b className="gx-mono" style={{ fontWeight: 600 }}>
                    {p.host}:{p.port}
                  </b>
                  {p.region && <span className="gx-muted">{p.region}</span>}
                  <button type="button" onClick={() => onOpenProxyModal(p)} aria-label={`Edit proxy ${p.host}`} style={{ color: 'var(--gx-ink-3)' }}>
                    <Pencil size={12} />
                  </button>
                  <button type="button" onClick={() => onDeleteProxy(p.id)} aria-label={`Hapus proxy ${p.host}`}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          {onDeployAseanProxies && (
            <button
              type="button"
              className="gx-btn gx-btn--sm"
              style={{ marginTop: 12 }}
              disabled={isDeployingProxies}
              onClick={async () => {
                setIsDeployingProxies(true);
                await onDeployAseanProxies(selectedRegion);
                setIsDeployingProxies(false);
              }}
            >
              {isDeployingProxies ? 'Memasang…' : `Pasang preset proxy ${reg.name}`}
            </button>
          )}
        </Card>
      </div>

      <div className="gx-col">
        <Card icon={<SlidersHorizontal size={16} />} title="Parameter eksekusi">
          <div className="gx-formgrid gx-formgrid--2">
            <label className="gx-field">
              <span>Mode</span>
              <select value={botSettings.botMode} onChange={(e) => onUpdateSettings({ ...botSettings, botMode: e.target.value as BotSettings['botMode'] })}>
                <option value="turbo">Turbo — kecepatan maksimal</option>
                <option value="stealth">Stealth — lebih manusiawi</option>
                <option value="ai">AI predictive</option>
              </select>
            </label>
            <label className="gx-field">
              <span>Thread paralel</span>
              <input
                type="number"
                min={1}
                max={maxThreads}
                value={botSettings.threadCount}
                onChange={(e) => {
                  const v = Math.max(1, Math.min(maxThreads, Number(e.target.value) || 1));
                  onUpdateSettings({ ...botSettings, threadCount: v });
                }}
              />
              <small>Maks. {maxThreads} sesuai paket lisensi</small>
            </label>
            <label className="gx-field">
              <span>Polling rate (ms)</span>
              <input
                type="number"
                min={20}
                max={1000}
                value={botSettings.pollRate}
                onChange={(e) => onUpdateSettings({ ...botSettings, pollRate: Math.max(20, Math.min(1000, Number(e.target.value) || 20)) })}
              />
            </label>
            <label className="gx-field">
              <span>Pre-fire offset (ms)</span>
              <input
                type="number"
                min={-500}
                max={0}
                value={botSettings.preFireJitter}
                onChange={(e) => onUpdateSettings({ ...botSettings, preFireJitter: Math.max(-500, Math.min(0, Number(e.target.value) || 0)) })}
              />
              <small>Negatif = tembak lebih awal dari detik 0</small>
            </label>
            <label className="gx-field">
              <span>Maks. retry</span>
              <input
                type="number"
                min={0}
                max={20}
                value={botSettings.maxRetry}
                onChange={(e) => onUpdateSettings({ ...botSettings, maxRetry: Math.max(0, Math.min(20, Number(e.target.value) || 0)) })}
              />
            </label>
            <label className="gx-field">
              <span>Jeda retry (ms)</span>
              <input
                type="number"
                min={0}
                max={2000}
                value={botSettings.retryDelay}
                onChange={(e) => onUpdateSettings({ ...botSettings, retryDelay: Math.max(0, Math.min(2000, Number(e.target.value) || 0)) })}
              />
            </label>
          </div>
          <div style={{ marginTop: 14 }}>
            <label className="gx-switch">
              <input type="checkbox" checked={botSettings.notifySuccess} onChange={(e) => onUpdateSettings({ ...botSettings, notifySuccess: e.target.checked })} />
              Notifikasi browser saat checkout selesai
            </label>
          </div>
        </Card>
        {actionBar}
      </div>
    </div>
  );
};
