import React, { useState, useEffect } from 'react';
import { Address, ShopeeAccount, TargetUrl, ProxyMesh, Schedule, AseanCountryCode } from '../types/index.ts';
import { ASEAN_REGIONS, ALL_ASEAN_CODES } from '../constants/asean.ts';

// 1. ADDRESS MODAL
interface AddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Address>) => Promise<void>;
  initialData?: Address | null;
  defaultRegion?: AseanCountryCode;
}

export const AddressModal: React.FC<AddressModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  defaultRegion = 'ID',
}) => {
  const [label, setLabel] = useState('');
  const [recipient, setRecipient] = useState('');
  const [phone, setPhone] = useState('');
  const [fullAddress, setFullAddress] = useState('');
  const [country, setCountry] = useState<AseanCountryCode>(defaultRegion);
  const [postalCode, setPostalCode] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    if (initialData) {
      setLabel(initialData.label || '');
      setRecipient(initialData.recipient_name || '');
      setPhone(initialData.phone || '');
      setFullAddress(initialData.full_address || '');
      setCountry((initialData.country as AseanCountryCode) || defaultRegion);
      setPostalCode(initialData.postal_code || '');
      setIsDefault(Boolean(initialData.is_default));
    } else {
      setLabel('');
      setRecipient('');
      setPhone('');
      setFullAddress('');
      setCountry(defaultRegion);
      setPostalCode('');
      setIsDefault(false);
    }
  }, [initialData, isOpen, defaultRegion]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      label,
      recipient_name: recipient,
      phone,
      full_address: fullAddress,
      country,
      postal_code: postalCode,
      is_default: isDefault,
    });
    onClose();
  };

  const regInfo = ASEAN_REGIONS[country] || ASEAN_REGIONS.ID;

  return (
    <div className="modal active">
      <div className="modal-content">
        <div className="modal-header">
          <div className="modal-title">
            <i className="fa-solid fa-map-location-dot" style={{ color: '#2563eb' }}></i>{' '}
            {initialData ? 'Edit Alamat Pengiriman' : 'Tambah Alamat Pengiriman'}
          </div>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Negara / Wilayah ASEAN</label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value as AseanCountryCode)}
                className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white"
              >
                {ALL_ASEAN_CODES.map((code) => {
                  const reg = ASEAN_REGIONS[code];
                  return (
                    <option key={code} value={code}>
                      [{reg.code}] {reg.name} ({reg.currency})
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="form-group">
              <label>Label Alamat</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Rumah Utama / Apartment"
                required
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Nama Penerima</label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Nama Lengkap Penerima"
                required
              />
            </div>
            <div className="form-group">
              <label>No. Telepon ({regInfo.phonePrefix})</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={`${regInfo.phonePrefix} 812345678`}
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label>Alamat Lengkap (Beserta Kode Pos)</label>
            <textarea
              value={fullAddress}
              onChange={(e) => setFullAddress(e.target.value)}
              placeholder="Nama jalan, gedung / nomor unit, distrik / kecamatan, kota"
              required
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Kode Pos (Postal Code)</label>
              <input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="cth: 12345 / 569933"
              />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '24px' }}>
              <input
                type="checkbox"
                id="isDefaultAddr"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                style={{ width: 'auto' }}
              />
              <label htmlFor="isDefaultAddr" style={{ margin: 0, cursor: 'pointer', fontSize: '13px' }}>
                Jadikan Alamat Default
              </label>
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary" style={{ width: 'auto' }}>
              Simpan Alamat
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 2. SHOPEE ACCOUNT MODAL
interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<ShopeeAccount>) => Promise<void>;
  initialData?: ShopeeAccount | null;
  defaultRegion?: AseanCountryCode;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  defaultRegion = 'ID',
}) => {
  const [nickname, setNickname] = useState('');
  const [username, setUsername] = useState('');
  const [region, setRegion] = useState<AseanCountryCode>(defaultRegion);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [cookies, setCookies] = useState('');
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    if (initialData) {
      setNickname(initialData.nickname || '');
      setUsername(initialData.username || '');
      setRegion((initialData.region as AseanCountryCode) || defaultRegion);
      setEmail(initialData.email || '');
      setPhone(initialData.phone || '');
      setPassword(initialData.password || '');
      setCookies(initialData.cookies || '');
    } else {
      setNickname('');
      setUsername('');
      setRegion(defaultRegion);
      setEmail('');
      setPhone('');
      setPassword('');
      setCookies('');
    }
  }, [initialData, isOpen, defaultRegion]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      nickname,
      username,
      region,
      email,
      phone,
      password,
      cookies,
    });
    onClose();
  };

  const regInfo = ASEAN_REGIONS[region] || ASEAN_REGIONS.ID;

  return (
    <div className="modal active">
      <div className="modal-content">
        <div className="modal-header">
          <div className="modal-title">
            <i className="fa-solid fa-user-gear" style={{ color: '#2563eb' }}></i>{' '}
            {initialData ? 'Edit Akun Shopee' : 'Tambah Akun Shopee'}
          </div>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Wilayah / Server Shopee ASEAN</label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value as AseanCountryCode)}
              className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white"
            >
              {ALL_ASEAN_CODES.map((code) => {
                const reg = ASEAN_REGIONS[code];
                return (
                  <option key={code} value={code}>
                    [{reg.code}] Shopee {reg.name} ({reg.domain})
                  </option>
                );
              })}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Nickname / Label Akun</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Akun Utama 1"
                required
              />
            </div>
            <div className="form-group">
              <label>Username {regInfo.domain}</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username_shopee"
                required
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Email (Opsional)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@gmail.com"
              />
            </div>
            <div className="form-group">
              <label>No. HP (Opsional)</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0812..."
              />
            </div>
          </div>
          <div className="form-group">
            <label>Password Shopee (Opsional)</label>
            <div className="password-wrapper">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <i
                className={`fa-solid ${showPass ? 'fa-eye-slash' : 'fa-eye'} password-toggle`}
                onClick={() => setShowPass(!showPass)}
              ></i>
            </div>
          </div>
          <div className="form-group">
            <label>Cookies (SPC_EC, SPC_F, shopee_token, dsb)</label>
            <textarea
              value={cookies}
              onChange={(e) => setCookies(e.target.value)}
              placeholder="Paste cookies akun Shopee dari inspect element / cookie editor di sini..."
              style={{ height: '120px' }}
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary" style={{ width: 'auto' }}>
              Simpan Akun
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 3. TARGET URL MODAL
interface TargetUrlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<TargetUrl>) => Promise<void>;
  initialData?: TargetUrl | null;
  defaultRegion?: AseanCountryCode;
}

export const TargetUrlModal: React.FC<TargetUrlModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  defaultRegion = 'ID',
}) => {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [region, setRegion] = useState<AseanCountryCode>(defaultRegion);
  const [variant, setVariant] = useState('');
  const [modelId, setModelId] = useState('');
  const [price, setPrice] = useState<number>(1000);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setUrl(initialData.url || '');
      setRegion((initialData.region as AseanCountryCode) || defaultRegion);
      setVariant(initialData.variant || '');
      setModelId(initialData.model_id || '');
      setPrice(initialData.target_price || 1000);
    } else {
      setTitle('');
      setUrl('');
      setRegion(defaultRegion);
      setVariant('');
      setModelId('');
      const defReg = ASEAN_REGIONS[defaultRegion] || ASEAN_REGIONS.ID;
      setPrice(defReg.code === 'ID' || defReg.code === 'VN' ? 1000 : 1);
    }
  }, [initialData, isOpen, defaultRegion]);

  if (!isOpen) return null;

  const targetReg = ASEAN_REGIONS[region] || ASEAN_REGIONS.ID;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      title,
      url,
      region,
      currency: targetReg.currency,
      variant,
      model_id: modelId,
      target_price: Number(price),
    });
    onClose();
  };

  return (
    <div className="modal active">
      <div className="modal-content">
        <div className="modal-header">
          <div className="modal-title">
            <i className="fa-solid fa-link" style={{ color: '#2563eb' }}></i>{' '}
            {initialData ? 'Edit Target Produk URL' : 'Tambah Target Produk URL'}
          </div>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Wilayah Shopee ASEAN</label>
              <select
                value={region}
                onChange={(e) => {
                  const newReg = e.target.value as AseanCountryCode;
                  setRegion(newReg);
                  if (newReg === 'SG' || newReg === 'MY' || newReg === 'TH' || newReg === 'PH') {
                    if (price === 1000) setPrice(1);
                  } else if (newReg === 'ID' || newReg === 'VN') {
                    if (price === 1) setPrice(1000);
                  }
                }}
                className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white"
              >
                {ALL_ASEAN_CODES.map((code) => {
                  const reg = ASEAN_REGIONS[code];
                  return (
                    <option key={code} value={code}>
                      [{reg.code}] {reg.name} ({reg.domain})
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="form-group">
              <label>Nama / Label Produk</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Flash Sale Item / Produk Shopee"
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label>URL Produk ({targetReg.domain})</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={`https://${targetReg.domain}/product-i.12345.67890`}
              required
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Nama Varian (Opsional)</label>
              <input
                type="text"
                value={variant}
                onChange={(e) => setVariant(e.target.value)}
                placeholder="Varian (Warna / Ukuran)"
              />
            </div>
            <div className="form-group">
              <label>Model ID (Opsional)</label>
              <input
                type="text"
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                placeholder="10023456"
              />
            </div>
          </div>
          <div className="form-group">
            <label>Target Harga Flash Sale ({targetReg.currencySymbol} / {targetReg.currency})</label>
            <input
              type="number"
              step="any"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              placeholder={targetReg.code === 'ID' || targetReg.code === 'VN' ? '1000' : '1'}
              required
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary" style={{ width: 'auto' }}>
              Simpan Target
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 4. PROXY MODAL
interface ProxyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<ProxyMesh>) => Promise<void>;
  initialData?: ProxyMesh | null;
  defaultRegion?: AseanCountryCode;
}

export const ProxyModal: React.FC<ProxyModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  defaultRegion = 'ID',
}) => {
  const [host, setHost] = useState('');
  const [port, setPort] = useState<number | string>(8080);
  const [region, setRegion] = useState<AseanCountryCode>(defaultRegion);

  useEffect(() => {
    if (initialData) {
      setHost(initialData.host || '');
      setPort(initialData.port || 8080);
      setRegion((initialData.region as AseanCountryCode) || defaultRegion);
    } else {
      setHost('');
      setPort(8080);
      setRegion(defaultRegion);
    }
  }, [initialData, isOpen, defaultRegion]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      host,
      port: Number(port),
      region,
      status: 'active',
      latency_ms: Math.floor(Math.random() * 15 + 8),
    });
    onClose();
  };

  return (
    <div className="modal active">
      <div className="modal-content" style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <div className="modal-title">
            <i className="fa-solid fa-network-wired" style={{ color: '#2563eb' }}></i>{' '}
            {initialData ? 'Edit Proxy Node' : 'Tambah Proxy Node ASEAN'}
          </div>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Wilayah Node Residential Proxy</label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value as AseanCountryCode)}
              className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white"
            >
              {ALL_ASEAN_CODES.map((code) => {
                const reg = ASEAN_REGIONS[code];
                return (
                  <option key={code} value={code}>
                    [{reg.code}] {reg.name} ({reg.domain})
                  </option>
                );
              })}
            </select>
          </div>
          <div className="form-group">
            <label>Host / IP Proxy</label>
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="id-res.ganemax-mesh.net"
              required
            />
          </div>
          <div className="form-group">
            <label>Port</label>
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="8080"
              required
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary" style={{ width: 'auto' }}>
              Simpan Proxy
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 5. SCHEDULE MODAL
interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Schedule>) => Promise<void>;
  initialData?: Schedule | null;
}

export const ScheduleModal: React.FC<ScheduleModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [title, setTitle] = useState('');
  const [targetTime, setTargetTime] = useState('');

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setTargetTime(initialData.target_time || '');
    } else {
      setTitle('');
      setTargetTime('');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      title,
      target_time: targetTime,
      is_active: true,
    });
    onClose();
  };

  return (
    <div className="modal active">
      <div className="modal-content" style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <div className="modal-title">
            <i className="fa-solid fa-calendar-plus" style={{ color: '#2563eb' }}></i>{' '}
            {initialData ? 'Edit Jadwal Flash Sale' : 'Tambah Jadwal Flash Sale'}
          </div>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Judul / Event Flash Sale</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Flash Sale Rp 1.000 Jam 12:00"
              required
            />
          </div>
          <div className="form-group">
            <label>Waktu Target Eksekusi</label>
            <input
              type="datetime-local"
              value={targetTime}
              onChange={(e) => setTargetTime(e.target.value)}
              required
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary" style={{ width: 'auto' }}>
              Simpan Jadwal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
