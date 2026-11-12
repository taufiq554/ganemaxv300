import React, { useEffect, useState } from 'react';
import { X, Eye, EyeOff, MapPin, UserRound, Link2, Network, CalendarClock } from 'lucide-react';
import { Address, ShopeeAccount, TargetUrl, ProxyMesh, Schedule, AseanCountryCode } from '../types/index.ts';
import { ASEAN_REGIONS, ALL_ASEAN_CODES, isAseanCode } from '../constants/asean.ts';
import { useLang } from '../lib/i18n.tsx';
import { parseShopeeLink, isValidHttpUrl } from '../lib/shopee.ts';

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

const GxModal: React.FC<{
  open: boolean;
  title: string;
  icon: React.ReactNode;
  onClose: () => void;
  onSubmit: () => Promise<void> | void;
  busy: boolean;
  submitLabel: string;
  error?: string | null;
  children: React.ReactNode;
}> = ({ open, title, icon, onClose, onSubmit, busy, submitLabel, error, children }) => {
  const { L } = useLang();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);
  if (!open) return null;
  return (
    <div className="gx-overlay gx-overlay--center" onClick={() => !busy && onClose()}>
      <form
        className="gx-dialog"
        style={{ width: 'min(560px, 100%)' }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!busy) await onSubmit();
        }}
      >
        <div className="gx-dialog__head">
          <span className="gx-qa__icon" style={{ width: 34, height: 34, borderRadius: 11 }}>
            {icon}
          </span>
          <h3>{title}</h3>
          <button type="button" className="gx-iconbtn" style={{ marginLeft: 'auto' }} onClick={onClose} disabled={busy} aria-label={L('Tutup', 'Close')}>
            <X size={16} />
          </button>
        </div>
        <div className="gx-dialog__body">
          {children}
          {error && (
            <div className="gx-note gx-note--bad" role="alert">
              {error}
            </div>
          )}
        </div>
        <div className="gx-dialog__foot">
          <button type="button" className="gx-btn gx-btn--sm" onClick={onClose} disabled={busy}>
            {L('Batal', 'Cancel')}
          </button>
          <button type="submit" className="gx-btn gx-btn--sm gx-btn--primary" disabled={busy}>
            {busy ? L('Menyimpan…', 'Saving…') : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
};

const RegionSelect: React.FC<{ value: AseanCountryCode; onChange: (v: AseanCountryCode) => void }> = ({ value, onChange }) => {
  const { L } = useLang();
  return (
    <label className="gx-field">
      <span>{L('Wilayah Shopee', 'Shopee region')}</span>
      <select value={value} onChange={(e) => onChange(isAseanCode(e.target.value) ? e.target.value : 'ID')}>
        {ALL_ASEAN_CODES.map((code) => {
          const r = ASEAN_REGIONS[code];
          return (
            <option key={code} value={code}>
              {r.name} · {r.domain} ({r.currency})
            </option>
          );
        })}
      </select>
    </label>
  );
};

/** Jalankan onSave; tutup modal hanya kalau berhasil (tidak lempar error) */
function useSaver(onSave: (d: any) => Promise<void>, onClose: () => void) {
  const { L } = useLang();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (payload: any) => {
    setBusy(true);
    setError(null);
    try {
      await onSave(payload);
      onClose();
    } catch (e: any) {
      setError(e?.message || L('Gagal menyimpan. Coba lagi.', 'Failed to save. Please try again.'));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, save };
}

/* ------------------------------------------------------------------ */
/* 1. Address                                                          */
/* ------------------------------------------------------------------ */

interface AddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Address>) => Promise<void>;
  initialData?: Address | null;
  defaultRegion?: AseanCountryCode;
}

export const AddressModal: React.FC<AddressModalProps> = ({ isOpen, onClose, onSave, initialData, defaultRegion = 'ID' }) => {
  const { L } = useLang();
  const [label, setLabel] = useState('');
  const [recipient, setRecipient] = useState('');
  const [phone, setPhone] = useState('');
  const [fullAddress, setFullAddress] = useState('');
  const [country, setCountry] = useState<AseanCountryCode>(defaultRegion);
  const [postalCode, setPostalCode] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const { busy, error, setError, save } = useSaver(onSave, onClose);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setLabel(initialData?.label || '');
    setRecipient(initialData?.recipient_name || '');
    setPhone(initialData?.phone || '');
    setFullAddress(initialData?.full_address || '');
    setCountry(isAseanCode(initialData?.country) ? initialData!.country! : defaultRegion);
    setPostalCode(initialData?.postal_code || '');
    setIsDefault(Boolean(initialData?.is_default));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData, isOpen, defaultRegion]);

  const reg = ASEAN_REGIONS[country] || ASEAN_REGIONS.ID;

  return (
    <GxModal
      open={isOpen}
      title={initialData ? L('Edit alamat', 'Edit address') : L('Tambah alamat', 'Add address')}
      icon={<MapPin size={17} />}
      onClose={onClose}
      busy={busy}
      error={error}
      submitLabel={L('Simpan alamat', 'Save address')}
      onSubmit={() => {
        if (!label.trim() || !recipient.trim() || !phone.trim() || !fullAddress.trim()) {
          setError(L('Label, penerima, telepon, dan alamat wajib diisi.', 'Label, recipient, phone and address are required.'));
          return;
        }
        return save({
          label: label.trim(),
          recipient_name: recipient.trim(),
          phone: phone.trim(),
          full_address: fullAddress.trim(),
          country,
          postal_code: postalCode.trim(),
          is_default: isDefault,
        });
      }}
    >
      <div className="gx-formgrid gx-formgrid--2">
        <RegionSelect value={country} onChange={setCountry} />
        <label className="gx-field">
          <span>{L('Label alamat', 'Address label')}</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={L('Rumah / Kantor', 'Home / Office')} />
        </label>
        <label className="gx-field">
          <span>{L('Nama penerima', 'Recipient name')}</span>
          <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder={L('Nama lengkap', 'Full name')} />
        </label>
        <label className="gx-field">
          <span>{L('Telepon', 'Phone')}</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={`${reg.phonePrefix} 812…`} inputMode="tel" />
        </label>
      </div>
      <label className="gx-field">
        <span>{L('Alamat lengkap', 'Full address')}</span>
        <textarea value={fullAddress} onChange={(e) => setFullAddress(e.target.value)} placeholder={L('Jalan, nomor, kecamatan, kota', 'Street, number, district, city')} />
      </label>
      <div className="gx-formgrid gx-formgrid--2">
        <label className="gx-field">
          <span>{L('Kode pos', 'Postal code')}</span>
          <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} inputMode="numeric" />
        </label>
        <label className="gx-switch" style={{ alignSelf: 'end', paddingBottom: 10 }}>
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
          {L('Jadikan alamat utama', 'Set as default')}
        </label>
      </div>
    </GxModal>
  );
};

/* ------------------------------------------------------------------ */
/* 2. Shopee account                                                   */
/* ------------------------------------------------------------------ */

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<ShopeeAccount>) => Promise<void>;
  initialData?: ShopeeAccount | null;
  defaultRegion?: AseanCountryCode;
}

export const AccountModal: React.FC<AccountModalProps> = ({ isOpen, onClose, onSave, initialData, defaultRegion = 'ID' }) => {
  const { L } = useLang();
  const [nickname, setNickname] = useState('');
  const [username, setUsername] = useState('');
  const [region, setRegion] = useState<AseanCountryCode>(defaultRegion);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [cookies, setCookies] = useState('');
  const [showPass, setShowPass] = useState(false);
  const { busy, error, setError, save } = useSaver(onSave, onClose);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setShowPass(false);
    setNickname(initialData?.nickname || '');
    setUsername(initialData?.username || '');
    setRegion(isAseanCode(initialData?.region) ? initialData!.region! : defaultRegion);
    setEmail(initialData?.email || '');
    setPhone(initialData?.phone || '');
    setPassword(initialData?.password || '');
    setPin(initialData?.pin || '');
    setCookies(initialData?.cookies || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData, isOpen, defaultRegion]);

  const cookieLooksValid = !cookies || /SPC_EC=|SPC_ST=|SPC_U=/.test(cookies);

  return (
    <GxModal
      open={isOpen}
      title={initialData ? L('Edit akun Shopee', 'Edit Shopee account') : L('Tambah akun Shopee', 'Add Shopee account')}
      icon={<UserRound size={17} />}
      onClose={onClose}
      busy={busy}
      error={error}
      submitLabel={L('Simpan akun', 'Save account')}
      onSubmit={() => {
        if (!username.trim()) {
          setError(L('Username Shopee wajib diisi.', 'Shopee username is required.'));
          return;
        }
        if (pin && !/^\d{6}$/.test(pin)) {
          setError(L('PIN ShopeePay harus 6 digit angka.', 'ShopeePay PIN must be 6 digits.'));
          return;
        }
        return save({
          nickname: nickname.trim() || username.trim(),
          username: username.trim(),
          region,
          email: email.trim(),
          phone: phone.trim(),
          password,
          pin,
          cookies: cookies.trim(),
        });
      }}
    >
      <div className="gx-formgrid gx-formgrid--2">
        <RegionSelect value={region} onChange={setRegion} />
        <label className="gx-field">
          <span>{L('Nama panggilan', 'Nickname')}</span>
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder={L('Akun utama', 'Main account')} />
        </label>
        <label className="gx-field">
          <span>{L('Username Shopee', 'Shopee username')}</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
        </label>
        <label className="gx-field">
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
        </label>
        <label className="gx-field">
          <span>{L('Telepon', 'Phone')}</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
        </label>
        <label className="gx-field">
          <span>Password</span>
          <div style={{ position: 'relative' }}>
            <input type={showPass ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" style={{ paddingRight: 40 }} />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              aria-label={showPass ? L('Sembunyikan', 'Hide') : L('Lihat', 'Show')}
              style={{ position: 'absolute', right: 6, top: 6, border: 0, background: 'none', color: 'var(--gx-ink-3)', cursor: 'pointer', padding: 4 }}
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>
        <label className="gx-field">
          <span>{L('PIN ShopeePay (6 digit)', 'ShopeePay PIN (6 digits)')}</span>
          <input
            type={showPass ? 'text' : 'password'}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="off"
          />
        </label>
      </div>
      <label className="gx-field">
        <span>{L('Cookies sesi login', 'Login session cookies')}</span>
        <textarea value={cookies} onChange={(e) => setCookies(e.target.value)} placeholder="SPC_EC=…; SPC_U=…; SPC_ST=…" style={{ fontFamily: 'var(--gx-mono)', fontSize: 12 }} />
        <small style={{ color: cookieLooksValid ? undefined : 'var(--gx-warn)' }}>
          {cookieLooksValid
            ? L('Dipakai bot untuk mengambil data produk atas nama akun ini.', 'Used by the bot to fetch product data as this account.')
            : L('Format cookie belum lengkap (butuh SPC_EC / SPC_U / SPC_ST).', 'Cookie looks incomplete (needs SPC_EC / SPC_U / SPC_ST).')}
        </small>
      </label>
    </GxModal>
  );
};

/* ------------------------------------------------------------------ */
/* 3. Target URL                                                       */
/* ------------------------------------------------------------------ */

interface TargetUrlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<TargetUrl>) => Promise<void>;
  initialData?: TargetUrl | null;
  defaultRegion?: AseanCountryCode;
}

const DOMAIN_TO_REGION: Record<string, AseanCountryCode> = {
  'shopee.co.id': 'ID',
  'shopee.sg': 'SG',
  'shopee.com.my': 'MY',
  'shopee.co.th': 'TH',
  'shopee.vn': 'VN',
  'shopee.ph': 'PH',
};

export const TargetUrlModal: React.FC<TargetUrlModalProps> = ({ isOpen, onClose, onSave, initialData, defaultRegion = 'ID' }) => {
  const { L } = useLang();
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [region, setRegion] = useState<AseanCountryCode>(defaultRegion);
  const [variant, setVariant] = useState('');
  const [modelId, setModelId] = useState('');
  const [price, setPrice] = useState<string>('1000');
  const { busy, error, setError, save } = useSaver(onSave, onClose);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setTitle(initialData?.title || '');
    setUrl(initialData?.url || '');
    setRegion(isAseanCode(initialData?.region) ? initialData!.region! : defaultRegion);
    setVariant(initialData?.variant || '');
    setModelId(initialData?.model_id || '');
    const defReg = ASEAN_REGIONS[defaultRegion] || ASEAN_REGIONS.ID;
    setPrice(initialData ? String(initialData.target_price ?? '') : defReg.code === 'ID' || defReg.code === 'VN' ? '1000' : '1');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData, isOpen, defaultRegion]);

  // Deteksi wilayah otomatis dari domain link
  const onUrlChange = (v: string) => {
    setUrl(v);
    try {
      const host = new URL(v.trim()).host.replace(/^www\./, '');
      const r = DOMAIN_TO_REGION[host];
      if (r) setRegion(r);
    } catch {}
  };

  const reg = ASEAN_REGIONS[region] || ASEAN_REGIONS.ID;
  const ids = parseShopeeLink(url);
  const valid = isValidHttpUrl(url.trim());

  return (
    <GxModal
      open={isOpen}
      title={initialData ? L('Edit target produk', 'Edit target product') : L('Tambah target produk', 'Add target product')}
      icon={<Link2 size={17} />}
      onClose={onClose}
      busy={busy}
      error={error}
      submitLabel={L('Simpan target', 'Save target')}
      onSubmit={() => {
        if (!title.trim()) {
          setError(L('Nama produk wajib diisi.', 'Product name is required.'));
          return;
        }
        if (!valid) {
          setError(L('Link produk harus diawali https://', 'Product link must start with https://'));
          return;
        }
        const p = Number(price);
        if (!isFinite(p) || p < 0) {
          setError(L('Harga target tidak valid.', 'Target price is invalid.'));
          return;
        }
        return save({
          title: title.trim(),
          url: url.trim(),
          region,
          currency: reg.currency,
          variant: variant.trim(),
          model_id: modelId.trim(),
          target_price: p,
        });
      }}
    >
      <label className="gx-field">
        <span>{L('Link produk Shopee', 'Shopee product link')}</span>
        <input value={url} onChange={(e) => onUrlChange(e.target.value)} placeholder={`https://${reg.domain}/…-i.123.456`} inputMode="url" />
        {url && (
          <small style={{ color: !valid ? 'var(--gx-bad)' : ids ? 'var(--gx-ok)' : 'var(--gx-warn)' }}>
            {!valid
              ? L('Link tidak valid', 'Invalid link')
              : ids
              ? `${L('Terbaca', 'Detected')} · shopid ${ids.shopId} · itemid ${ids.itemId}`
              : L('Link pendek — tetap bisa dibuka, tapi data produk tidak bisa dicek.', 'Short link — can be opened, but product data cannot be checked.')}
          </small>
        )}
      </label>
      <label className="gx-field">
        <span>{L('Nama produk', 'Product name')}</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Samsung Galaxy S24 Ultra 256GB" />
      </label>
      <div className="gx-formgrid gx-formgrid--2">
        <RegionSelect value={region} onChange={setRegion} />
        <label className="gx-field">
          <span>
            {L('Harga flash sale', 'Flash sale price')} ({reg.currencySymbol})
          </span>
          <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" />
        </label>
        <label className="gx-field">
          <span>{L('Varian (opsional)', 'Variant (optional)')}</span>
          <input value={variant} onChange={(e) => setVariant(e.target.value)} placeholder={L('Hitam, 256GB', 'Black, 256GB')} />
        </label>
        <label className="gx-field">
          <span>Model ID ({L('opsional', 'optional')})</span>
          <input value={modelId} onChange={(e) => setModelId(e.target.value)} inputMode="numeric" />
        </label>
      </div>
    </GxModal>
  );
};

/* ------------------------------------------------------------------ */
/* 4. Proxy                                                            */
/* ------------------------------------------------------------------ */

interface ProxyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<ProxyMesh>) => Promise<void>;
  initialData?: ProxyMesh | null;
  defaultRegion?: AseanCountryCode;
}

export const ProxyModal: React.FC<ProxyModalProps> = ({ isOpen, onClose, onSave, initialData, defaultRegion = 'ID' }) => {
  const { L } = useLang();
  const [host, setHost] = useState('');
  const [port, setPort] = useState('8080');
  const [region, setRegion] = useState<AseanCountryCode>(defaultRegion);
  const { busy, error, setError, save } = useSaver(onSave, onClose);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setHost(initialData?.host || '');
    setPort(String(initialData?.port ?? '8080'));
    setRegion(isAseanCode(initialData?.region) ? initialData!.region! : defaultRegion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData, isOpen, defaultRegion]);

  return (
    <GxModal
      open={isOpen}
      title={initialData ? L('Edit proxy', 'Edit proxy') : L('Tambah proxy', 'Add proxy')}
      icon={<Network size={17} />}
      onClose={onClose}
      busy={busy}
      error={error}
      submitLabel={L('Simpan proxy', 'Save proxy')}
      onSubmit={() => {
        let h = host.trim().replace(/^https?:\/\//, '');
        let p = port.trim();
        if (h.includes(':') && !p) {
          [h, p] = h.split(':');
        }
        const n = Number(p);
        if (!h || !/^[a-zA-Z0-9.-]+$/.test(h)) {
          setError(L('Host proxy tidak valid.', 'Invalid proxy host.'));
          return;
        }
        if (!Number.isInteger(n) || n < 1 || n > 65535) {
          setError(L('Port harus 1–65535.', 'Port must be 1–65535.'));
          return;
        }
        return save({ host: h, port: n, region, status: initialData?.status || 'checking' });
      }}
    >
      <div className="gx-formgrid gx-formgrid--2">
        <label className="gx-field">
          <span>Host / IP</span>
          <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="103.21.45.10" autoComplete="off" />
        </label>
        <label className="gx-field">
          <span>Port</span>
          <input value={port} onChange={(e) => setPort(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
        </label>
      </div>
      <RegionSelect value={region} onChange={setRegion} />
      <small className="gx-muted" style={{ fontSize: 12 }}>
        {L('Proxy HTTP dengan dukungan CONNECT. Setelah disimpan, tekan "Tes" untuk mengecek koneksi ke Shopee.', 'HTTP proxy with CONNECT support. After saving, press "Test" to check its connection to Shopee.')}
      </small>
    </GxModal>
  );
};

/* ------------------------------------------------------------------ */
/* 5. Schedule                                                         */
/* ------------------------------------------------------------------ */

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Schedule>) => Promise<void>;
  initialData?: Schedule | null;
}

export const ScheduleModal: React.FC<ScheduleModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
  const { L } = useLang();
  const [title, setTitle] = useState('');
  const [targetTime, setTargetTime] = useState('');
  const [active, setActive] = useState(true);
  const { busy, error, setError, save } = useSaver(onSave, onClose);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setTitle(initialData?.title || '');
    setTargetTime((initialData?.target_time || '').slice(0, 16));
    setActive(initialData?.is_active !== false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData, isOpen]);

  return (
    <GxModal
      open={isOpen}
      title={initialData ? L('Edit jadwal war', 'Edit war schedule') : L('Tambah jadwal war', 'Add war schedule')}
      icon={<CalendarClock size={17} />}
      onClose={onClose}
      busy={busy}
      error={error}
      submitLabel={L('Simpan jadwal', 'Save schedule')}
      onSubmit={() => {
        if (!title.trim() || !targetTime) {
          setError(L('Judul dan waktu wajib diisi.', 'Title and time are required.'));
          return;
        }
        if (isNaN(new Date(targetTime).getTime())) {
          setError(L('Waktu tidak valid.', 'Invalid time.'));
          return;
        }
        return save({ title: title.trim(), target_time: targetTime.length === 16 ? `${targetTime}:00` : targetTime, is_active: active });
      }}
    >
      <label className="gx-field">
        <span>{L('Judul', 'Title')}</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={L('Flash sale 12.12 jam 00:00', '12.12 flash sale at 00:00')} />
      </label>
      <label className="gx-field">
        <span>{L('Waktu sesi (jam HP kamu)', 'Session time (your device time)')}</span>
        <input type="datetime-local" value={targetTime} onChange={(e) => setTargetTime(e.target.value)} />
      </label>
      <label className="gx-switch">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        {L('Aktif', 'Active')}
      </label>
    </GxModal>
  );
};
