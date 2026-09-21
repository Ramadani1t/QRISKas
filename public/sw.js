const CACHE_NAME = 'qriskas-v1';
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
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Revalidate cache in background if online
        fetch(event.request).then(resp => {
          if (resp && resp.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, resp));
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(event.request).catch(() => caches.match('/'));
    })
  );
});
