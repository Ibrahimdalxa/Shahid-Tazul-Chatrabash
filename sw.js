// sw.js - Service Worker for Mess Meal Hub PWA
// Cache-First strategy for static assets; Network-First for API calls.
const CACHE_NAME = 'mealhub-static-v2';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/config.js',
  './js/supabase-api.js',
  './js/storage.js',
  './js/app.js'
];

// ── Install: pre-cache all static assets ─────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: delete any old cache versions ───────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: Cache-First for local assets, Network-First for API ────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isSupabase = url.hostname.includes('supabase.co');
  const isGoogleFonts = url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com');
  const isCDN = url.hostname.includes('cdn.tailwindcss.com');

  // Supabase API calls: Network-only (never cache, avoid stale data)
  if (isSupabase) return;

  // Cache-First: local assets + Google Fonts + Tailwind CDN
  if (isSameOrigin || isGoogleFonts || isCDN) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        // Not in cache yet — fetch & store
        return fetch(event.request).then(networkResp => {
          if (networkResp && networkResp.status === 200) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, networkResp.clone());
            });
          }
          return networkResp;
        }).catch(() => {
          // Offline fallback for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
    );
  }
});
