/* ═══════════════════════════════════════════
   ARYA — Service Worker PWA
   Cache strategy: App Shell (Cache First)
   + réseau pour les données externes (archive JSON, covers iTunes)
═══════════════════════════════════════════ */

const CACHE_NAME = 'arya-v1';
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  // Google Fonts (mise en cache à la demande)
];

/* ── INSTALL : précharger le shell ── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(SHELL_ASSETS).catch(err => {
        console.warn('[Arya SW] Certains assets non cachés:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

/* ── ACTIVATE : purger les vieux caches ── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── FETCH : stratégie par type de requête ── */
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // 1. Archive JSON & API iTunes → réseau en priorité, cache en fallback
  if (
    url.hostname === 'raw.githubusercontent.com' ||
    url.hostname.includes('itunes.apple.com') ||
    url.hostname.includes('is1-ssl.mzstatic.com') ||
    url.hostname.includes('is2-ssl.mzstatic.com') ||
    url.hostname.includes('is3-ssl.mzstatic.com') ||
    url.hostname.includes('is4-ssl.mzstatic.com') ||
    url.hostname.includes('is5-ssl.mzstatic.com')
  ) {
    e.respondWith(networkFirstWithCache(e.request));
    return;
  }

  // 2. Fonts Google → cache en priorité
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(cacheFirstWithNetwork(e.request));
    return;
  }

  // 3. App shell (même origine) → cache en priorité
  if (url.origin === self.location.origin) {
    e.respondWith(cacheFirstWithNetwork(e.request));
    return;
  }

  // 4. Reste → réseau simple
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});

/* ── HELPERS ── */

async function cacheFirstWithNetwork(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    return new Response('Hors ligne — ressource non disponible', { status: 503 });
  }
}

async function networkFirstWithCache(req) {
  try {
    const res = await fetch(req);
    if (res && res.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'Hors ligne' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/* ── MESSAGE : force update depuis l'app ── */
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
