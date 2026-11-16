/**
 * Membuka Shopee TANPA perlu user menyentuh apa pun di detik 0.
 *
 * Browser memblokir window.open() yang dipanggil dari timer karena dianggap popup.
 * Jalan keluarnya: tab-nya dipesan lebih dulu saat user menekan "Jalankan" /
 * "Aktifkan auto-start" (itu gesture asli), lalu di detik 0 tab tersebut
 * tinggal diarahkan ke link produk. Kalau tab itu hilang (ditutup user atau
 * diblokir), dipakai cadangan: halaman ini sendiri yang pindah ke Shopee —
 * cara ini tidak pernah diblokir, dan log serta jadwal sudah tersimpan
 * sehingga dashboard utuh lagi saat user kembali.
 */

let standby: Window | null = null;

const STANDBY_DOC = (text: string, sub: string) => `<!doctype html>
<html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>GaneMaX.Ai</title>
<style>
  html,body{height:100%;margin:0}
  body{display:flex;align-items:center;justify-content:center;
    font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
    background:#0b1b3a;color:#fff;text-align:center;padding:24px}
  .w{max-width:320px}
  .d{width:54px;height:54px;margin:0 auto 18px;border-radius:14px;
    background:#2563eb;animation:p 1.4s ease-in-out infinite}
  h1{font-size:17px;margin:0 0 8px;font-weight:700}
  p{font-size:13px;margin:0;opacity:.75;line-height:1.5}
  @keyframes p{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(.82);opacity:.55}}
</style></head>
<body><div class="w"><div class="d"></div><h1>${text}</h1><p>${sub}</p></div></body></html>`;

/** Dipanggil dari handler klik user. Menyiapkan satu tab siaga. */
export function reserveStandbyTab(title: string, sub: string): boolean {
  try {
    if (standby && !standby.closed) {
      try {
        standby.document.open();
        standby.document.write(STANDBY_DOC(title, sub));
        standby.document.close();
      } catch {}
      return true;
    }
    // Penting: JANGAN pakai fitur 'noopener'/'noreferrer' di sini — keduanya
    // membuat window.open mengembalikan null, jadi tab siaganya tidak bisa
    // dikendalikan lagi. Opener diputus manual di bawah.
    const w = window.open('', 'gx_shopee');
    if (!w) {
      standby = null;
      return false;
    }
    try {
      w.opener = null;
    } catch {}
    try {
      w.document.open();
      w.document.write(STANDBY_DOC(title, sub));
      w.document.close();
    } catch {}
    standby = w;
    return true;
  } catch {
    standby = null;
    return false;
  }
}

export function hasStandbyTab(): boolean {
  try {
    return !!standby && !standby.closed;
  } catch {
    return false;
  }
}

export function releaseStandbyTab() {
  try {
    if (standby && !standby.closed) standby.close();
  } catch {}
  standby = null;
}

export type OpenVia = 'standby-tab' | 'same-tab' | 'popup' | 'blocked';

/**
 * Membuka link produk di detik 0.
 * @param beforeSameTab dijalankan tepat sebelum halaman ini pindah ke Shopee
 *                      (dipakai untuk menyimpan log & jadwal).
 */
export function openNow(href: string, beforeSameTab?: () => void): OpenVia {
  // 1. Tab siaga yang sudah dipesan sejak gesture user
  try {
    if (standby && !standby.closed) {
      standby.location.href = href;
      try {
        standby.focus();
      } catch {}
      standby = null;
      return 'standby-tab';
    }
  } catch {
    standby = null;
  }

  // 2. Masih sempat coba popup biasa (beberapa browser desktop mengizinkan)
  if (!href.startsWith('intent:')) {
    try {
      const w = window.open(href, '_blank');
      if (w) {
        try {
          w.opener = null;
        } catch {}
        return 'popup';
      }
    } catch {}
  }

  // 3. Cadangan terakhir: halaman ini yang pindah. Tidak pernah diblokir.
  try {
    beforeSameTab?.();
    window.location.href = href;
    return 'same-tab';
  } catch {
    return 'blocked';
  }
}
