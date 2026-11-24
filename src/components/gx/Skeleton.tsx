import React from 'react';

/**
 * Kerangka konten saat data dimuat. Bentuknya meniru isi aslinya, jadi
 * tata letak tidak meloncat begitu data tiba — beda dengan ikon berputar yang
 * cuma bilang "tunggu" tanpa memberi gambaran apa yang akan muncul.
 */

export const Skel: React.FC<{
  w?: number | string;
  h?: number | string;
  r?: number | string;
  style?: React.CSSProperties;
  className?: string;
}> = ({ w = '100%', h = 12, r = 6, style, className = '' }) => (
  <span className={`gx-skel ${className}`} style={{ width: w, height: h, borderRadius: r, ...style }} aria-hidden="true" />
);

/** Baris daftar: thumbnail opsional + dua baris teks + tombol opsional. */
export const SkelRow: React.FC<{ thumb?: boolean; action?: boolean; delay?: number }> = ({ thumb = true, action = false, delay = 0 }) => (
  <li className="gx-row gx-skelrow" style={{ animationDelay: `${delay}ms` }} aria-hidden="true">
    {thumb && <Skel w={46} h={46} r={10} style={{ flex: 'none' }} />}
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
      <Skel w="78%" h={13} />
      <Skel w="46%" h={11} />
    </div>
    {action && <Skel w={88} h={30} r={999} style={{ flex: 'none' }} />}
  </li>
);

/** Daftar kerangka; label disembunyikan untuk pembaca layar agar tetap informatif. */
export const SkelList: React.FC<{ rows?: number; thumb?: boolean; action?: boolean; label: string }> = ({ rows = 4, thumb = true, action = false, label }) => (
  <div role="status" aria-live="polite">
    <span className="gx-sr">{label}</span>
    <ul className="gx-list">
      {Array.from({ length: rows }, (_, i) => (
        <SkelRow key={i} thumb={thumb} action={action} delay={i * 90} />
      ))}
    </ul>
  </div>
);

/** Kartu angka (KPI) versi kerangka. */
export const SkelKpi: React.FC = () => (
  <div className="gx-card gx-kpi" aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    <Skel w="55%" h={11} />
    <Skel w="70%" h={24} r={8} />
    <Skel w="40%" h={10} />
  </div>
);

/** Indikator kecil di dalam tombol — cincin tipis, bukan ikon panah berputar. */
export const Ring: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <span className="gx-ring" style={{ width: size, height: size }} aria-hidden="true" />
);
