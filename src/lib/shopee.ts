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
 * URL untuk membuka produk. Mode "app" di Android memakai intent:// supaya langsung
 * masuk aplikasi Shopee (fallback ke browser kalau app tidak terpasang).
 */
export function buildOpenUrl(url: string, region: AseanCountryCode, mode: 'app' | 'browser'): { href: string; via: string } {
  if (mode === 'app' && isAndroid() && isValidHttpUrl(url)) {
    const u = new URL(url);
    const pkg = ANDROID_PACKAGE[region] || ANDROID_PACKAGE.ID;
    const href = `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=${pkg};S.browser_fallback_url=${encodeURIComponent(url)};end`;
    return { href, via: `app Shopee (${pkg})` };
  }
  return { href: url, via: mode === 'app' ? 'link Shopee (app terbuka otomatis bila terpasang)' : 'browser' };
}
