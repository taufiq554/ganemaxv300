import React, { useEffect, useState } from 'react';
import { QrCode, X, Copy, Check, Send } from 'lucide-react';
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

  useEffect(() => {
    if (isOpen) {
      setTargetUsername(username || '');
      setCopied(false);
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            {LICENSE_TIERS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`gx-qa__btn ${selectedPlan === p.id ? 'gx-qa__btn--on' : ''}`}
                style={{ padding: '10px 8px', gap: 2 }}
                onClick={() => setSelectedPlan(p.id)}
                aria-pressed={selectedPlan === p.id}
              >
                <span style={{ fontSize: 12 }}>{p.short}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--gx-ink)' }}>{p.priceRp}</span>
                <span style={{ fontSize: 10.5, fontWeight: 600 }}>
                  {p.maxAccounts >= 999 ? L('Akun tanpa batas', 'Unlimited accounts') : L(`${p.maxAccounts} akun`, `${p.maxAccounts} accounts`)}
                </span>
              </button>
            ))}
          </div>

          <div style={{ border: '1px solid var(--gx-line)', borderRadius: 18, padding: 12, textAlign: 'center', background: '#fff' }}>
            <img src="https://files.catbox.moe/ru49zu.jpg" alt="QRIS GaneMaX.Ai" style={{ width: '100%', maxWidth: 280, height: 'auto', borderRadius: 12 }} loading="eager" />
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#0b1533', fontSize: 13 }}>
              <span>{L('Total tagihan', 'Total')}</span>
              <b style={{ fontSize: 18, color: '#2f6bff' }}>{formatRp(plan.price)}</b>
            </div>
          </div>

          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--gx-ink-2)', lineHeight: 1.6 }}>
            <li>{L(`Scan QRIS dan bayar ${formatRp(plan.price)}.`, `Scan the QRIS and pay ${formatRp(plan.price)}.`)}</li>
            <li>{L('Kirim bukti transfer ke Telegram @mrpangeranz.', 'Send the payment proof to Telegram @mrpangeranz.')}</li>
            <li>{L('Admin mengirim username & password lisensi kamu.', 'Admin sends your license username & password.')}</li>
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
