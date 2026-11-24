/**
 * Membuka Shopee TANPA perlu user menyentuh apa pun di detik 0.
 *
 * Caranya: halaman ini sendiri yang pindah ke link produk. Navigasi halaman
 * sendiri tidak pernah diblokir browser, tidak butuh izin popup, dan di Android
 * link `intent://` langsung melempar ke aplikasi Shopee.
 *
 * Pendekatan "tab siaga" (membuka tab kosong lebih awal lalu diarahkan di detik 0)
 * sengaja TIDAK dipakai: tab kosong itu merebut layar sejak tombol ditekan dan
 * terlihat seperti aplikasi error, padahal belum terjadi apa-apa.
 *
 * Log, jadwal, dan sesi war disimpan dulu sebelum pindah, jadi dashboard utuh
 * kembali begitu user balik dari Shopee.
 */

export type OpenVia = 'same-tab' | 'blocked';

export function openNow(href: string, beforeNavigate?: () => void): OpenVia {
  try {
    beforeNavigate?.();
  } catch {
    // Gagal menyimpan bukan alasan membatalkan pembukaan Shopee
  }
  try {
    window.location.href = href;
    return 'same-tab';
  } catch {
    return 'blocked';
  }
}
