/* GaneMaX.Ai service worker — app shell cache + offline fallback.
   Versi dinaikkan tiap rilis supaya cache lama dibuang. */
const CACHE = 'ganemax-v8';
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

/* ------------------------------------------------------------------ */
/* Push: pengingat sesi tetap masuk walau aplikasi ditutup            */
/* ------------------------------------------------------------------ */
self.addEventListener('push', (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch (_) {
    d = { title: 'GaneMaX.Ai', body: e.data ? e.data.text() : '' };
  }
  const title = d.title || 'GaneMaX.Ai';
  e.waitUntil(
    self.registration.showNotification(title, {
      body: d.body || '',
      tag: d.tag || 'ganemax',
      renotify: true,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [120, 60, 120, 60, 240],
      requireInteraction: true,
      data: { url: d.url || '/app/' },
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || '/app/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes('/app') && 'focus' in c) return c.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
