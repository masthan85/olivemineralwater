/* OLIVE service worker.
   Served from /?olive_sw=1 so it controls the whole site.
   Pages and the shop always come from the network, so prices, baskets and accounts
   are never stale. The only thing it stores is a small offline page, shown when a
   page can't load because the phone has no connection. */

const CACHE = 'olive-offline-v1';
const OFFLINE_URL = '/?olive_offline=1';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE_URL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate' || event.request.method !== 'GET') {
    return;
  }
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
});
