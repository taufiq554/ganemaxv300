export type AseanCountryCode = 'ID' | 'SG' | 'MY' | 'TH' | 'VN' | 'PH';

export interface AseanRegionInfo {
  code: AseanCountryCode;
  name: string;
  flag: string;
  currency: string;
  currencySymbol: string;
  exchangeRateToIdr: number;
  domain: string;
  checkoutEndpoint: string;
  ntpServer: string;
  timezone: string;
  timezoneLabel: string;
  phonePrefix: string;
  flashSaleSchedule: string[];
  popularPaymentMethods: { id: string; label: string; icon: string }[];
  sampleFlashProduct: {
    title: string;
    originalPrice: number;
    flashPrice: number;
    url: string;
  };
  proxyPreset: { host: string; port: number }[];
}

export const ASEAN_REGIONS: Record<AseanCountryCode, AseanRegionInfo> = {
  ID: {
    code: 'ID',
    name: 'Indonesia',
    flag: '🇮🇩',
    currency: 'IDR',
    currencySymbol: 'Rp',
    exchangeRateToIdr: 1,
    domain: 'shopee.co.id',
    checkoutEndpoint: 'https://shopee.co.id/api/v4/checkout',
    ntpServer: 'id.pool.ntp.org',
    timezone: 'Asia/Jakarta',
    timezoneLabel: 'WIB',
    phonePrefix: '+62',
    flashSaleSchedule: ['00:00', '12:00', '18:00', '20:00', '21:00'],
    popularPaymentMethods: [
      { id: 'shopeepay', label: 'ShopeePay (Bypass PIN Instant)', icon: 'fa-solid fa-wallet' },
      { id: 'spaylater', label: 'SPayLater (0% Bunga)', icon: 'fa-solid fa-credit-card' },
      { id: 'bank_transfer', label: 'Virtual Account (BCA / Mandiri / BRI / BNI)', icon: 'fa-solid fa-building-columns' },
      { id: 'cod', label: 'COD (Bayar di Tempat)', icon: 'fa-solid fa-hand-holding-dollar' },
    ],
    sampleFlashProduct: {
      title: 'Apple iPhone 15 Pro Max 256GB Titanium Natural (Garansi Resmi)',
      originalPrice: 24999000,
      flashPrice: 1000,
      url: 'https://shopee.co.id/Apple-iPhone-15-Pro-Max-256GB-Natural-i.123456.987654',
    },
    proxyPreset: [
      { host: 'id-res.ganemax-mesh.net', port: 8081 },
      { host: 'id-jkt.shopee-speed.io', port: 9020 },
    ],
  },
  SG: {
    code: 'SG',
    name: 'Singapore',
    flag: '🇸🇬',
    currency: 'SGD',
    currencySymbol: 'S$',
    exchangeRateToIdr: 11800,
    domain: 'shopee.sg',
    checkoutEndpoint: 'https://shopee.sg/api/v4/checkout',
    ntpServer: 'sg.pool.ntp.org',
    timezone: 'Asia/Singapore',
    timezoneLabel: 'SGT (UTC+8)',
    phonePrefix: '+65',
    flashSaleSchedule: ['00:00', '12:00', '18:00', '20:00', '22:00'],
    popularPaymentMethods: [
      { id: 'shopeepay_sg', label: 'ShopeePay SG (One-Click)', icon: 'fa-solid fa-wallet' },
      { id: 'paynow', label: 'PayNow QR (Auto Dynamic)', icon: 'fa-solid fa-qrcode' },
      { id: 'spaylater_sg', label: 'SPayLater Singapore', icon: 'fa-solid fa-credit-card' },
      { id: 'card_sg', label: 'Credit / Debit Card (Tokenized)', icon: 'fa-brands fa-cc-visa' },
    ],
    sampleFlashProduct: {
      title: 'Sony PlayStation 5 Slim Digital Edition (1TB SSD)',
      originalPrice: 669,
      flashPrice: 1,
      url: 'https://shopee.sg/Sony-PlayStation-5-Slim-Digital-i.987654.123456',
    },
    proxyPreset: [
      { host: 'sg-node1.ganemax-mesh.net', port: 8082 },
      { host: 'sg-jurong.shopee-speed.io', port: 9022 },
    ],
  },
  MY: {
    code: 'MY',
    name: 'Malaysia',
    flag: '🇲🇾',
    currency: 'MYR',
    currencySymbol: 'RM',
    exchangeRateToIdr: 3600,
    domain: 'shopee.com.my',
    checkoutEndpoint: 'https://shopee.com.my/api/v4/checkout',
    ntpServer: 'my.pool.ntp.org',
    timezone: 'Asia/Kuala_Lumpur',
    timezoneLabel: 'MYT (UTC+8)',
    phonePrefix: '+60',
    flashSaleSchedule: ['00:00', '12:00', '16:00', '20:00', '22:00'],
    popularPaymentMethods: [
      { id: 'shopeepay_my', label: 'ShopeePay MY (Fast PIN)', icon: 'fa-solid fa-wallet' },
      { id: 'tng_ewallet', label: "Touch 'n Go eWallet", icon: 'fa-solid fa-mobile-screen-button' },
      { id: 'duitnow', label: 'DuitNow QR Instant', icon: 'fa-solid fa-qrcode' },
      { id: 'fpx_my', label: 'Maybank2u / CIMB / FPX Online', icon: 'fa-solid fa-building-columns' },
      { id: 'spaylater_my', label: 'SPayLater Malaysia', icon: 'fa-solid fa-credit-card' },
    ],
    sampleFlashProduct: {
      title: 'Apple iPad Air M2 11-inch Wi-Fi 128GB Space Grey',
      originalPrice: 2999,
      flashPrice: 1,
      url: 'https://shopee.com.my/Apple-iPad-Air-M2-11-inch-i.654321.112233',
    },
    proxyPreset: [
      { host: 'my-kl.ganemax-mesh.net', port: 8083 },
      { host: 'my-cyberjaya.shopee-speed.io', port: 9024 },
    ],
  },
  TH: {
    code: 'TH',
    name: 'Thailand',
    flag: '🇹🇭',
    currency: 'THB',
    currencySymbol: '฿',
    exchangeRateToIdr: 460,
    domain: 'shopee.co.th',
    checkoutEndpoint: 'https://shopee.co.th/api/v4/checkout',
    ntpServer: 'th.pool.ntp.org',
    timezone: 'Asia/Bangkok',
    timezoneLabel: 'ICT (UTC+7)',
    phonePrefix: '+66',
    flashSaleSchedule: ['00:00', '12:00', '18:00', '21:00'],
    popularPaymentMethods: [
      { id: 'shopeepay_th', label: 'ShopeePay Thailand (Direct API)', icon: 'fa-solid fa-wallet' },
      { id: 'promptpay', label: 'PromptPay QR (National Switch)', icon: 'fa-solid fa-qrcode' },
      { id: 'kbank_scb', label: 'Mobile Banking (KBank / SCB Easy)', icon: 'fa-solid fa-building-columns' },
      { id: 'spaylater_th', label: 'SPayLater Thailand', icon: 'fa-solid fa-credit-card' },
      { id: 'cod_th', label: 'Cash on Delivery (เก็บเงินปลายทาง)', icon: 'fa-solid fa-hand-holding-dollar' },
    ],
    sampleFlashProduct: {
      title: 'Dyson Airwrap Multi-Styler Complete Long Nickel/Copper',
      originalPrice: 21900,
      flashPrice: 1,
      url: 'https://shopee.co.th/Dyson-Airwrap-Multi-Styler-i.332211.778899',
    },
    proxyPreset: [
      { host: 'th-bkk.ganemax-mesh.net', port: 8084 },
      { host: 'th-res.shopee-speed.io', port: 9026 },
    ],
  },
  VN: {
    code: 'VN',
    name: 'Vietnam',
    flag: '🇻🇳',
    currency: 'VND',
    currencySymbol: '₫',
    exchangeRateToIdr: 0.63,
    domain: 'shopee.vn',
    checkoutEndpoint: 'https://shopee.vn/api/v4/checkout',
    ntpServer: 'vn.pool.ntp.org',
    timezone: 'Asia/Ho_Chi_Minh',
    timezoneLabel: 'ICT (UTC+7)',
    phonePrefix: '+84',
    flashSaleSchedule: ['00:00', '09:00', '12:00', '15:00', '18:00', '21:00'],
    popularPaymentMethods: [
      { id: 'shopeepay_vn', label: 'ShopeePay (Ví AirPay VN)', icon: 'fa-solid fa-wallet' },
      { id: 'momo_vn', label: 'Ví Điện Tử MoMo', icon: 'fa-solid fa-mobile-screen' },
      { id: 'zalopay_vn', label: 'Ví ZaloPay QR', icon: 'fa-solid fa-qrcode' },
      { id: 'spaylater_vn', label: 'SPayLater Vietnam', icon: 'fa-solid fa-credit-card' },
      { id: 'cod_vn', label: 'COD (Thanh toán khi nhận hàng)', icon: 'fa-solid fa-hand-holding-dollar' },
    ],
    sampleFlashProduct: {
      title: 'Điện thoại Samsung Galaxy S24 Ultra 12GB/256GB',
      originalPrice: 31990000,
      flashPrice: 1000,
      url: 'https://shopee.vn/Samsung-Galaxy-S24-Ultra-i.445566.998877',
    },
    proxyPreset: [
      { host: 'vn-hcm.ganemax-mesh.net', port: 8085 },
      { host: 'vn-han.shopee-speed.io', port: 9028 },
    ],
  },
  PH: {
    code: 'PH',
    name: 'Philippines',
    flag: '🇵🇭',
    currency: 'PHP',
    currencySymbol: '₱',
    exchangeRateToIdr: 280,
    domain: 'shopee.ph',
    checkoutEndpoint: 'https://shopee.ph/api/v4/checkout',
    ntpServer: 'ph.pool.ntp.org',
    timezone: 'Asia/Manila',
    timezoneLabel: 'PHT (UTC+8)',
    phonePrefix: '+63',
    flashSaleSchedule: ['00:00', '12:00', '18:00', '21:00'],
    popularPaymentMethods: [
      { id: 'shopeepay_ph', label: 'ShopeePay PH (Instant PIN Bypass)', icon: 'fa-solid fa-wallet' },
      { id: 'gcash', label: 'GCash (Direct Token Auth)', icon: 'fa-solid fa-mobile-screen' },
      { id: 'maya_ph', label: 'Maya (PayMaya Wallet)', icon: 'fa-solid fa-wallet' },
      { id: 'spaylater_ph', label: 'SPayLater Philippines', icon: 'fa-solid fa-credit-card' },
      { id: 'cod_ph', label: 'Cash on Delivery (COD)', icon: 'fa-solid fa-hand-holding-dollar' },
    ],
    sampleFlashProduct: {
      title: 'Nintendo Switch OLED Model White Set (Official Warranty)',
      originalPrice: 16995,
      flashPrice: 1,
      url: 'https://shopee.ph/Nintendo-Switch-OLED-White-i.778899.334455',
    },
    proxyPreset: [
      { host: 'ph-mnl.ganemax-mesh.net', port: 8086 },
      { host: 'ph-res.shopee-speed.io', port: 9030 },
    ],
  },
};

export const ALL_ASEAN_CODES: AseanCountryCode[] = ['ID', 'SG', 'MY', 'TH', 'VN', 'PH'];

export function formatAseanCurrency(amount: number, regionCode: AseanCountryCode = 'ID'): string {
  const reg = ASEAN_REGIONS[regionCode] || ASEAN_REGIONS.ID;
  if (regionCode === 'ID' || regionCode === 'VN') {
    return `${reg.currencySymbol} ${Math.round(amount).toLocaleString('id-ID')}`;
  }
  return `${reg.currencySymbol} ${Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
