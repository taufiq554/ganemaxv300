import { AseanCountryCode } from '../types/index.ts';

export function parseShopeeLink(url?: string | null): { shopId: string; itemId: string } | null {
  if (!url) return null;
  const m1 = url.match(/-i\.(\d+)\.(\d+)/);
  if (m1) return { shopId: m1[1], itemId: m1[2] };
  const m2 = url.match(/\/product\/(\d+)\/(\d+)/);
  if (m2) return { shopId: m2[1], itemId: m2[2] };
  return null;
}

export function isValidHttpUrl(url?: string | null) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

const ANDROID_PACKAGE: Record<AseanCountryCode, string> = {
  ID: 'com.shopee.id',
  MY: 'com.shopee.my',
  SG: 'com.shopee.sg',
  TH: 'com.shopee.th',
  PH: 'com.shopee.ph',
  VN: 'com.beeasy.shopee.vn',
};

export const isAndroid = () => typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

/**
 * URL untuk membuka produk.
 *
 * - "browser" (bawaan): di Android memakai intent yang ditujukan ke Chrome, jadi
 *   produk terbuka di browser walaupun app Shopee terpasang (app Shopee sering
 *   butuh beberapa detik untuk start, browser yang sudah login jauh lebih cepat).
 *   Kalau Chrome tidak ada, intent jatuh ke link biasa di browser yang sedang dipakai.
 * - "app": intent ke aplikasi Shopee (fallback ke browser kalau app tidak terpasang).
 */
export function buildOpenUrl(url: string, region: AseanCountryCode, mode: 'app' | 'browser'): { href: string; via: string } {
  if (isAndroid() && isValidHttpUrl(url)) {
    const u = new URL(url);
    const fallback = `S.browser_fallback_url=${encodeURIComponent(url)}`;
    if (mode === 'app') {
      const pkg = ANDROID_PACKAGE[region] || ANDROID_PACKAGE.ID;
      return { href: `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=${pkg};${fallback};end`, via: `app Shopee (${pkg})` };
    }
    return { href: `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=com.android.chrome;${fallback};end`, via: 'browser Chrome' };
  }
  return { href: url, via: mode === 'app' ? 'link Shopee (app terbuka otomatis bila terpasang)' : 'browser' };
}

const LOGIN_HOST: Record<AseanCountryCode, string> = {
  ID: 'shopee.co.id',
  MY: 'shopee.com.my',
  SG: 'shopee.sg',
  TH: 'shopee.co.th',
  PH: 'shopee.ph',
  VN: 'shopee.vn',
};

/** Halaman login Shopee di browser (sesi login tersimpan di browser, dipakai saat war). */
export function shopeeLoginUrl(region: AseanCountryCode): string {
  return `https://${LOGIN_HOST[region] || LOGIN_HOST.ID}/buyer/login`;
}
