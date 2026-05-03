// The Card — Service Worker
// Bump CACHE_VERSION whenever you deploy a significant update
// so users get fresh assets on next visit.
const CACHE_VERSION = 'the-card-v1';

// Shell assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/logo_icon.png',
  '/logo_lockup.png',
];

// ── Install: pre-cache shell ──────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: delete old caches ───────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_VERSION)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for app shell, network-only for API ────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never cache Anthropic API calls — always go to network
  if (url.hostname === 'api.anthropic.com') {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first strategy: serve from cache, fall back to network and cache result
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // Only cache successful same-origin or CORS responses
        if (
          response.ok &&
          (url.origin === self.location.origin || response.type === 'cors')
        ) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
