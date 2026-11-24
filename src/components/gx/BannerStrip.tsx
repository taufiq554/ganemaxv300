import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, ImageOff } from 'lucide-react';
import { Banner, BannerSlot } from '../../types/index.ts';
import { useLang } from '../../lib/i18n.tsx';

/**
 * Banner yang diatur admin dari panel. Satu slot bisa berisi beberapa banner;
 * kalau lebih dari satu, tampil sebagai carousel yang bisa digeser.
 * Rasio & gaya diambil dari pengaturan tiap banner supaya tinggi area gambar
 * sudah pasti sebelum gambarnya selesai dimuat — jadi layout tidak lompat.
 */

export const RATIO_VALUE: Record<string, string> = {
  '16:9': '16 / 9',
  '21:9': '21 / 9',
  '4:1': '4 / 1',
  '3:1': '3 / 1',
  '1:1': '1 / 1',
};

/** Ukuran gambar yang disarankan untuk tiap rasio, ditampilkan ke admin. */
export const RATIO_HINT: Record<string, string> = {
  '16:9': '1280 × 720 px',
  '21:9': '1470 × 630 px',
  '4:1': '1600 × 400 px',
  '3:1': '1500 × 500 px',
  '1:1': '900 × 900 px',
};

export const sortBanners = (list: Banner[]) =>
  [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.created_at || '').localeCompare(String(b.created_at || '')));

export const BannerCard: React.FC<{ b: Banner; onOpen?: (url: string) => void }> = ({ b, onOpen }) => {
  const { L } = useLang();
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [b.image_url]);

  const clickable = !!b.link_url;
  const body = (
    <>
      <div className="gx-banner__media" style={{ aspectRatio: RATIO_VALUE[b.ratio] || '16 / 9' }}>
        {b.image_url && !failed ? (
          <img
            src={b.image_url}
            alt={b.title || 'Banner'}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            style={{ objectFit: b.fit === 'contain' ? 'contain' : 'cover' }}
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="gx-banner__broken">
            <ImageOff size={18} />
            <span>{L('Gambar tidak bisa dimuat', 'Image could not be loaded')}</span>
          </div>
        )}
        {b.show_text && (b.title || b.caption) && (
          <div className="gx-banner__text">
            {b.title && <strong>{b.title}</strong>}
            {b.caption && <span>{b.caption}</span>}
          </div>
        )}
        {clickable && (
          <span className="gx-banner__go" aria-hidden="true">
            <ExternalLink size={14} />
          </span>
        )}
      </div>
    </>
  );

  const cls = `gx-banner gx-banner--${b.layout} ${b.rounded ? '' : 'gx-banner--square'}`;
  if (!clickable) return <div className={cls}>{body}</div>;
  return (
    <a
      className={`${cls} gx-banner--link`}
      href={b.link_url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        if (onOpen) {
          e.preventDefault();
          onOpen(b.link_url!);
        }
      }}
    >
      {body}
    </a>
  );
};

export const BannerStrip: React.FC<{ banners: Banner[]; slot: BannerSlot; style?: React.CSSProperties }> = ({ banners, slot, style }) => {
  const { L } = useLang();
  const list = useMemo(() => sortBanners(banners.filter((b) => b.is_active && b.slot === slot && b.image_url)), [banners, slot]);
  const [idx, setIdx] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (idx > list.length - 1) setIdx(0);
  }, [list.length, idx]);

  /**
   * Geser otomatis tiap 6 detik. Hitungannya diulang setiap kali slide berpindah,
   * termasuk saat user menekan panah atau menggeser sendiri — supaya banner tidak
   * melompat lagi sedetik setelah disentuh.
   */
  useEffect(() => {
    if (list.length < 2) return;
    const t = window.setTimeout(() => setIdx((i) => (i + 1) % list.length), 6000);
    return () => window.clearTimeout(t);
  }, [list.length, idx]);

  /**
   * Selama geser halus berlangsung, browser terus memicu onScroll dengan posisi
   * di tengah jalan. Tanpa kunci ini, posisi setengah jalan itu dibulatkan balik
   * ke slide sebelumnya dan carousel-nya mental ke slide awal terus.
   */
  const scrollLockRef = useRef(0);
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    scrollLockRef.current = Date.now() + 700;
    el.scrollTo({ left: el.clientWidth * idx, behavior: 'smooth' });
  }, [idx]);

  if (list.length === 0) return null;

  return (
    <section className={`gx-bannerwrap gx-bannerwrap--${slot}`} style={style} aria-label="Banner">
      <div
        className="gx-bannerwrap__track"
        ref={trackRef}
        onScroll={(e) => {
          if (Date.now() < scrollLockRef.current) return;
          const el = e.currentTarget;
          const n = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
          if (n !== idx && n >= 0 && n < list.length) setIdx(n);
        }}
      >
        {list.map((b) => (
          <div className="gx-bannerwrap__slide" key={b.id}>
            <BannerCard b={b} />
          </div>
        ))}
      </div>

      {list.length > 1 && (
        <>
          <button type="button" className="gx-bannerwrap__nav gx-bannerwrap__nav--prev" onClick={() => setIdx((i) => (i - 1 + list.length) % list.length)} aria-label={L('Banner sebelumnya', 'Previous banner')}>
            <ChevronLeft size={16} />
          </button>
          <button type="button" className="gx-bannerwrap__nav gx-bannerwrap__nav--next" onClick={() => setIdx((i) => (i + 1) % list.length)} aria-label={L('Banner berikutnya', 'Next banner')}>
            <ChevronRight size={16} />
          </button>
          <div className="gx-bannerwrap__dots">
            {list.map((b, i) => (
              <button key={b.id} type="button" className={i === idx ? 'is-on' : ''} onClick={() => setIdx(i)} aria-label={`${L('Banner', 'Banner')} ${i + 1}`} />
            ))}
          </div>
        </>
      )}
    </section>
  );
};
