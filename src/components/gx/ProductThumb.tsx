import React, { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';

/**
 * Foto produk asli dari CDN Shopee.
 *
 * Kalau CDN menolak dibuka langsung dari halaman app (hotlink), gambar dicoba
 * sekali lagi lewat server GaneMaX. Baru setelah itu menyerah dan menampilkan
 * ikon — bukan gambar rusak, dan tidak pernah gambar pengganti yang palsu.
 */
export const ProductThumb: React.FC<{ src?: string; alt: string; size?: number }> = ({ src, alt, size }) => {
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  useEffect(() => setStage(0), [src]);

  if (!src || stage === 2) {
    return (
      <span className="gx-thumb gx-thumb--empty" aria-hidden="true" style={size ? { width: size, height: size } : undefined}>
        <ImageOff size={16} />
      </span>
    );
  }
  const href = stage === 0 ? src : `/api/img?u=${encodeURIComponent(src)}`;
  return (
    <img
      className="gx-thumb"
      style={size ? { width: size, height: size } : undefined}
      src={href}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setStage((v) => (v === 0 ? 1 : 2))}
    />
  );
};
