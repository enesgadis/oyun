const VERSION = 'primer-v1.0.0-2';
const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/css/style.css',
  '/css/screens.css',
  '/css/case.css',
  '/css/report.css',
  '/css/console.css',
  '/js/app.mjs',
  '/js/api.mjs',
  '/js/audio.mjs',
  '/js/engine.mjs',
  '/js/icons.mjs',
  '/js/sprites.mjs',
  '/js/store.mjs',
  '/js/ui.mjs',
  '/js/screens/onboarding.mjs',
  '/js/screens/home.mjs',
  '/js/screens/library.mjs',
  '/js/screens/career.mjs',
  '/js/screens/profile.mjs',
  '/js/screens/case.mjs',
  '/js/screens/report.mjs',
  '/js/screens/console.mjs',
  '/shared/meta.mjs',
  '/shared/content.mjs',
  '/shared/schema.mjs',
  '/shared/cases/phase1.mjs',
  '/shared/cases/phase2.mjs',
  '/shared/cases/phase3.mjs',
  '/shared/cases/phase4.mjs',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      await Promise.all(
        SHELL.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch((error) => {
            console.warn('[PRIMER SW] önbelleğe alınamadı', url, error.message);
          })
        )
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(VERSION);
          cache.put('/index.html', fresh.clone()).catch(() => {});
          return fresh;
        } catch {
          const cache = await caches.open(VERSION);
          return (await cache.match('/index.html')) || (await cache.match('/')) || new Response('Çevrimdışısın.', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(VERSION);
      const cached = await cache.match(request);
      if (cached) {
        fetch(request)
          .then((fresh) => {
            if (fresh.ok) cache.put(request, fresh.clone()).catch(() => {});
          })
          .catch(() => {});
        return cached;
      }
      try {
        const fresh = await fetch(request);
        if (fresh.ok) cache.put(request, fresh.clone()).catch(() => {});
        return fresh;
      } catch {
        return new Response('Çevrimdışı ve önbellekte yok.', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
      }
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
