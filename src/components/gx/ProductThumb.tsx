import React, { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';

/** Foto produk asli dari CDN Shopee. Kalau gagal dimuat, tampil ikon, bukan gambar rusak. */
export const ProductThumb: React.FC<{ src?: string; alt: string }> = ({ src, alt }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) {
    return (
      <span className="gx-thumb gx-thumb--empty" aria-hidden="true">
        <ImageOff size={16} />
      </span>
    );
  }
  return (
    <img
      className="gx-thumb"
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
};

