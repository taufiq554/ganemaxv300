/* GaneMaX.Ai service worker — app shell cache + offline fallback.
   Versi dinaikkan tiap rilis supaya cache lama dibuang. */
const CACHE = 'ganemax-v7';
const SHELL = ['/app/', '/ganemax-logo.jpg', '/icon-192.png', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Jangan pernah cache API, biar data selalu fresh
  if (url.pathname.startsWith('/api/')) return;

  // Navigasi: network dulu, fallback ke shell saat offline
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() => caches.match('/app/').then((r) => r || caches.match(req)))
    );
    return;
  }
  // Aset statis: cache dulu, lalu jaringan
  e.respondWith(
    caches.match(req).then((cached) => {
      const net = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || net;
    })
  );
});
