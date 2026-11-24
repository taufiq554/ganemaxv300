import React, { useEffect, useState } from 'react';
import { Smartphone, X } from 'lucide-react';
import { useLang } from '../../lib/i18n.tsx';

const KEY = 'gx_reinstall_v22';

/**
 * Pemberitahuan sekali jalan untuk pemakai yang app-nya sudah dipasang di layar
 * utama sebelum v22.
 *
 * Alasannya: Android menyalin warna & ikon aplikasi (dari manifest) HANYA saat
 * aplikasi pertama kali dipasang. Jadi walaupun servernya sudah memakai warna
 * baru, pita biru di bawah layar dan ikon lama tetap terbawa sampai aplikasi
 * dipasang ulang — bukan sesuatu yang bisa diperbaiki dari sisi web.
 *
 * Hanya muncul di aplikasi terpasang (standalone) di Android, dan bisa ditutup.
 */
export const ReinstallNotice: React.FC = () => {
  const { L } = useLang();
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY)) return;
    } catch {
      return;
    }
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
    const android = /Android/i.test(navigator.userAgent);
    if (standalone && android) setShow(true);
  }, []);

  const close = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {}
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="gx-card gx-reinstall" role="note" style={{ order: 0 }}>
      <span className="gx-reinstall__icon">
        <Smartphone size={18} />
      </span>
      <div>
        <b>{L('Pita biru di bawah layar & ikon lama', 'Blue band at the bottom & old icon')}</b>
        <p>
          {L(
            'Android mengunci warna dan ikon aplikasi sejak pertama kali dipasang, jadi update dari web tidak bisa menggantinya. Hapus ikon GaneMaX dari layar utama, buka ganemaxbot.my.id/app di Chrome, lalu "Tambah ke layar utama" lagi. Datamu tidak hilang.',
            'Android locks the app colour and icon from the moment it was installed, so a web update cannot change them. Remove the GaneMaX icon from your home screen, open ganemaxbot.my.id/app in Chrome, then "Add to home screen" again. Your data stays.'
          )}
        </p>
      </div>
      <button type="button" className="gx-iconbtn" onClick={close} aria-label={L('Tutup', 'Dismiss')}>
        <X size={15} />
      </button>
    </div>
  );
};
