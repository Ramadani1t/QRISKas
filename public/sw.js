const CACHE_NAME = 'qriskas-v4';
const ASSETS_TO_CACHE = [
  '/',
  '/style.css',
  '/history.css',
  '/app.js',
  '/manifest.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Don't intercept API or authentication requests
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/login') || event.request.method !== 'GET') {
    return;
  }
  // Network-first strategy: ambil versi terbaru dari server jika online, fallback ke cache jika offline
  event.respondWith(
    fetch(event.request).then(response => {
      if (response && response.status === 200) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => {
      return caches.match(event.request).then(cached => cached || caches.match('/'));
    })
  );
});
