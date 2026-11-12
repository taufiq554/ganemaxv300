import React, { useEffect } from 'react';
import { MessageCircle, X, Check } from 'lucide-react';
import { useLang } from '../lib/i18n.tsx';

interface WhatsappChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CHANNEL_URL = 'https://whatsapp.com/channel/0029Vak7xFMLikgB8756GS2y';

export const WhatsappChannelModal: React.FC<WhatsappChannelModalProps> = ({ isOpen, onClose }) => {
  const { L } = useLang();
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);
  if (!isOpen) return null;

  const points = [
    L('Info jadwal event flash sale', 'Flash sale event schedule updates'),
    L('Tips pengaturan pre-fire & jam sesi', 'Tips for pre-fire & session timing'),
    L('Pengumuman update & maintenance bot', 'Bot update & maintenance announcements'),
    L('Bantuan langsung dari admin', 'Direct help from admin'),
  ];

  return (
    <div className="gx-overlay gx-overlay--center" onClick={onClose}>
      <div className="gx-dialog" style={{ width: 'min(440px, 100%)' }} role="dialog" aria-modal="true" aria-label={L('Saluran WhatsApp', 'WhatsApp channel')} onClick={(e) => e.stopPropagation()}>
        <div className="gx-dialog__head">
          <span className="gx-qa__icon" style={{ width: 34, height: 34, borderRadius: 11, background: '#dcfce7', color: '#15803d' }}>
            <MessageCircle size={17} />
          </span>
          <h3>{L('Saluran WhatsApp GaneMaX.Ai', 'GaneMaX.Ai WhatsApp channel')}</h3>
          <button type="button" className="gx-iconbtn" style={{ marginLeft: 'auto' }} onClick={onClose} aria-label={L('Tutup', 'Close')}>
            <X size={16} />
          </button>
        </div>
        <div className="gx-dialog__body">
          <p style={{ margin: 0, fontSize: 13, color: 'var(--gx-ink-2)', lineHeight: 1.6 }}>
            {L('Gabung saluran resmi untuk update terbaru seputar bot dan event flash sale.', 'Join the official channel for the latest bot and flash sale event updates.')}
          </p>
          <ul className="gx-list">
            {points.map((t) => (
              <li key={t} className="gx-row" style={{ padding: '8px 0' }}>
                <Check size={15} color="#16a34a" />
                <span style={{ fontSize: 13 }}>{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="gx-dialog__foot">
          <button type="button" className="gx-btn gx-btn--sm" onClick={onClose}>
            {L('Nanti saja', 'Later')}
          </button>
          <a className="gx-btn gx-btn--sm" style={{ background: '#16a34a', borderColor: '#16a34a', color: '#fff' }} href={CHANNEL_URL} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={14} /> {L('Masuk saluran', 'Join channel')}
          </a>
        </div>
      </div>
    </div>
  );
};
