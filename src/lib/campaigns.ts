import { AseanCountryCode } from '../types/index.ts';
import { tzParts, tzOffsetMs } from './time.ts';
import { ASEAN_REGIONS } from '../constants/asean.ts';

/**
 * Kalender kampanye besar Shopee.
 *
 * Shopee menjalankan kampanye ini berulang tiap tahun pada tanggal yang tetap:
 * tanggal kembar (1.1 sampai 12.12) dan Gajian Sale tiap akhir bulan. Endpoint
 * flash sale biasa hanya memuat sesi beberapa jam ke depan, jadi event sebesar
 * 11.11 baru kelihatan di sana saat harinya tiba — padahal user perlu bersiap
 * jauh hari.
 *
 * TANGGALNYA pasti karena memang berulang tiap tahun. JAM sesinya tidak
 * ditebak di sini; itu diambil dari API Shopee saat sesinya sudah terbit.
 */

export type CampaignTier = 'mega' | 'twin' | 'payday';

export interface Campaign {
  id: string;
  /** Nama pendek, mis. "11.11" */
  code: string;
  nameId: string;
  nameEn: string;
  tier: CampaignTier;
  /** Tengah malam waktu lokal wilayah, dalam epoch ms */
  startsAt: number;
  day: number;
  month: number;
  year: number;
}

/** Kampanye tanggal kembar yang paling besar di Asia Tenggara. */
const MEGA_MONTHS = new Set([9, 10, 11, 12]);

const TWIN_NAME: Record<number, [string, string]> = {
  1: ['New Year Sale', 'New Year Sale'],
  2: ['Shopee 2.2', 'Shopee 2.2'],
  3: ['Shopee 3.3', 'Shopee 3.3'],
  4: ['Shopee 4.4', 'Shopee 4.4'],
  5: ['Shopee 5.5', 'Shopee 5.5'],
  6: ['Shopee 6.6', 'Shopee 6.6'],
  7: ['Shopee 7.7', 'Shopee 7.7'],
  8: ['Shopee 8.8', 'Shopee 8.8'],
  9: ['Shopee 9.9 Super Shopping Day', 'Shopee 9.9 Super Shopping Day'],
  10: ['Shopee 10.10 Brands Festival', 'Shopee 10.10 Brands Festival'],
  11: ['Shopee 11.11 Big Sale', 'Shopee 11.11 Big Sale'],
  12: ['Shopee 12.12 Birthday Sale', 'Shopee 12.12 Birthday Sale'],
};

/** Epoch ms untuk tengah malam tanggal tertentu di zona waktu wilayah. */
function localMidnight(year: number, month: number, day: number, tz: string): number {
  // Tebak dari UTC lalu koreksi memakai offset zona pada saat itu
  const guess = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  const off = tzOffsetMs(guess, tz);
  return guess - off;
}

/**
 * Daftar kampanye yang akan datang, diurutkan dari yang paling dekat.
 * @param monthsAhead berapa bulan ke depan yang dilihat
 */
export function upcomingCampaigns(region: AseanCountryCode, now: number, monthsAhead = 14): Campaign[] {
  const tz = (ASEAN_REGIONS[region] || ASEAN_REGIONS.ID).timezone;
  const nowParts = tzParts(now, tz);
  const out: Campaign[] = [];

  for (let i = 0; i <= monthsAhead; i++) {
    const m0 = nowParts.m - 1 + i;
    const year = nowParts.y + Math.floor(m0 / 12);
    const month = (m0 % 12) + 1;

    // Tanggal kembar: tanggal == bulan
    const twinStart = localMidnight(year, month, month, tz);
    const [nid, nen] = TWIN_NAME[month];
    out.push({
      id: `twin-${year}-${month}`,
      code: `${month}.${month}`,
      nameId: nid,
      nameEn: nen,
      tier: MEGA_MONTHS.has(month) ? 'mega' : 'twin',
      startsAt: twinStart,
      day: month,
      month,
      year,
    });

    // Gajian Sale: tanggal 25 tiap bulan
    const payStart = localMidnight(year, month, 25, tz);
    out.push({
      id: `pay-${year}-${month}`,
      code: '25',
      nameId: 'Gajian Sale',
      nameEn: 'Payday Sale',
      tier: 'payday',
      startsAt: payStart,
      day: 25,
      month,
      year,
    });
  }

  // Masih relevan sampai akhir harinya (24 jam setelah tengah malam)
  return out.filter((c) => c.startsAt + 86_400_000 > now).sort((a, b) => a.startsAt - b.startsAt);
}

/** true kalau kampanye sedang berlangsung hari ini di wilayah tersebut. */
export function isToday(c: Campaign, now: number): boolean {
  return now >= c.startsAt && now < c.startsAt + 86_400_000;
}
