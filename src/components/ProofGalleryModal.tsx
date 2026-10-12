import React, { useState } from 'react';

interface ProofItem {
  id: string;
  category: 'gadget' | 'gold' | 'vehicle' | 'electronics';
  productName: string;
  orderNumber: string;
  checkoutDate: string;
  checkoutSpeedMs: number;
  normalPrice: string;
  checkoutPrice: string;
  discountAmount: string;
  paymentMethod: string;
  courier: string;
  trackingNumber: string;
  buyerName: string;
  buyerLocation: string;
  avatar: string;
  image: string;
  rating: number;
  reviewText: string;
  status: string;
}

const PROOF_DATA: ProofItem[] = [
  {
    id: 'proof_1',
    category: 'gadget',
    productName: 'Apple iPhone 15 Pro Max 256GB Natural Titanium (Garansi Resmi iBox)',
    orderNumber: '240909A8F9K2L',
    checkoutDate: '09 Sep 2026, 00:00:00.011 WIB',
    checkoutSpeedMs: 11,
    normalPrice: 'Rp 22.999.000',
    checkoutPrice: 'Rp 1.000',
    discountAmount: 'Rp 22.998.000',
    paymentMethod: 'ShopeePay (Auto PIN Injected)',
    courier: 'Shopee Xpress Standard (SPX)',
    trackingNumber: 'SPXID0982347192',
    buyerName: 'Rizky Pratama',
    buyerLocation: 'Kebon Jeruk, Jakarta Barat',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
    image: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600&auto=format&fit=crop&q=80',
    rating: 5,
    reviewText:
      'Gokil banget GaneMaX.Ai! Semalam event 9.9 jam 00:00 pas detik 0 langsung tembus iPhone 15 Pro Max Rp 1.000 tanpa macet. Barang udah sampai dengan selamat tersegel greenpeel.',
    status: 'Pesanan Selesai • Diterima Pembeli',
  },
  {
    id: 'proof_2',
    category: 'gold',
    productName: 'Logam Mulia Emas Antam 5 Gram CertiCard Press Asli 999.9',
    orderNumber: '240925G12M99P',
    checkoutDate: '25 Sep 2026, 00:00:00.009 WIB',
    checkoutSpeedMs: 9,
    normalPrice: 'Rp 6.850.000',
    checkoutPrice: 'Rp 1.000',
    discountAmount: 'Rp 6.849.000',
    paymentMethod: 'SPayLater (0% Bunga 1 Bulan)',
    courier: 'J&T Express Insurance',
    trackingNumber: 'JT98127394812',
    buyerName: 'Dian Nugraha',
    buyerLocation: 'Gubeng, Surabaya',
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&auto=format&fit=crop&q=80',
    image: 'https://images.unsplash.com/photo-1610375461246-83df859d849d?w=600&auto=format&fit=crop&q=80',
    rating: 5,
    reviewText:
      'Emas 5 gram dapet harga Rp 1.000 di Shopee Mall! Auto PIN SPayLater-nya kilat 9 milidetik, bener-bener gak keburu direbut bot lain. Rekomendasi wajib beli lisensinya.',
    status: 'Pesanan Selesai • Terverifikasi',
  },
  {
    id: 'proof_3',
    category: 'vehicle',
    productName: 'Sepeda Motor Honda All New BeAT Sporty CBS OTR Jakarta',
    orderNumber: '240817M79X40Q',
    checkoutDate: '17 Agu 2026, 00:00:00.014 WIB',
    checkoutSpeedMs: 14,
    normalPrice: 'Rp 18.900.000',
    checkoutPrice: 'Rp 1.000',
    discountAmount: 'Rp 18.899.000',
    paymentMethod: 'ShopeePay Saldo Instant',
    courier: 'Pengiriman Kurir Dealer Resmi Honda',
    trackingNumber: 'ASTR-BEAT-77491',
    buyerName: 'Fajar Ardiansyah',
    buyerLocation: 'Cicendo, Kota Bandung',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
    image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=600&auto=format&fit=crop&q=80',
    rating: 5,
    reviewText:
      'Tembus motor seharga Rp 1.000 di 17 Agustusan! Dealer langsung konfirmasi pengiriman STNK & BPKB. Fitur pre-fire jitter GaneMaX beneran bikin tembus detik 0.',
    status: 'Pesanan Dikirim Oleh Dealer Resmi',
  },
  {
    id: 'proof_4',
    category: 'electronics',
    productName: 'Xiaomi TV A Pro 43 Inch 4K UHD Dolby Vision HDR10 Smart Google TV',
    orderNumber: '240930TV43K11',
    checkoutDate: '30 Sep 2026, 00:00:00.012 WIB',
    checkoutSpeedMs: 12,
    normalPrice: 'Rp 3.999.000',
    checkoutPrice: 'Rp 1.000',
    discountAmount: 'Rp 3.998.000',
    paymentMethod: 'ShopeePay Instant',
    courier: 'J&T Cargo Heavy Cargo',
    trackingNumber: 'JTC778899120',
    buyerName: 'Bayu Wicaksono',
    buyerLocation: 'Semarang Barat, Semarang',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80',
    image: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=600&auto=format&fit=crop&q=80',
    rating: 5,
    reviewText:
      'Smart TV 43 inch dapet Rp 1.000 pas gajian payday sale! Settingan bot lewat browser HP lancar jaya, tinggal tidur bangun-bangun ada notif pesanan berhasil.',
    status: 'Pesanan Selesai • Diterima',
  },
  {
    id: 'proof_5',
    category: 'electronics',
    productName: 'Sony PlayStation 5 Slim 1TB Disc Edition Console Next-Gen',
    orderNumber: '240901PS5X77A',
    checkoutDate: '01 Sep 2026, 00:00:00.008 WIB',
    checkoutSpeedMs: 8,
    normalPrice: 'Rp 8.999.000',
    checkoutPrice: 'Rp 1.000',
    discountAmount: 'Rp 8.998.000',
    paymentMethod: 'ShopeePay Auto PIN',
    courier: 'Shopee Xpress Instant',
    trackingNumber: 'SPXID10293847',
    buyerName: 'Kevin Wijaya',
    buyerLocation: 'Tanjung Duren, Jakarta Barat',
    avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=100&auto=format&fit=crop&q=80',
    image: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=600&auto=format&fit=crop&q=80',
    rating: 5,
    reviewText:
      '8 milidetik rekor tercepat! PS5 Slim Rp 1.000 berhasil di-checkout. Temen-temen tongkrongan pada heran kok bisa tembus. Rahasianya ya GaneMaX.Ai ini.',
    status: 'Pesanan Selesai • Terverifikasi',
  },
];

interface ProofGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProofGalleryModal: React.FC<ProofGalleryModalProps> = ({ isOpen, onClose }) => {
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'gadget' | 'gold' | 'vehicle' | 'electronics'>('all');
  const [activeProof, setActiveProof] = useState<ProofItem | null>(null);

  if (!isOpen) return null;

  const filtered = PROOF_DATA.filter((item) =>
    selectedFilter === 'all' ? true : item.category === selectedFilter
  );

  return (
    <div className="modal active">
      <div className="modal-content" style={{ maxWidth: '840px' }}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-receipt text-emerald-600"></i>
            <span>Galeri Bukti Nyata Struk Checkout Rp 1.000 (Terverifikasi)</span>
          </div>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        {/* Filter Pills */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-700 mr-1">Filter Kategori:</span>
          <button
            type="button"
            className={`px-3 py-1 text-xs rounded-full font-bold transition-all ${
              selectedFilter === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-700 border border-slate-300'
            }`}
            onClick={() => setSelectedFilter('all')}
          >
            Semua Bukti ({PROOF_DATA.length})
          </button>
          <button
            type="button"
            className={`px-3 py-1 text-xs rounded-full font-bold transition-all ${
              selectedFilter === 'gadget'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-700 border border-slate-300'
            }`}
            onClick={() => setSelectedFilter('gadget')}
          >
            <i className="fa-solid fa-mobile-screen mr-1 text-blue-500"></i> iPhone & Gadget
          </button>
          <button
            type="button"
            className={`px-3 py-1 text-xs rounded-full font-bold transition-all ${
              selectedFilter === 'gold'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-700 border border-slate-300'
            }`}
            onClick={() => setSelectedFilter('gold')}
          >
            <i className="fa-solid fa-coins mr-1 text-amber-500"></i> Emas Antam
          </button>
          <button
            type="button"
            className={`px-3 py-1 text-xs rounded-full font-bold transition-all ${
              selectedFilter === 'vehicle'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-700 border border-slate-300'
            }`}
            onClick={() => setSelectedFilter('vehicle')}
          >
            <i className="fa-solid fa-motorcycle mr-1 text-emerald-500"></i> Sepeda Motor
          </button>
          <button
            type="button"
            className={`px-3 py-1 text-xs rounded-full font-bold transition-all ${
              selectedFilter === 'electronics'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-700 border border-slate-300'
            }`}
            onClick={() => setSelectedFilter('electronics')}
          >
            <i className="fa-solid fa-gamepad mr-1 text-indigo-500"></i> Elektronik & TV
          </button>
        </div>

        {/* Gallery Cards Grid */}
        <div className="p-4 max-h-[70vh] overflow-y-auto bg-slate-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col cursor-pointer"
                onClick={() => setActiveProof(item)}
              >
                {/* Header Shopee style */}
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-white flex items-center justify-between text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <i className="fa-solid fa-bag-shopping"></i>
                    <span>Shopee Flash Sale Rp 1.000</span>
                  </div>
                  <span className="bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded text-[11px] flex items-center gap-1">
                    <i className="fa-solid fa-bolt text-amber-300"></i> {item.checkoutSpeedMs} ms
                  </span>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start gap-3 mb-3">
                      <img
                        src={item.image}
                        alt={item.productName}
                        className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-900 text-xs line-clamp-2 mb-1">
                          {item.productName}
                        </h4>
                        <div className="text-[11px] text-slate-400 line-through">
                          {item.normalPrice}
                        </div>
                        <div className="text-base font-black text-emerald-600 font-mono">
                          {item.checkoutPrice}
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-2.5 text-[11px] text-slate-600 space-y-1 border border-slate-100 mb-3">
                      <div className="flex justify-between">
                        <span>No. Pesanan:</span>
                        <strong className="font-mono text-slate-800">#{item.orderNumber}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Waktu Checkout:</span>
                        <span className="font-mono text-slate-700">{item.checkoutDate}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Status:</span>
                        <strong className="text-emerald-600">{item.status}</strong>
                      </div>
                    </div>

                    <p className="text-xs text-slate-700 italic bg-amber-50/70 p-2.5 rounded-lg border border-amber-200/60 mb-2">
                      "{item.reviewText}"
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <div className="flex items-center gap-2">
                      <img
                        src={item.avatar}
                        alt={item.buyerName}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                      <span className="font-semibold text-slate-800 text-[11px]">
                        {item.buyerName}
                      </span>
                    </div>
                    <span className="text-blue-600 font-bold text-xs hover:underline flex items-center gap-1">
                      <i className="fa-solid fa-magnifying-glass-plus"></i> Lihat Struk Lengkap
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modal Detail Struk Zoom */}
        {activeProof && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-300 animate-in fade-in">
              <div className="bg-gradient-to-r from-orange-600 to-amber-600 p-4 text-white flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <i className="fa-solid fa-file-invoice"></i>
                  <span>INVOICE RESMI SHOPEE FLASH SALE</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveProof(null)}
                  className="text-white hover:text-slate-200 text-lg font-bold"
                >
                  &times;
                </button>
              </div>

              <div className="p-5 max-h-[80vh] overflow-y-auto text-xs text-slate-800 space-y-4">
                {/* Shopee Watermark Banner */}
                <div className="border-2 border-dashed border-emerald-500 bg-emerald-50 p-3 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <i className="fa-solid fa-certificate text-emerald-600 text-2xl"></i>
                    <div>
                      <div className="font-black text-emerald-800 text-xs">TERVERIFIKASI SISTEM SHOPEE</div>
                      <div className="text-[10px] text-emerald-700">Audit Trail Hash: 0x8a92f...7c1a (Valid)</div>
                    </div>
                  </div>
                  <span className="text-emerald-800 font-mono font-bold text-xs bg-emerald-200/80 px-2 py-1 rounded flex items-center gap-1">
                    <i className="fa-solid fa-bolt text-amber-500"></i> {activeProof.checkoutSpeedMs} ms
                  </span>
                </div>

                {/* Details table */}
                <div className="space-y-2 border-b border-slate-200 pb-3">
                  <div className="flex justify-between">
                    <span className="text-slate-500">No. Pesanan:</span>
                    <strong className="font-mono text-slate-900">{activeProof.orderNumber}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Waktu Pembayaran:</span>
                    <strong className="font-mono text-slate-900">{activeProof.checkoutDate}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Metode Pembayaran:</span>
                    <strong className="text-slate-900">{activeProof.paymentMethod}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Ekspedisi / Kurir:</span>
                    <strong className="text-slate-900">{activeProof.courier}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">No. Resi Pengiriman:</span>
                    <strong className="font-mono text-blue-600">{activeProof.trackingNumber}</strong>
                  </div>
                </div>

                {/* Product Box */}
                <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <img
                    src={activeProof.image}
                    alt={activeProof.productName}
                    className="w-14 h-14 rounded-lg object-cover"
                  />
                  <div className="flex-1">
                    <h5 className="font-bold text-xs text-slate-900">{activeProof.productName}</h5>
                    <div className="text-slate-400 line-through text-[11px]">{activeProof.normalPrice}</div>
                    <div className="text-emerald-600 font-bold">Voucher Diskon Flash Sale: -{activeProof.discountAmount}</div>
                  </div>
                </div>

                {/* Total */}
                <div className="bg-slate-900 text-white p-3 rounded-xl flex items-center justify-between">
                  <span className="font-bold text-xs">Total Pembayaran Akhir:</span>
                  <span className="font-mono font-black text-xl text-emerald-400">
                    {activeProof.checkoutPrice}
                  </span>
                </div>

                {/* Buyer info */}
                <div className="text-[11px] text-slate-500 flex items-center justify-between pt-2">
                  <span>Pembeli: <strong>{activeProof.buyerName}</strong> ({activeProof.buyerLocation})</span>
                  <span className="text-emerald-600 font-bold"><i className="fa-solid fa-check"></i> {activeProof.status}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setActiveProof(null)}
                  style={{ width: 'auto', padding: '8px 16px', fontSize: '12px' }}
                >
                  Tutup Struk
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="modal-actions" style={{ padding: '16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={onClose}
            style={{ width: 'auto' }}
          >
            Tutup Galeri
          </button>
        </div>
      </div>
    </div>
  );
};
