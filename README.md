<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/646d82a8-93fe-406d-a88c-03c381f20ab8

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

---

# GaneMaX.Ai — Pengingat Sesi (Push Notification)

Pengingat dikirim **dari server**, jadi tetap masuk walau tab GaneMaX.Ai sudah ditutup.
Default: **5 menit sebelum sesi**.

## 1. Buat kunci VAPID (sekali saja)

```bash
npx web-push generate-vapid-keys
```

## 2. Isi environment variable di Vercel (Settings → Environment Variables)

| Nama | Isi |
| --- | --- |
| `VAPID_PUBLIC_KEY` | publicKey dari langkah 1 |
| `VAPID_PRIVATE_KEY` | privateKey dari langkah 1 — **jangan dibagikan** |
| `VAPID_SUBJECT` | `mailto:admin@ganemaxbot.my.id` |
| `PUSH_CRON_SECRET` | string acak panjang, mis. hasil `openssl rand -hex 24` |

Kalau `VAPID_*` kosong, fitur mati dengan rapi: tombolnya tidak muncul
dan dashboard menampilkan keterangan "belum dikonfigurasi".

## 3. Pasang cron pemicu (wajib, ini yang mengirim pengingatnya)

Endpoint: `POST` **atau** `GET` ke `https://ganemaxbot.my.id/api/push/dispatch`
dengan salah satu bentuk rahasia:

- header `x-cron-secret: <PUSH_CRON_SECRET>`
- header `Authorization: Bearer <PUSH_CRON_SECRET>`
- query `?secret=<PUSH_CRON_SECRET>`

Pakai layanan cron gratis (mis. cron-job.org / UptimeRobot) dengan jadwal
**tiap 1 menit**. Vercel Cron paket Hobby cuma bisa 1× sehari, jadi tidak cocok
untuk pengingat sesi.

Contoh uji manual:

```bash
curl -X POST https://ganemaxbot.my.id/api/push/dispatch \
  -H "x-cron-secret: RAHASIA_KAMU"
# { "ok": true, "checked": 3, "sent": 1, "dropped": 0, "failed": 0, "cleaned": 1 }
```

## 4. Publish ulang `firestore.rules`

Ada koleksi baru `push_subscriptions`. Buka Firebase Console →
Firestore Database → tab **Rules** → tempel isi `firestore.rules` → **Publish**.

## 5. Dipakai user

Dashboard → tab **Engine** → kartu *Notifikasi* → **Pengingat sesi dari server**
→ tombol **Aktifkan pengingat**, lalu **Kirim uji** untuk memastikan masuk.
Setiap kali user menyetel auto-start, jadwalnya otomatis dikirim ulang ke server.

Catatan: di iPhone, push hanya jalan kalau PWA-nya sudah **di-Add to Home Screen**
(iOS 16.4+). Di Android cukup pakai Chrome.


---

# Banner di Dashboard (diatur dari Admin Panel)

Admin → tab **Banner**. Banner tampil di Beranda semua user.

## Cara pakai
1. Upload gambarnya dulu ke layanan gambar apa pun (Catbox, ImgBB, Cloudinary, atau link langsung Google Drive).
2. Klik **Tambah banner**, tempel link gambarnya. Pratinjau langsung muncul persis seperti yang dilihat user.
3. Atur rasio, posisi, gaya, lalu simpan.

## Ukuran gambar yang pas

| Rasio | Ukuran disarankan | Cocok untuk |
| --- | --- | --- |
| 16:9 | 1280 × 720 px | Banner utama, promo besar |
| 21:9 | 1470 × 630 px | Spanduk lebar |
| 4:1 | 1600 × 400 px | Strip tipis di atas halaman |
| 3:1 | 1500 × 500 px | Pengumuman sedang |
| 1:1 | 900 × 900 px | Poster kotak |

Ukuran file sebaiknya di bawah 500 KB supaya cepat terbuka di HP user.
Gambar yang lebih besar dari saran tetap aman; yang lebih kecil akan terlihat pecah.

## Pengaturan yang tersedia
- **Posisi**: Atas (paling menonjol) · Tengah (bawah kartu sesi) · Bawah (akhir halaman)
- **Gaya**: Lebar penuh · Kartu bayangan · Strip tipis
- **Cara gambar mengisi**: Penuhi bingkai (tepi bisa terpotong) atau Muat seluruhnya (ada ruang kosong)
- **Judul & teks kecil** di atas gambar, bisa dimatikan
- **Link tujuan** saat banner diklik
- **Sudut membulat**, **urutan** (tombol panah), **tayang/nonaktif**

Kalau satu posisi diisi lebih dari satu banner, tampil sebagai carousel yang
bergeser otomatis tiap 6 detik dan bisa digeser manual.

## Setelah deploy
Mulai v14 `firestore.rules` memakai satu aturan wildcard, jadi koleksi baru
(banner, push, dan fitur berikutnya) otomatis ikut — tidak perlu publish rules
lagi setiap ada fitur baru.
Hanya admin yang bisa menambah/mengubah/menghapus banner; user biasa hanya bisa melihat.


---

# Firestore Rules — versi ringkas (v14)

`firestore.rules` sekarang cuma 13 baris, bukan 92. Satu aturan wildcard
menggantikan 13 blok per koleksi yang isinya sama persis:

```
match /{collection}/{docId} {
  allow read: if true;
  allow write: if docId is string && docId.size() > 0 && docId.size() <= 128;
}
```

Keuntungan: koleksi baru (banner, push_subscriptions, dan fitur berikutnya)
otomatis ikut tanpa perlu publish rules lagi tiap kali ada fitur baru.

## Catatan penting soal keamanan

Aturan ini **masih terbuka** — sama seperti sebelumnya, tidak lebih dan tidak
kurang. Siapa pun yang punya `projectId` + `apiKey` (keduanya ada di
`firebase-applet-config.json` dan di `api/lib/firebase.ts`) bisa membaca dan
menulis seluruh koleksi langsung ke Firestore, termasuk `users`,
`shopee_accounts`, dan `shopee_payments`.

Aturannya **tidak bisa** dikunci seperti MaXTrade AI (`allow write: if false`)
selama server GaneMaX masih memakai **Firebase client SDK**
(`firebase/firestore/lite` di `api/lib/storage.ts`). Dengan client SDK, server
tunduk pada rules yang sama seperti browser, jadi mengunci rules akan
mematikan seluruh aplikasi.

### Cara mengunci (kalau mau seperti MaXTrade)
1. Ganti `api/lib/firebase.ts` dan `api/lib/storage.ts` ke **firebase-admin**
   (Admin SDK melewati rules).
2. Buat service account di Firebase Console → Project Settings → Service
   accounts → Generate new private key.
3. Simpan isinya sebagai env var `FIREBASE_SERVICE_ACCOUNT` di Vercel.
4. Baru setelah itu rules bisa jadi:

```
match /{document=**} {
  allow read, write: if false;
}
```

Selama langkah 1–3 belum dilakukan, jangan pakai aturan di atas — semua fitur
akan berhenti bekerja.
