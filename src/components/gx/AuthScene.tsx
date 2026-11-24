import React, { useEffect, useRef, useState } from 'react';

/**
 * Latar bergerak di halaman login: robot kecil GaneMaX yang melayang, cincin
 * orbit, dan partikel yang naik pelan.
 *
 * Supaya tidak patah-patah di HP kelas bawah, semua gerakan memakai transform
 * dan opacity saja — dua properti yang bisa dijalankan kartu grafis tanpa
 * menghitung ulang tata letak halaman. Tidak ada gambar besar yang diunduh:
 * seluruh robot digambar sebagai SVG, jadi tetap tajam di layar mana pun.
 *
 * Animasi dimatikan otomatis kalau pengguna memilih "kurangi animasi" di
 * pengaturan HP, atau saat tab tidak terlihat (hemat baterai).
 */
export const AuthScene: React.FC = () => {
  const [still, setStill] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setStill(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    const onVis = () => {
      const el = ref.current;
      if (el) el.style.animationPlayState = document.visibilityState === 'visible' ? 'running' : 'paused';
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      mq.removeEventListener?.('change', apply);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return (
    <div className={`nx-scene ${still ? 'nx-scene--still' : ''}`} ref={ref} aria-hidden="true">
      <span className="nx-orb nx-orb--1" />
      <span className="nx-orb nx-orb--2" />
      <span className="nx-orb nx-orb--3" />

      <div className="nx-bot">
        <svg viewBox="0 0 120 130" width="120" height="130" role="presentation" focusable="false">
          <defs>
            <linearGradient id="nxBody" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="1" stopColor="#dfe8ff" />
            </linearGradient>
            <linearGradient id="nxVisor" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#4d86ff" />
              <stop offset="1" stopColor="#2f6bff" />
            </linearGradient>
          </defs>

          {/* antena */}
          <line x1="60" y1="8" x2="60" y2="22" stroke="#9db6ff" strokeWidth="3" strokeLinecap="round" />
          <circle className="nx-bot__spark" cx="60" cy="7" r="5" fill="#4d86ff" />

          {/* kepala + visor */}
          <rect x="22" y="20" width="76" height="58" rx="22" fill="url(#nxBody)" stroke="#cfdcff" strokeWidth="2" />
          <rect x="34" y="34" width="52" height="30" rx="15" fill="url(#nxVisor)" />
          <circle className="nx-bot__eye" cx="50" cy="49" r="5.5" fill="#fff" />
          <circle className="nx-bot__eye nx-bot__eye--r" cx="70" cy="49" r="5.5" fill="#fff" />

          {/* badan + lengan */}
          <rect x="34" y="82" width="52" height="32" rx="14" fill="url(#nxBody)" stroke="#cfdcff" strokeWidth="2" />
          <g className="nx-bot__arm nx-bot__arm--l">
            <rect x="16" y="86" width="14" height="24" rx="7" fill="#e7eeff" stroke="#cfdcff" strokeWidth="2" />
          </g>
          <g className="nx-bot__arm nx-bot__arm--r">
            <rect x="90" y="86" width="14" height="24" rx="7" fill="#e7eeff" stroke="#cfdcff" strokeWidth="2" />
          </g>

          {/* logo berlian di dada */}
          <g className="nx-bot__chest" transform="translate(60 98)">
            <rect x="-5" y="-11" width="10" height="10" rx="3" transform="rotate(45)" fill="#4d4dff" />
            <rect x="-11" y="-5" width="10" height="10" rx="3" transform="rotate(45)" fill="#4d4dff" />
            <rect x="1" y="-5" width="10" height="10" rx="3" transform="rotate(45)" fill="#4d4dff" />
            <rect x="-5" y="1" width="10" height="10" rx="3" transform="rotate(45)" fill="#4d4dff" />
          </g>
        </svg>
        <span className="nx-bot__shadow" />
      </div>

      <div className="nx-dust">
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} style={{ ['--i' as any]: i }} />
        ))}
      </div>
    </div>
  );
};
