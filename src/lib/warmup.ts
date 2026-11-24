/**
 * Pemanasan koneksi ke Shopee sebelum detik 0.
 *
 * Membuka halaman di HP diawali tiga langkah yang makan waktu sebelum satu byte
 * pun halaman produk terunduh: cari alamat server (DNS), sambungan TCP, dan
 * jabat tangan TLS. Di jaringan seluler, ketiganya bisa 300–800 ms.
 *
 * `preconnect` menyuruh browser menyelesaikan ketiganya sekarang juga, jadi saat
 * Shopee benar-benar dibuka, sambungannya sudah siap pakai.
 *
 * Batasnya perlu disebut terus terang: ini memangkas waktu menyambung, bukan
 * waktu Shopee merender halamannya. Untuk itu solusinya adalah membuka lebih
 * awal (pengaturan "Buka Shopee lebih awal").
 */

const DOMAIN: Record<string, string> = {
  ID: 'shopee.co.id',
  MY: 'shopee.com.my',
  SG: 'shopee.sg',
  TH: 'shopee.co.th',
  VN: 'shopee.vn',
  PH: 'shopee.ph',
};

const CDN: Record<string, string> = {
  ID: 'down-id.img.susercontent.com',
  MY: 'down-my.img.susercontent.com',
  SG: 'down-sg.img.susercontent.com',
  TH: 'down-th.img.susercontent.com',
  VN: 'down-vn.img.susercontent.com',
  PH: 'down-ph.img.susercontent.com',
};

const MARK = 'data-gx-warm';

function addHint(rel: 'preconnect' | 'dns-prefetch', href: string) {
  if (typeof document === 'undefined') return;
  if (document.head.querySelector(`link[${MARK}][rel="${rel}"][href="${href}"]`)) return;
  const l = document.createElement('link');
  l.rel = rel;
  l.href = href;
  if (rel === 'preconnect') l.crossOrigin = 'anonymous';
  l.setAttribute(MARK, '1');
  document.head.appendChild(l);
}

/** Panaskan koneksi ke domain Shopee wilayah tertentu (aman dipanggil berkali-kali). */
export function warmShopee(region: string) {
  const host = DOMAIN[region] || DOMAIN.ID;
  const cdn = CDN[region] || CDN.ID;
  for (const h of [`https://${host}`, `https://${cdn}`, 'https://deo.shopeemobile.com']) {
    addHint('dns-prefetch', h);
    addHint('preconnect', h);
  }
}

/**
 * Minta browser mengunduh halaman produk lebih dulu lewat Speculation Rules.
 * Hanya didukung Chrome versi baru, dan Chrome bisa melewatinya (misalnya kalau
 * kamu sudah login Shopee di browser). Kalau tidak didukung, tidak terjadi apa-apa.
 */
export function prefetchProduct(url: string) {
  if (typeof document === 'undefined' || !/^https:\/\//.test(url)) return;
  const supports = (HTMLScriptElement as any).supports?.('speculationrules');
  if (!supports) return;
  document.head.querySelectorAll('script[data-gx-spec]').forEach((n) => n.remove());
  const s = document.createElement('script');
  s.type = 'speculationrules';
  s.setAttribute('data-gx-spec', '1');
  s.textContent = JSON.stringify({ prefetch: [{ source: 'list', urls: [url], eagerness: 'immediate' }] });
  document.head.appendChild(s);
}
