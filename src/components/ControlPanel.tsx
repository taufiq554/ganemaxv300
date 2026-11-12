import React, { useEffect, useState } from 'react';
import {
  Crosshair,
  Globe,
  Plus,
  Pencil,
  Trash2,
  Save,
  Zap,
  Square,
  Send,
  BellRing,
  Timer,
  UserRound,
  MapPin,
  Wallet,
  FileUp,
  Eye,
  EyeOff,
  Network,
  CalendarClock,
  SlidersHorizontal,
  Languages,
  RefreshCw,
  Play,
} from 'lucide-react';
import { User, TargetUrl, ShopeePayment, BotSettings, AseanCountryCode, ShopeeAccount, Address, ProxyMesh, Schedule } from '../types/index.ts';
import { ASEAN_REGIONS, ALL_ASEAN_CODES, formatAseanCurrency, paymentFamily, isAseanCode } from '../constants/asean.ts';
import { AseanFlag } from './AseanFlag.tsx';
import { api } from '../services/api.ts';
import { parseShopeeLink, isValidHttpUrl, isAndroid } from '../lib/shopee.ts';
import { useLang } from '../lib/i18n.tsx';
import { relativeTimeId } from '../lib/time.ts';

interface ControlPanelProps {
  section: 'setup' | 'engine';
  currentUser: User | null;
  targetUrls: TargetUrl[];
  accounts: ShopeeAccount[];
  addresses: Address[];
  proxies: ProxyMesh[];
  schedules: Schedule[];
  paymentSettings: ShopeePayment | null;
  botSettings: BotSettings;
  isBotRunning: boolean;
  selectedRegion?: AseanCountryCode;
  onSelectRegion?: (code: AseanCountryCode) => void;
  onStartBot: () => void;
  onStopBot: () => void;
  onUpdatePayment: (data: Partial<ShopeePayment>) => Promise<void>;
  onUpdateSettings: (settings: BotSettings) => void;
  onOpenTargetUrlModal: (target?: TargetUrl) => void;
  onDeleteTargetUrl: (id: string) => Promise<void>;
  selectedTargetId: string;
  onSelectTarget: (id: string) => void;
  selectedAccountId: string;
  onSelectAccount: (id: string) => void;
  onOpenAccountModal: (a?: ShopeeAccount) => void;
  onOpenBulkAccountModal: () => void;
  onDeleteAccount: (id: string) => Promise<void>;
  selectedAddressId: string;
  onSelectAddress: (id: string) => void;
  onOpenAddressModal: (a?: Address) => void;
  onDeleteAddress: (id: string) => Promise<void>;
  onOpenProxyModal: (p?: ProxyMesh) => void;
  onDeleteProxy: (id: string) => Promise<void>;
  onTestProxy: (p: ProxyMesh) => Promise<void>;
  testingProxyId: string | null;
  onOpenScheduleModal: (s?: Schedule) => void;
  onDeleteSchedule: (id: string) => Promise<void>;
  onUseSchedule: (s: Schedule) => void;
  onRequestNotification: () => void;
  maxThreads: number;
  effectiveLeadMs: number;
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

const RowBtns: React.FC<{ onEdit: () => void; onDelete: () => void; label: string }> = ({ onEdit, onDelete, label }) => {
  const { L } = useLang();
  return (
    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
      <button type="button" className="gx-iconbtn" style={{ width: 32, height: 32 }} onClick={onEdit} aria-label={`${L('Edit', 'Edit')} ${label}`}>
        <Pencil size={14} />
      </button>
      <button type="button" className="gx-iconbtn" style={{ width: 32, height: 32 }} onClick={onDelete} aria-label={`${L('Hapus', 'Delete')} ${label}`}>
        <Trash2 size={14} />
      </button>
    </div>
  );
};

const Radio: React.FC<{ checked: boolean; onChange: () => void; label: string; name: string }> = ({ checked, onChange, label, name }) => (
  <input type="radio" name={name} checked={checked} onChange={onChange} aria-label={label} style={{ accentColor: 'var(--gx-brand)', width: 16, height: 16, flexShrink: 0 }} />
);

export const ControlPanel: React.FC<ControlPanelProps> = (p) => {
  const { L, lang, setLang, locale } = useLang();
  const selectedRegion = isAseanCode(p.selectedRegion) ? p.selectedRegion : 'ID';
  const reg = ASEAN_REGIONS[selectedRegion];
  const s = p.botSettings;

  // ---------- Pembayaran (disinkronkan saat data server datang) ----------
  const [payMethod, setPayMethod] = useState('');
  const [pin, setPin] = useState('');
  const [voucher, setVoucher] = useState('');
  const [fallback, setFallback] = useState('none');
  const [autoOngkir, setAutoOngkir] = useState(true);
  const [autoDiscount, setAutoDiscount] = useState(true);
  const [tgToken, setTgToken] = useState('');
  const [tgChatId, setTgChatId] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tgTest, setTgTest] = useState<'idle' | 'sending' | 'ok' | 'fail'>('idle');

  useEffect(() => {
    const ps = p.paymentSettings;
    setPayMethod(ps?.payment_method && ps.payment_method !== 'cod' ? ps.payment_method : reg.popularPaymentMethods[0]?.id || 'shopeepay');
    setPin(ps?.shopeepay_pin || '');
    setVoucher(ps?.custom_voucher_code || '');
    setFallback(ps?.payment_fallback && ps.payment_fallback !== 'cod' ? ps.payment_fallback : 'none');
    setAutoOngkir((ps?.auto_ongkir ?? 'true') !== 'false');
    setAutoDiscount((ps?.auto_discount ?? 'true') !== 'false');
    setTgToken(ps?.telegram_token || '');
    setTgChatId(ps?.telegram_chat_id || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.paymentSettings]);

  const methods = reg.popularPaymentMethods;
  const methodInRegion = methods.some((m) => m.id === payMethod);
  const needsPin = paymentFamily(payMethod) === 'shopeepay';
  const pinInvalid = pin !== '' && !/^\d{6}$/.test(pin);

  const savePayment = async () => {
    if (pinInvalid) return;
    setSaving(true);
    try {
      await p.onUpdatePayment({
        payment_method: payMethod,
        shopeepay_pin: pin,
        custom_voucher_code: voucher.trim(),
        payment_fallback: fallback,
        auto_ongkir: autoOngkir ? 'true' : 'false',
        auto_discount: autoDiscount ? 'true' : 'false',
        telegram_token: tgToken.trim(),
        telegram_chat_id: tgChatId.trim(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // pesan error sudah ditampilkan oleh App (toast)
    } finally {
      setSaving(false);
    }
  };

  const testTelegram = async () => {
    setTgTest('sending');
    const ok = await api.testTelegram(tgToken.trim(), tgChatId.trim(), L('✅ Notifikasi GaneMaX.Ai terhubung. Hasil war akan dikirim ke sini.', '✅ GaneMaX.Ai notifications connected. War results will be sent here.'));
    setTgTest(ok ? 'ok' : 'fail');
    setTimeout(() => setTgTest('idle'), 3000);
  };

  const actionBar = (
    <div style={{ display: 'flex', gap: 10 }}>
      {p.isBotRunning ? (
        <button type="button" className="gx-btn gx-btn--lg gx-btn--danger gx-btn--block" onClick={p.onStopBot}>
          <Square size={16} fill="currentColor" /> {L('Hentikan sesi', 'Stop session')}
        </button>
      ) : (
        <button type="button" className="gx-btn gx-btn--lg gx-btn--primary gx-btn--block" onClick={p.onStartBot}>
          <Zap size={18} fill="currentColor" /> {L('Jalankan bot sekarang', 'Run bot now')}
        </button>
      )}
    </div>
  );

  const quota = p.currentUser?.role === 'admin' ? null : p.currentUser?.max_accounts || 5;
  const regionTag = (r?: string) => (r && isAseanCode(r) ? <span className="gx-tag" style={{ height: 18, fontSize: 10 }}>{r}</span> : null);

  /* ================================================================ */
  if (p.section === 'setup') {
    return (
      <div className="gx-grid gx-grid--2" style={{ alignItems: 'start' }}>
        <div className="gx-col">
          {/* TARGET */}
          <Card
            icon={<Crosshair size={16} />}
            title={`${L('Target produk', 'Target products')} (${p.targetUrls.length})`}
            aside={
              <button type="button" className="gx-btn gx-btn--xs gx-btn--primary" onClick={() => p.onOpenTargetUrlModal()}>
                <Plus size={13} /> {L('Tambah', 'Add')}
              </button>
            }
          >
            {p.targetUrls.length === 0 ? (
              <div className="gx-empty">{L('Belum ada target. Salin link produk dari app Shopee lalu tambahkan di sini.', 'No targets yet. Copy a product link from the Shopee app and add it here.')}</div>
            ) : (
              <ul className="gx-list" role="radiogroup" aria-label={L('Target aktif', 'Active target')}>
                {p.targetUrls.map((t) => {
                  const active = t.id === p.selectedTargetId;
                  const ids = parseShopeeLink(t.url);
                  const valid = isValidHttpUrl(t.url);
                  const tRegion = isAseanCode(t.region) ? t.region : selectedRegion;
                  return (
                    <li key={t.id} className="gx-row">
                      <Radio name="active-target" checked={active} onChange={() => p.onSelectTarget(t.id)} label={t.title} />
                      <div className="gx-row__main" onClick={() => p.onSelectTarget(t.id)} style={{ cursor: 'pointer' }}>
                        <div className="gx-row__t">{t.title}</div>
                        <div className="gx-row__s">
                          <span style={{ color: 'var(--gx-brand)', fontWeight: 700 }}>{formatAseanCurrency(Number(t.target_price) || 0, tRegion)}</span> · {tRegion} ·{' '}
                          <span style={{ color: valid ? (ids ? 'var(--gx-ok)' : 'var(--gx-warn)') : 'var(--gx-bad)' }}>
                            {valid ? (ids ? L('link valid', 'valid link') : L('link pendek', 'short link')) : L('link tidak valid', 'invalid link')}
                          </span>
                        </div>
                      </div>
                      <RowBtns label={t.title} onEdit={() => p.onOpenTargetUrlModal(t)} onDelete={() => p.onDeleteTargetUrl(t.id)} />
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* AKUN */}
          <Card
            icon={<UserRound size={16} />}
            title={`${L('Akun Shopee', 'Shopee accounts')} (${p.accounts.length}${quota ? `/${quota}` : ''})`}
            aside={
              <>
                <button type="button" className="gx-btn gx-btn--xs" onClick={p.onOpenBulkAccountModal}>
                  <FileUp size={13} /> {L('Impor', 'Import')}
                </button>
                <button type="button" className="gx-btn gx-btn--xs gx-btn--primary" onClick={() => p.onOpenAccountModal()}>
                  <Plus size={13} /> {L('Tambah', 'Add')}
                </button>
              </>
            }
          >
            {p.accounts.length === 0 ? (
              <div className="gx-empty">{L('Belum ada akun. Tambahkan akun Shopee beserta cookies login & PIN.', 'No accounts yet. Add a Shopee account with login cookies & PIN.')}</div>
            ) : (
              <ul className="gx-list" role="radiogroup" aria-label={L('Akun dipakai', 'Account in use')}>
                {p.accounts.map((a) => {
                  const active = a.id === p.selectedAccountId || (!p.selectedAccountId && a.id === p.accounts[0].id);
                  return (
                    <li key={a.id} className="gx-row">
                      <Radio name="active-account" checked={active} onChange={() => p.onSelectAccount(a.id)} label={a.nickname} />
                      <div className="gx-row__main" onClick={() => p.onSelectAccount(a.id)} style={{ cursor: 'pointer' }}>
                        <div className="gx-row__t" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {a.nickname || a.username} {regionTag(a.region)}
                        </div>
                        <div className="gx-row__s">
                          @{a.username} · {a.cookies ? L('cookies ✓', 'cookies ✓') : L('tanpa cookies', 'no cookies')} · {a.pin ? 'PIN ✓' : L('tanpa PIN', 'no PIN')}
                        </div>
                      </div>
                      <RowBtns label={a.nickname} onEdit={() => p.onOpenAccountModal(a)} onDelete={() => p.onDeleteAccount(a.id)} />
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* ALAMAT */}
          <Card
            icon={<MapPin size={16} />}
            title={`${L('Alamat pengiriman', 'Shipping addresses')} (${p.addresses.length})`}
            aside={
              <button type="button" className="gx-btn gx-btn--xs gx-btn--primary" onClick={() => p.onOpenAddressModal()}>
                <Plus size={13} /> {L('Tambah', 'Add')}
              </button>
            }
          >
            {p.addresses.length === 0 ? (
              <div className="gx-empty">{L('Belum ada alamat checkout.', 'No checkout address yet.')}</div>
            ) : (
              <ul className="gx-list" role="radiogroup" aria-label={L('Alamat dipakai', 'Address in use')}>
                {p.addresses.map((a) => {
                  const fallbackId = (p.addresses.find((x) => x.is_default) || p.addresses[0]).id;
                  const active = a.id === (p.selectedAddressId && p.addresses.some((x) => x.id === p.selectedAddressId) ? p.selectedAddressId : fallbackId);
                  return (
                    <li key={a.id} className="gx-row">
                      <Radio name="active-address" checked={active} onChange={() => p.onSelectAddress(a.id)} label={a.label} />
                      <div className="gx-row__main" onClick={() => p.onSelectAddress(a.id)} style={{ cursor: 'pointer' }}>
                        <div className="gx-row__t" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {a.label} {a.is_default && <span className="gx-tag gx-tag--ok" style={{ height: 18, fontSize: 10 }}>{L('Utama', 'Default')}</span>} {regionTag(a.country)}
                        </div>
                        <div className="gx-row__s">
                          {a.recipient_name} · {a.phone}
                        </div>
                        <div className="gx-row__s">{a.full_address}</div>
                      </div>
                      <RowBtns label={a.label} onEdit={() => p.onOpenAddressModal(a)} onDelete={() => p.onDeleteAddress(a.id)} />
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="gx-col">
          {/* PEMBAYARAN */}
          <Card icon={<Wallet size={16} />} title={`${L('Pembayaran', 'Payment')} · Shopee ${reg.name}`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {!methodInRegion && payMethod && (
                <div className="gx-note gx-note--warn">
                  {L(`Metode tersimpan (${payMethod}) bukan untuk Shopee ${reg.name}. Pilih ulang lalu simpan.`, `Saved method (${payMethod}) is not for Shopee ${reg.name}. Pick again and save.`)}
                </div>
              )}
              <div className="gx-formgrid gx-formgrid--2">
                <label className="gx-field">
                  <span>{L('Metode utama', 'Main method')}</span>
                  <select value={methodInRegion ? payMethod : ''} onChange={(e) => setPayMethod(e.target.value)}>
                    {!methodInRegion && <option value="">{L('— pilih —', '— select —')}</option>}
                    {methods.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="gx-field">
                  <span>{L('PIN ShopeePay', 'ShopeePay PIN')}</span>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPin ? 'text' : 'password'}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder={L('6 digit', '6 digits')}
                      inputMode="numeric"
                      autoComplete="off"
                      style={{ paddingRight: 40 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin((v) => !v)}
                      aria-label={showPin ? L('Sembunyikan PIN', 'Hide PIN') : L('Lihat PIN', 'Show PIN')}
                      style={{ position: 'absolute', right: 6, top: 6, border: 0, background: 'none', color: 'var(--gx-ink-3)', cursor: 'pointer', padding: 4 }}
                    >
                      {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {pinInvalid ? (
                    <small style={{ color: 'var(--gx-bad)' }}>{L('PIN harus 6 digit angka', 'PIN must be 6 digits')}</small>
                  ) : needsPin && !pin ? (
                    <small>{L('Disarankan diisi untuk ShopeePay', 'Recommended for ShopeePay')}</small>
                  ) : null}
                </label>
                <label className="gx-field">
                  <span>{L('Cadangan jika saldo kurang', 'Fallback if balance is low')}</span>
                  <select value={fallback} onChange={(e) => setFallback(e.target.value)}>
                    <option value="none">{L('Tidak ada', 'None')}</option>
                    {methods
                      .filter((m) => m.id !== payMethod)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="gx-field">
                  <span>{L('Kode voucher (opsional)', 'Voucher code (optional)')}</span>
                  <input value={voucher} onChange={(e) => setVoucher(e.target.value.toUpperCase())} placeholder="FS1000" />
                </label>
              </div>
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                <label className="gx-switch">
                  <input type="checkbox" checked={autoOngkir} onChange={(e) => setAutoOngkir(e.target.checked)} />
                  {L('Klaim gratis ongkir', 'Claim free shipping')}
                </label>
                <label className="gx-switch">
                  <input type="checkbox" checked={autoDiscount} onChange={(e) => setAutoDiscount(e.target.checked)} />
                  {L('Pasang voucher diskon', 'Apply discount voucher')}
                </label>
              </div>

              <div className="gx-menudiv" style={{ margin: '4px 0' }} />
              <div className="gx-eyebrow">{L('Notifikasi Telegram (opsional)', 'Telegram notifications (optional)')}</div>
              <div className="gx-formgrid gx-formgrid--2">
                <label className="gx-field">
                  <span>Bot token</span>
                  <input value={tgToken} onChange={(e) => setTgToken(e.target.value)} placeholder="123456:ABC…" autoComplete="off" />
                </label>
                <label className="gx-field">
                  <span>Chat ID</span>
                  <input value={tgChatId} onChange={(e) => setTgChatId(e.target.value)} placeholder="987654321" />
                </label>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="gx-btn gx-btn--primary" onClick={savePayment} disabled={saving || pinInvalid || !payMethod}>
                  <Save size={15} /> {saving ? L('Menyimpan…', 'Saving…') : saved ? L('Tersimpan', 'Saved') : L('Simpan pengaturan', 'Save settings')}
                </button>
                <button type="button" className="gx-btn" onClick={testTelegram} disabled={!tgToken || !tgChatId || tgTest === 'sending'}>
                  <Send size={14} />
                  {tgTest === 'sending' ? L('Mengirim…', 'Sending…') : tgTest === 'ok' ? L('Terkirim', 'Sent') : tgTest === 'fail' ? L('Gagal — cek token', 'Failed — check token') : L('Tes Telegram', 'Test Telegram')}
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
  // ENGINE
  const lead = Number(s.openLeadMs ?? 800);
  const now = Date.now();
  const sortedSchedules = [...p.schedules].sort((a, b) => new Date(a.target_time).getTime() - new Date(b.target_time).getTime());

  return (
    <div className="gx-grid gx-grid--2" style={{ alignItems: 'start' }}>
      <div className="gx-col">
        {/* WILAYAH + BAHASA */}
        <Card icon={<Globe size={16} />} title={L('Wilayah Shopee ASEAN', 'Shopee ASEAN region')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="gx-chips" role="radiogroup" aria-label={L('Wilayah', 'Region')}>
              {ALL_ASEAN_CODES.map((code) => (
                <button key={code} type="button" role="radio" aria-checked={selectedRegion === code} className="gx-chip" aria-pressed={selectedRegion === code} onClick={() => p.onSelectRegion?.(code)}>
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
                <div className="gx-metric__k">{L('Mata uang', 'Currency')}</div>
                <div className="gx-metric__v" style={{ fontSize: 13, whiteSpace: 'normal' }}>
                  {reg.currency} · {formatAseanCurrency(reg.code === 'ID' || reg.code === 'VN' ? 1000 : 1, reg.code)}
                </div>
              </div>
              <div className="gx-metric">
                <div className="gx-metric__k">{L('Zona waktu', 'Time zone')}</div>
                <div className="gx-metric__v" style={{ fontSize: 13, whiteSpace: 'normal' }}>{reg.timezoneLabel}</div>
              </div>
              <div className="gx-metric">
                <div className="gx-metric__k">{L('Sesi flash sale', 'Flash sale sessions')}</div>
                <div className="gx-metric__v" style={{ fontSize: 13, whiteSpace: 'normal' }}>{reg.flashSaleSchedule.join(' · ')}</div>
              </div>
            </div>
            <div className="gx-field">
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Languages size={14} /> {L('Bahasa tampilan', 'Display language')}
              </span>
              <div className="gx-seg" role="group" aria-label="Language">
                <button type="button" aria-pressed={lang === 'id'} onClick={() => setLang('id')}>
                  🇮🇩 Bahasa Indonesia
                </button>
                <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>
                  🇬🇧 English
                </button>
              </div>
            </div>
          </div>
        </Card>

        {/* JADWAL */}
        <Card
          icon={<CalendarClock size={16} />}
          title={`${L('Jadwal war tersimpan', 'Saved war schedules')} (${p.schedules.length})`}
          aside={
            <button type="button" className="gx-btn gx-btn--xs gx-btn--primary" onClick={() => p.onOpenScheduleModal()}>
              <Plus size={13} /> {L('Tambah', 'Add')}
            </button>
          }
        >
          {sortedSchedules.length === 0 ? (
            <div className="gx-empty">{L('Simpan jadwal event (mis. 12.12 00:00) lalu tekan "Pakai" untuk auto-start.', 'Save event times (e.g. 12.12 00:00) then press "Use" to auto-start.')}</div>
          ) : (
            <ul className="gx-list">
              {sortedSchedules.map((sc) => {
                const t = new Date(sc.target_time).getTime();
                const past = isNaN(t) || t <= now;
                return (
                  <li key={sc.id} className="gx-row">
                    <div className="gx-row__main">
                      <div className="gx-row__t">{sc.title}</div>
                      <div className="gx-row__s">
                        {isNaN(t) ? '-' : new Date(t).toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        {' · '}
                        {past ? L('lewat', 'passed') : sc.is_active === false ? L('nonaktif', 'inactive') : L('akan datang', 'upcoming')}
                      </div>
                    </div>
                    <button type="button" className="gx-btn gx-btn--xs" disabled={past || sc.is_active === false} onClick={() => p.onUseSchedule(sc)}>
                      <Play size={12} /> {L('Pakai', 'Use')}
                    </button>
                    <RowBtns label={sc.title} onEdit={() => p.onOpenScheduleModal(sc)} onDelete={() => p.onDeleteSchedule(sc.id)} />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* PROXY */}
        <Card
          icon={<Network size={16} />}
          title={`Proxy (${p.proxies.length})`}
          aside={
            <button type="button" className="gx-btn gx-btn--xs gx-btn--primary" onClick={() => p.onOpenProxyModal()}>
              <Plus size={13} /> {L('Tambah', 'Add')}
            </button>
          }
        >
          {p.proxies.length === 0 ? (
            <div className="gx-empty">{L('Belum ada proxy. Tambahkan proxy HTTP lalu tes koneksinya ke Shopee.', 'No proxies yet. Add an HTTP proxy and test its connection to Shopee.')}</div>
          ) : (
            <ul className="gx-list">
              {p.proxies.map((px) => {
                const st = px.status || 'checking';
                const tone = st === 'active' ? 'var(--gx-ok)' : st === 'dead' ? 'var(--gx-bad)' : 'var(--gx-ink-3)';
                return (
                  <li key={px.id} className="gx-row">
                    <span className="gx-led" style={{ color: tone }} />
                    <div className="gx-row__main">
                      <div className="gx-row__t gx-mono" style={{ fontWeight: 600 }}>
                        {px.host}:{px.port}
                      </div>
                      <div className="gx-row__s">
                        {px.region || '-'} ·{' '}
                        {st === 'active' ? `${L('aktif', 'active')} · ${px.latency_ms ?? '-'} ms` : st === 'dead' ? L('mati', 'dead') : L('belum dites', 'not tested')}
                        {px.last_checked ? ` · ${relativeTimeId(px.last_checked, Date.now(), lang)}` : ''}
                      </div>
                    </div>
                    <button type="button" className="gx-btn gx-btn--xs" onClick={() => p.onTestProxy(px)} disabled={p.testingProxyId === px.id}>
                      <RefreshCw size={12} className={p.testingProxyId === px.id ? 'gx-spin' : ''} /> {L('Tes', 'Test')}
                    </button>
                    <RowBtns label={px.host} onEdit={() => p.onOpenProxyModal(px)} onDelete={() => p.onDeleteProxy(px.id)} />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <div className="gx-col">
        {/* PARAMETER ENGINE */}
        <Card icon={<SlidersHorizontal size={16} />} title={L('Parameter engine', 'Engine parameters')}>
          <div className="gx-formgrid gx-formgrid--2">
            <label className="gx-field">
              <span>{L('Mode eksekusi', 'Execution mode')}</span>
              <select value={s.botMode} onChange={(e) => p.onUpdateSettings({ ...s, botMode: e.target.value as BotSettings['botMode'] })}>
                <option value="turbo">{L('Turbo — monitor rapat', 'Turbo — tight monitoring')}</option>
                <option value="stealth">{L('Stealth — request minimal', 'Stealth — minimal requests')}</option>
                <option value="ai">{L('AI — jeda buka otomatis', 'AI — automatic open lead')}</option>
              </select>
            </label>
            <label className="gx-field">
              <span>{L('Thread paralel', 'Parallel threads')}</span>
              <input
                type="number"
                min={1}
                max={p.maxThreads}
                value={s.threadCount}
                onChange={(e) => p.onUpdateSettings({ ...s, threadCount: Math.max(1, Math.min(p.maxThreads, Number(e.target.value) || 1)) })}
              />
              <small>{L(`Request paralel saat ukur gateway (maks. ${Math.min(8, p.maxThreads)})`, `Parallel requests when measuring gateway (max ${Math.min(8, p.maxThreads)})`)}</small>
            </label>
            <label className="gx-field">
              <span>{L('Polling rate standby (ms)', 'Standby polling rate (ms)')}</span>
              <input type="number" min={2000} max={60000} step={500} value={s.pollRate} onChange={(e) => p.onUpdateSettings({ ...s, pollRate: Math.max(2000, Math.min(60000, Number(e.target.value) || 2000)) })} />
              <small>{L('Jarak cek gateway saat menunggu sesi', 'Gateway check interval while waiting')}</small>
            </label>
            <label className="gx-field">
              <span>{L('Maks. retry cek produk', 'Max product check retries')}</span>
              <input type="number" min={0} max={9} value={s.maxRetry} onChange={(e) => p.onUpdateSettings({ ...s, maxRetry: Math.max(0, Math.min(9, Number(e.target.value) || 0)) })} />
            </label>
            <label className="gx-field">
              <span>{L('Jeda retry (ms)', 'Retry delay (ms)')}</span>
              <input type="number" min={0} max={5000} step={100} value={s.retryDelay} onChange={(e) => p.onUpdateSettings({ ...s, retryDelay: Math.max(0, Math.min(5000, Number(e.target.value) || 0)) })} />
            </label>
            <label className="gx-field">
              <span>{L('Cara membuka', 'Open method')}</span>
              <select value={s.openMode || 'app'} onChange={(e) => p.onUpdateSettings({ ...s, openMode: e.target.value as 'app' | 'browser' })}>
                <option value="app">{L('App Shopee', 'Shopee app')} {isAndroid() ? L('(langsung masuk app)', '(opens the app)') : ''}</option>
                <option value="browser">{L('Browser (tab baru)', 'Browser (new tab)')}</option>
              </select>
            </label>
          </div>
          <label className="gx-field" style={{ marginTop: 14 }}>
            <span style={{ display: 'flex', justifyContent: 'space-between' }}>
              {L('Pre-fire: buka Shopee lebih awal', 'Pre-fire: open Shopee early')} <b className="gx-mono">{s.botMode === 'ai' ? `${p.effectiveLeadMs} ms (AI)` : `${lead} ms`}</b>
            </span>
            <input
              type="range"
              min={0}
              max={3000}
              step={100}
              value={lead}
              disabled={s.botMode === 'ai'}
              onChange={(e) => p.onUpdateSettings({ ...s, openLeadMs: Number(e.target.value) })}
              style={{ accentColor: 'var(--gx-brand)', minHeight: 0, padding: 0, border: 0 }}
            />
            <small>{L('App Shopee butuh ±0,5–1,5 dtk untuk terbuka. Atur supaya halaman produk muncul pas detik 0.', 'The Shopee app needs about 0.5–1.5 s to open. Tune it so the product page appears right at second zero.')}</small>
          </label>
        </Card>

        {/* NOTIFIKASI */}
        <Card icon={<Timer size={16} />} title={L('Notifikasi & peringatan', 'Notifications & alerts')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label className="gx-switch">
              <input type="checkbox" checked={s.soundAlert !== false} onChange={(e) => p.onUpdateSettings({ ...s, soundAlert: e.target.checked })} />
              {L('Bunyi beep T-3, T-2, T-1 & detik 0', 'Beep at T-3, T-2, T-1 & second zero')}
            </label>
            <label className="gx-switch">
              <input type="checkbox" checked={s.vibrateAlert !== false} onChange={(e) => p.onUpdateSettings({ ...s, vibrateAlert: e.target.checked })} />
              {L('Getar saat detik 0', 'Vibrate at second zero')}
            </label>
            <label className="gx-switch">
              <input type="checkbox" checked={s.notifySuccess !== false} onChange={(e) => p.onUpdateSettings({ ...s, notifySuccess: e.target.checked })} />
              {L('Notifikasi saat berhasil / sesi dimulai', 'Notify on success / session start')}
            </label>
            <label className="gx-switch">
              <input type="checkbox" checked={s.notifyError !== false} onChange={(e) => p.onUpdateSettings({ ...s, notifyError: e.target.checked })} />
              {L('Notifikasi saat error', 'Notify on errors')}
            </label>
            <label className="gx-switch">
              <input type="checkbox" checked={s.notifyRateLimit !== false} onChange={(e) => p.onUpdateSettings({ ...s, notifyRateLimit: e.target.checked })} />
              {L('Notifikasi saat dibatasi Shopee (HTTP 429)', 'Notify when rate limited by Shopee (HTTP 429)')}
            </label>
            <button type="button" className="gx-btn gx-btn--sm" style={{ alignSelf: 'flex-start' }} onClick={p.onRequestNotification}>
              <BellRing size={14} /> {L('Izinkan notifikasi browser', 'Allow browser notifications')}
            </button>
          </div>
        </Card>
        {actionBar}
      </div>
    </div>
  );
};
