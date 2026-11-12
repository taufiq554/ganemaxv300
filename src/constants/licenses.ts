export interface LicenseTier {
  id: string;
  label: string;
  short: string;
  price: number;
  priceRp: string;
  priceUsd: string;
  days: number;
  maxAccounts: number;
  maxThreads: number;
  deviceLimit: number;
}

export const LICENSE_TIERS: LicenseTier[] = [
  { id: '30_hari', label: '30 Hari (1 Bulan Starter)', short: '30 Hari', price: 150000, priceRp: 'Rp 150.000', priceUsd: '$10', days: 30, maxAccounts: 5, maxThreads: 8, deviceLimit: 3 },
  { id: '60_hari', label: '60 Hari (2 Bulan Best Value)', short: '60 Hari', price: 250000, priceRp: 'Rp 250.000', priceUsd: '$17', days: 60, maxAccounts: 10, maxThreads: 12, deviceLimit: 5 },
  { id: '365_hari', label: '365 Hari (1 Tahun VIP)', short: '1 Tahun', price: 1000000, priceRp: 'Rp 1.000.000', priceUsd: '$68', days: 365, maxAccounts: 25, maxThreads: 16, deviceLimit: 10 },
  { id: 'lifetime', label: 'Unlimited Permanen (Lifetime)', short: 'Lifetime', price: 3300000, priceRp: 'Rp 3.300.000', priceUsd: '$220', days: 36500, maxAccounts: 999, maxThreads: 24, deviceLimit: 99 },
];

// Paket lama yang mungkin masih tersimpan di data user
const LEGACY_ALIASES: Record<string, string> = {
  '1_bulan': '30_hari',
  '2_bulan': '60_hari',
  '1_tahun': '365_hari',
};

export function findTier(planId?: string | null): LicenseTier | undefined {
  if (!planId) return undefined;
  const id = LEGACY_ALIASES[planId] || planId;
  return LICENSE_TIERS.find((t) => t.id === id);
}

export const formatRp = (n: number) => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');

export const formatRpShort = (n: number) => {
  const v = Math.round(n || 0);
  if (v >= 1_000_000_000) return `Rp ${(v / 1_000_000_000).toFixed(1).replace('.', ',')} M`;
  if (v >= 1_000_000) return `Rp ${(v / 1_000_000).toFixed(1).replace('.', ',')} jt`;
  if (v >= 1_000) return `Rp ${Math.round(v / 1_000)} rb`;
  return `Rp ${v}`;
};
