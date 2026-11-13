import React, { useEffect, useState } from 'react';
import { QrCode, X, Copy, Check, Send, Download } from 'lucide-react';

// QR dibuat ulang dari payload QRIS asli (CRC valid) supaya tajam & tidak bergantung hosting luar
const QRIS_LOCAL = '/qris-ganemax.svg';
const QRIS_PNG = '/qris-ganemax.png';
const QRIS_REMOTE = 'https://files.catbox.moe/ru49zu.jpg';
import { LICENSE_TIERS, formatRp } from '../constants/licenses.ts';
import { useLang } from '../lib/i18n.tsx';

interface PaymentGatewayModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
}

export const PaymentGatewayModal: React.FC<PaymentGatewayModalProps> = ({ isOpen, onClose, username }) => {
  const { L } = useLang();
  const [selectedPlan, setSelectedPlan] = useState<string>(LICENSE_TIERS[0].id);
  const [targetUsername, setTargetUsername] = useState<string>(username || '');
  const [copied, setCopied] = useState(false);
  const [imgSrc, setImgSrc] = useState(QRIS_LOCAL);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTargetUsername(username || '');
      setCopied(false);
      setImgError(false);
      setImgSrc(QRIS_LOCAL);
    }
  }, [isOpen, username]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const plan = LICENSE_TIERS.find((p) => p.id === selectedPlan) || LICENSE_TIERS[0];

  const message =
    `Halo Admin GaneMaX.Ai (@mrpangeranz), saya sudah bayar lisensi bot flash sale:\n\n` +
    `• Username: ${targetUsername.trim() || '(buatkan username baru)'}\n` +
    `• Paket: ${plan.label}\n` +
    `• Total: ${formatRp(plan.price)}\n\n` +
    `Bukti transfer QRIS terlampir. Terima kasih!`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="gx-overlay gx-overlay--center" onClick={onClose}>
      <div className="gx-dialog" style={{ width: 'min(480px, 100%)' }} role="dialog" aria-modal="true" aria-label={L('Sewa lisensi', 'Rent a license')} onClick={(e) => e.stopPropagation()}>
        <div className="gx-dialog__head">
          <span className="gx-qa__icon" style={{ width: 34, height: 34, borderRadius: 11 }}>
            <QrCode size={17} />
          </span>
          <div>
            <h3>{L('Sewa & aktivasi lisensi', 'Rent & activate a license')}</h3>
            <div className="gx-muted" style={{ fontSize: 12 }}>QRIS · {L('semua e-wallet & bank Indonesia', 'all Indonesian e-wallets & banks')}</div>
          </div>
          <button type="button" className="gx-iconbtn" style={{ marginLeft: 'auto' }} onClick={onClose} aria-label={L('Tutup', 'Close')}>
            <X size={16} />
          </button>
        </div>
        <div className="gx-dialog__body">
          <div className="gx-plans" role="radiogroup" aria-label={L('Pilih paket', 'Choose plan')}>
            {LICENSE_TIERS.map((p) => (
              <button key={p.id} type="button" role="radio" aria-checked={selectedPlan === p.id} className={`gx-plan ${selectedPlan === p.id ? 'is-on' : ''}`} onClick={() => setSelectedPlan(p.id)}>
                <span className="gx-plan__name">{p.short}</span>
                <span className="gx-plan__price">{p.priceRp}</span>
                <span className="gx-plan__sub">{p.maxAccounts >= 999 ? L('Akun tanpa batas', 'Unlimited accounts') : L(`${p.maxAccounts} akun · ${p.maxThreads} thread`, `${p.maxAccounts} accounts · ${p.maxThreads} threads`)}</span>
                {p.id === '60_hari' && <span className="gx-plan__badge">{L('Paling laris', 'Best value')}</span>}
              </button>
            ))}
          </div>

          <div className="gx-qris">
            <div className="gx-qris__head">
              <span className="gx-qris__logo">QRIS</span>
              <span className="gx-qris__merchant">
                GaneMaX.Ai
                <small>{L('Pembayaran lisensi bot', 'Bot license payment')}</small>
              </span>
            </div>
            <div className="gx-qris__frame">
              {imgError ? (
                <div className="gx-qris__fallback">
                  {L('Gambar QR gagal dimuat. Cek koneksi lalu buka ulang, atau minta QR ke admin via Telegram.', 'QR image failed to load. Check your connection and reopen, or ask admin on Telegram.')}
                </div>
              ) : (
                <img
                  src={imgSrc}
                  alt="QRIS GaneMaX.Ai"
                  className="gx-qris__img"
                  loading="eager"
                  onError={() => (imgSrc === QRIS_LOCAL ? setImgSrc(QRIS_REMOTE) : setImgError(true))}
                />
              )}
            </div>
            <div className="gx-qris__amount">
              <span>{L('Total bayar', 'Amount')}</span>
              <b>{formatRp(plan.price)}</b>
            </div>
            <div className="gx-qris__meta">
              <span>{L('Berlaku untuk semua e-wallet & m-banking', 'Works with all e-wallets & mobile banking')}</span>
              <a href={QRIS_PNG} download="QRIS-GaneMaX.png" className="gx-link">
                <Download size={13} /> {L('Simpan QR', 'Save QR')}
              </a>
            </div>
          </div>

          <ol className="gx-steps">
            <li>
              <span>1</span>
              {L(`Scan QRIS di atas, lalu ketik nominal ${formatRp(plan.price)} untuk paket ${plan.short}.`, `Scan the QRIS above, then enter ${formatRp(plan.price)} for the ${plan.short} plan.`)}
            </li>
            <li>
              <span>2</span>
              {L('Kirim bukti bayar ke Telegram @mrpangeranz (pakai tombol "Salin format chat").', 'Send the payment proof to Telegram @mrpangeranz (use "Copy chat template").')}
            </li>
            <li>
              <span>3</span>
              {L('Admin mengirim username & password lisensi, biasanya < 15 menit.', 'Admin sends your license username & password, usually within 15 minutes.')}
            </li>
          </ol>

          <label className="gx-field">
            <span>{L('Username yang diinginkan (opsional)', 'Preferred username (optional)')}</span>
            <input value={targetUsername} onChange={(e) => setTargetUsername(e.target.value)} placeholder={L('contoh: buyer_war88', 'e.g. buyer_war88')} />
          </label>
        </div>
        <div className="gx-dialog__foot" style={{ flexWrap: 'wrap' }}>
          <button type="button" className="gx-btn gx-btn--sm" onClick={copy}>
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? L('Tersalin', 'Copied') : L('Salin format chat', 'Copy chat template')}
          </button>
          <a className="gx-btn gx-btn--sm gx-btn--primary" href="https://t.me/mrpangeranz" target="_blank" rel="noopener noreferrer">
            <Send size={14} /> Telegram @mrpangeranz
          </a>
        </div>
      </div>
    </div>
  );
};
