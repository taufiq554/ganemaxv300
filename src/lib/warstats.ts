/**
 * Catatan hasil tiap sesi war, tersimpan di perangkat.
 *
 * Angka presisi timer dan latensi selama ini cuma lewat di log lalu hilang.
 * Di sini semuanya disimpan supaya bisa (a) ditunjukkan ke user sebagai bukti
 * kerja bot, dan (b) dipakai mesin adaptif untuk menyetel sendiri jeda buka.
 */

const KEY = 'gx_war_stats_v1';
const MAX = 120;

export interface WarAttempt {
  id: string;
  at: number;
  targetTitle: string;
  /** Jadwal sesi (epoch) — null kalau dibuka manual. */
  scheduledEpoch: number | null;
  /** Jeda buka yang dipakai saat itu (ms sebelum detik 0). */
  leadMs: number;
  /**
   * Selisih waktu buka sebenarnya terhadap waktu buka yang diniatkan.
   * Positif = telat, negatif = kecepetan. Inilah ukuran presisi bot.
   */
  timerDeltaMs: number | null;
  /** Latensi gateway Shopee terukur saat itu (ms). */
  latencyMs: number | null;
  /** Akurasi sinkron jam saat itu (±ms). */
  clockAccuracyMs: number | null;
  /** Diisi saat user melaporkan hasil. */
  result: 'win' | 'miss' | 'unknown';
  practice: boolean;
}

export function loadAttempts(): WarAttempt[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter((x) => x && typeof x.at === 'number').slice(-MAX);
  } catch {
    return [];
  }
}

function persist(list: WarAttempt[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
  } catch {
    // kuota penuh — simpan separuh terakhir saja
    try {
      localStorage.setItem(KEY, JSON.stringify(list.slice(-40)));
    } catch {}
  }
}

export function addAttempt(a: Omit<WarAttempt, 'id'>): WarAttempt {
  const rec: WarAttempt = { ...a, id: `w_${a.at}_${Math.random().toString(36).slice(2, 7)}` };
  persist([...loadAttempts(), rec]);
  return rec;
}

/** Lengkapi hasil percobaan terakhir setelah user melapor menang/kalah. */
export function setLastResult(result: 'win' | 'miss') {
  const list = loadAttempts();
  for (let i = list.length - 1; i >= 0; i--) {
    if (!list[i].practice && list[i].result === 'unknown') {
      list[i] = { ...list[i], result };
      persist(list);
      return;
    }
  }
}

export function clearAttempts() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

export interface WarSummary {
  total: number;
  wins: number;
  misses: number;
  winRate: number | null;
  /** Presisi khas (median |delta|) dalam ms. */
  medianAbsDelta: number | null;
  bestAbsDelta: number | null;
  medianLatency: number | null;
  /** Kecenderungan: positif = cenderung telat, negatif = cenderung kecepetan. */
  biasMs: number | null;
  lastAt: number | null;
}

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

export function summarize(list: WarAttempt[]): WarSummary {
  const real = list.filter((a) => !a.practice);
  const deltas = list.map((a) => a.timerDeltaMs).filter((x): x is number => x != null);
  const lats = list.map((a) => a.latencyMs).filter((x): x is number => x != null);
  const wins = real.filter((a) => a.result === 'win').length;
  const misses = real.filter((a) => a.result === 'miss').length;
  const decided = wins + misses;
  return {
    total: real.length,
    wins,
    misses,
    winRate: decided > 0 ? Math.round((wins / decided) * 100) : null,
    medianAbsDelta: median(deltas.map(Math.abs)),
    bestAbsDelta: deltas.length ? Math.min(...deltas.map(Math.abs)) : null,
    medianLatency: median(lats),
    biasMs: median(deltas),
    lastAt: list.length ? list[list.length - 1].at : null,
  };
}

/* ------------------------------------------------------------------ */
/* Mesin adaptif                                                       */
/* ------------------------------------------------------------------ */

export interface AdaptiveAdvice {
  /** Jeda buka yang disarankan (ms sebelum detik 0). */
  leadMs: number;
  /** Seberapa bisa dipercaya saran ini. */
  confidence: 'low' | 'medium' | 'high';
  samples: number;
  reasonId: string;
  reasonEn: string;
}

export const LEAD_MIN = 120;
export const LEAD_MAX = 10000;

/**
 * Menghitung jeda buka dari data yang benar-benar terukur di perangkat ini:
 * kecenderungan telat/kecepetan timer + latensi gateway. Bukan tebakan dan
 * bukan model bahasa — murni statistik dari sesi yang sudah dijalankan.
 *
 * Logikanya: Shopee harus sudah terbuka tepat di detik 0. Kalau timer cenderung
 * telat 80 ms, jedanya ditambah 80 ms. Latensi jaringan ikut diperhitungkan
 * karena halaman butuh waktu untuk benar-benar tampil.
 */
export function adviseLead(list: WarAttempt[], currentLeadMs: number, liveLatencyMs: number | null): AdaptiveAdvice {
  const recent = list.slice(-20);
  const deltas = recent.map((a) => a.timerDeltaMs).filter((x): x is number => x != null);
  const lats = recent.map((a) => a.latencyMs).filter((x): x is number => x != null);
  const lat = liveLatencyMs ?? median(lats);
  const n = deltas.length;

  if (n < 3) {
    /*
     * Belum cukup bukti: pakai setelan user apa adanya. Dulu di sini jeda
     * dihitung dari latensi saja dan hasilnya bisa ratusan ms — jauh lebih
     * pendek dari waktu yang dibutuhkan halaman Shopee untuk tampil, sehingga
     * produk baru muncul setelah sesi lewat.
     */
    return {
      leadMs: clamp(currentLeadMs, LEAD_MIN, LEAD_MAX),
      confidence: 'low',
      samples: n,
      reasonId: `Baru ${n} sesi terukur — memakai setelan kamu dulu. Penyetelan otomatis mulai setelah 3 sesi.`,
      reasonEn: `Only ${n} measured sessions — using your setting for now. Auto-tuning starts after 3 sessions.`,
    };
  }

  const bias = median(deltas) ?? 0;
  const spread = median(deltas.map((d) => Math.abs(d - bias))) ?? 0;
  // Telat (bias positif) → majukan pembukaan. Margin kecil untuk sebaran.
  const target = clamp(Math.round(currentLeadMs + bias + spread * 0.5 + (lat != null ? lat * 0.25 : 0)), LEAD_MIN, LEAD_MAX);
  const confidence: AdaptiveAdvice['confidence'] = n >= 10 && spread <= 60 ? 'high' : n >= 6 ? 'medium' : 'low';

  const arah = bias > 0 ? 'telat' : bias < 0 ? 'kecepetan' : 'pas';
  const dir = bias > 0 ? 'late' : bias < 0 ? 'early' : 'on time';
  return {
    leadMs: target,
    confidence,
    samples: n,
    reasonId: `Dari ${n} sesi terakhir, pembukaan rata-rata ${arah} ${Math.abs(bias)} ms (sebaran ±${spread} ms)${lat != null ? `, latensi ${lat} ms` : ''}.`,
    reasonEn: `Across the last ${n} sessions the open was typically ${dir} by ${Math.abs(bias)} ms (spread ±${spread} ms)${lat != null ? `, latency ${lat} ms` : ''}.`,
  };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
