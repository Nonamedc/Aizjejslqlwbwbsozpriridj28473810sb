const CACHE_NAME = 'arya-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  // Tu peux ajouter d'autres fichiers statiques si tu en as (CSS, images locales…)
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
