import React, { useState } from 'react';

interface PaymentGatewayModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
}

export const PaymentGatewayModal: React.FC<PaymentGatewayModalProps> = ({
  isOpen,
  onClose,
  username,
}) => {
  const [selectedPlan, setSelectedPlan] = useState<string>('30_hari');
  const [targetUsername, setTargetUsername] = useState<string>(username || '');
  const [copiedFormat, setCopiedFormat] = useState(false);

  if (!isOpen) return null;

  const plans = [
    { id: '1_hari', price: 25000, label: '1 Hari Trial', desc: 'Trial 24 Jam' },
    { id: '3_hari', price: 50000, label: '3 Hari Flash', desc: 'Weekend Event' },
    { id: '7_hari', price: 100000, label: '7 Hari', desc: '1 Minggu Penuh' },
    { id: '30_hari', price: 150000, label: '30 Hari Pro', desc: 'Paling Populer' },
    { id: '60_hari', price: 250000, label: '60 Hari Hemat', desc: 'Diskon Spesial' },
    { id: '365_hari', price: 1000000, label: '1 Tahun VIP', desc: 'Prioritas Server' },
    { id: 'lifetime', price: 2500000, label: 'Lifetime VIP', desc: 'Permanen Selamanya' },
  ];

  const currentPlan = plans.find((p) => p.id === selectedPlan) || plans[3];

  const getConfirmationMessage = () => {
    return (
      `Halo Admin GaneMaX AI (@mrpangeranz), saya telah melakukan pembayaran lisensi bot Shopee Flash Sale:\n\n` +
      `• Username Tujuan: ${targetUsername || username || '(Tolong buatkan username baru)'}\n` +
      `• Pilihan Paket: ${currentPlan.label}\n` +
      `• Total Transfer: Rp ${currentPlan.price.toLocaleString('id-ID')}\n\n` +
      `Bukti transfer QRIS terlampir. Mohon kirimkan akun lisensi (username & password) bot saya ya kak. Terima kasih!`
    );
  };

  const handleConfirmTelegram = () => {
    const text = encodeURIComponent(getConfirmationMessage());
    window.open(`https://t.me/mrpangeranz`, '_blank');
  };

  const handleCopyFormat = () => {
    navigator.clipboard.writeText(getConfirmationMessage());
    setCopiedFormat(true);
    setTimeout(() => setCopiedFormat(false), 2500);
  };

  return (
    <div className="modern-modal-overlay active" id="modalPaymentGateway">
      <div className="modern-modal-box">
        {/* Header */}
        <div className="modern-modal-header">
          <div className="modern-modal-title-group">
            <div className="modern-icon-badge qris-badge">
              <i className="fa-solid fa-qrcode"></i>
            </div>
            <div>
              <h3 className="modern-modal-title">Sewa & Aktivasi Lisensi</h3>
              <p className="modern-modal-desc">QRIS All Payment Indonesia</p>
            </div>
          </div>
          <button className="modern-modal-close" onClick={onClose} aria-label="Tutup modal">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Content Body */}
        <div className="modern-modal-body">
          {/* Plan Selector */}
          <div className="modern-plan-selector" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px' }}>
            {plans.map((p) => (
              <div
                key={p.id}
                className={`modern-plan-card ${selectedPlan === p.id ? 'selected' : ''}`}
                onClick={() => setSelectedPlan(p.id)}
                style={{ padding: '8px 10px', textAlign: 'center', cursor: 'pointer' }}
              >
                <div className="modern-plan-label" style={{ fontSize: '11px', fontWeight: 700 }}>{p.label}</div>
                <div className="modern-plan-price" style={{ fontSize: '13px', fontWeight: 800, margin: '2px 0' }}>
                  Rp {p.price.toLocaleString('id-ID')}
                </div>
                <div className="modern-plan-sub" style={{ fontSize: '10px', color: '#64748b' }}>{p.desc}</div>
              </div>
            ))}
          </div>

          {/* QRIS Display Container */}
          <div className="modern-qris-card">
            <div className="modern-qris-top-label">
              <span>SCAN QRIS UNTUK PEMBAYARAN RESMI</span>
              <span className="modern-qris-secure-tag">
                <i className="fa-solid fa-shield-check"></i> Verified Merchant
              </span>
            </div>

            <div className="modern-qris-img-wrapper">
              <img
                src="https://files.catbox.moe/ru49zu.jpg"
                alt="QRIS Pembayaran GaneMaX AI"
                className="modern-qris-image"
                width={3264}
                height={3252}
                loading="eager"
              />
            </div>

            <div className="modern-qris-supported">
              <span>Mendukung:</span>
              <div className="modern-payment-tags">
                <span className="pay-pill">ShopeePay</span>
                <span className="pay-pill">GoPay</span>
                <span className="pay-pill">OVO</span>
                <span className="pay-pill">Dana</span>
                <span className="pay-pill">BCA</span>
                <span className="pay-pill">Mandiri</span>
                <span className="pay-pill">BRI</span>
              </div>
            </div>

            <div className="modern-qris-total-bar">
              <span className="total-label">Total Tagihan Paket:</span>
              <span className="total-value" style={{ color: '#2563eb' }}>
                Rp {currentPlan.price.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          {/* Petunjuk Telegram */}
          <div
            style={{
              marginTop: '14px',
              padding: '12px 14px',
              background: '#f0f9ff',
              border: '1px solid #bae6fd',
              borderRadius: '12px',
              fontSize: '12px',
              color: '#0369a1',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
            }}
          >
            <i className="fa-brands fa-telegram" style={{ fontSize: '18px', color: '#0284c7', marginTop: '2px' }}></i>
            <div>
              <div style={{ fontWeight: 700, marginBottom: '2px' }}>Langkah Aktivasi Lisensi Bot:</div>
              <div>
                1. Scan QRIS di atas sesuai nominal paket (<b>Rp {currentPlan.price.toLocaleString('id-ID')}</b>).<br />
                2. DM Telegram <b>@mrpangeranz</b> untuk mengirimkan bukti transfer.<br />
                3. Admin akan langsung memberikan <b>Username & Password</b> lisensi aktif Anda.
              </div>
            </div>
          </div>

          {/* Form Username confirmation */}
          <div className="modern-field" style={{ marginTop: '14px' }}>
            <label className="modern-field-label">
              Request Username Akun (Opsional jika pengguna baru):
            </label>
            <div className="modern-input-wrapper">
              <i className="fa-solid fa-user modern-input-icon"></i>
              <input
                type="text"
                className="modern-input"
                value={targetUsername}
                onChange={(e) => setTargetUsername(e.target.value)}
                placeholder="Contoh: username_pilihan"
              />
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="modern-modal-footer" style={{ gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" className="modern-btn-ghost" onClick={onClose}>
            Tutup
          </button>
          <button
            type="button"
            className="modern-btn-ghost"
            onClick={handleCopyFormat}
            style={{ borderColor: '#bae6fd', color: '#0369a1', fontWeight: 600 }}
          >
            <i className={`fa-solid ${copiedFormat ? 'fa-check' : 'fa-copy'}`}></i>{' '}
            {copiedFormat ? 'Format Tersalin!' : 'Salin Format Chat'}
          </button>
          <button
            type="button"
            className="modern-btn-confirm"
            onClick={handleConfirmTelegram}
            style={{ background: '#0284c7', borderColor: '#0284c7' }}
          >
            <i className="fa-brands fa-telegram"></i>
            <span>DM Telegram @mrpangeranz</span>
          </button>
        </div>
      </div>
    </div>
  );
};
