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
