// Service Worker — تدبر
// (1) إشعارات Push يومية   (2) العمل بدون إنترنت Offline

const CACHE_VERSION = 'tadabbor-v2';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const QURAN_CACHE   = `${CACHE_VERSION}-quran`;
const AUDIO_CACHE   = `${CACHE_VERSION}-audio`;

const PRECACHE_URLS = [
  '/', '/quran', '/favorites', '/settings',
  '/manifest.webmanifest', '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await Promise.all(PRECACHE_URLS.map((u) => cache.add(u).catch(() => null)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

function isQuranApi(url) {
  return url.hostname === 'api.alquran.cloud' || url.hostname === 'api.quran-tafseer.com';
}
function isAudio(url) {
  return url.hostname === 'cdn.islamic.network' || url.hostname === 'everyayah.com' || /\.mp3($|\?)/i.test(url.pathname);
}
function isStaticAsset(url) {
  return /\.(?:js|mjs|css|woff2?|ttf|otf|png|jpg|jpeg|svg|webp|ico)($|\?)/i.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!url.protocol.startsWith('http')) return;
  // لا تعترض Supabase ولا server functions
  if (url.hostname.includes('supabase.co')) return;
  if (url.pathname.startsWith('/_serverFn') || url.pathname.startsWith('/api/')) return;

  if (isQuranApi(url))    { event.respondWith(cacheFirst(req, QURAN_CACHE)); return; }
  if (isAudio(url))       { event.respondWith(cacheFirst(req, AUDIO_CACHE)); return; }

  if (req.mode === 'navigate') { event.respondWith(networkFirstNav(req)); return; }
  if (isStaticAsset(url) || url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(req, RUNTIME_CACHE));
  }
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.status === 200) cache.put(req, res.clone()).catch(() => {});
    return res;
  } catch {
    return cached || new Response(JSON.stringify({ offline: true }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req).then((res) => {
    if (res && res.status === 200) cache.put(req, res.clone()).catch(() => {});
    return res;
  }).catch(() => cached);
  return cached || fetchPromise;
}

async function networkFirstNav(req) {
  try {
    const res = await fetch(req);
    const cache = await caches.open(STATIC_CACHE);
    if (res && res.status === 200) cache.put(req, res.clone()).catch(() => {});
    return res;
  } catch {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(req) || await cache.match('/');
    return cached || new Response('<h1 style="font-family:sans-serif;text-align:center;padding:40px">غير متصل</h1>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}

// ============ PUSH NOTIFICATIONS ============
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch { data = { title: 'تدبر', body: event.data ? event.data.text() : '' }; }

  const title = data.title || 'تدبر — آية اليوم';
  const options = {
    body: data.body || '',
    icon: '/icon-512.png',
    badge: '/icon-512.png',
    dir: 'rtl',
    lang: 'ar',
    tag: 'tadabbor-daily',
    renotify: true,
    data: { url: data.url || '/' },
    vibrate: [100, 50, 100],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) {
      if ('focus' in c) { try { c.navigate(url); } catch {} return c.focus(); }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});
