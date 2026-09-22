import React from 'react';

interface WhatsappChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WhatsappChannelModal: React.FC<WhatsappChannelModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const handleJoinChannel = () => {
    window.open('https://whatsapp.com/channel/0029Vak7xFMLikgB8756GS2y', '_blank');
  };

  return (
    <div className="modal active" id="modalWhatsappChannel">
      <div className="modal-content" style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <div className="modal-title" style={{ color: '#15803d', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-brands fa-whatsapp" style={{ color: '#22c55e', fontSize: '22px' }}></i>
            Saluran Resmi Komunitas & Update
          </div>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <div
            style={{
              width: '70px',
              height: '70px',
              borderRadius: '20px',
              background: '#dcfce7',
              color: '#15803d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '36px',
              margin: '0 auto 16px',
            }}
          >
            <i className="fa-brands fa-whatsapp"></i>
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px', color: '#0f172a' }}>
            Bergabung ke Saluran WhatsApp
          </h3>
          <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.6, marginBottom: '20px' }}>
            Dapatkan update jadwal bocoran flash sale Rp 1.000, trik bypass anti-bot terkini,
            voucher diskon rahasia, serta update versi script terbaru secara real-time!
          </p>

          <div
            style={{
              background: '#f8fafc',
              borderRadius: '14px',
              padding: '14px',
              textAlign: 'left',
              fontSize: '13px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              marginBottom: '20px',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-check" style={{ color: '#22c55e' }}></i>
              <span>Bocoran Event Flash Sale Rp 1.000</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-check" style={{ color: '#22c55e' }}></i>
              <span>Strategi Pre-fire Timing & Jitter Optimal</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-check" style={{ color: '#22c55e' }}></i>
              <span>Customer Service & Konsultasi Langsung</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-outline"
              style={{ flex: 1 }}
              onClick={onClose}
            >
              Nanti Saja
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ flex: 1.5, background: '#22c55e', borderColor: '#22c55e' }}
              onClick={handleJoinChannel}
            >
              <i className="fa-brands fa-whatsapp"></i> Masuk Saluran WA
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
