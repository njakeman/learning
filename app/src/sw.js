/* Tabella service worker — VERSION and PRECACHE are injected by app/build.mjs */
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;

// Last-resort reply if even offline.html has been evicted: never a blank page.
const FALLBACK =
  '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1">' +
  '<title>Tabella — offline</title></head>' +
  '<body style="font-family:Georgia,serif;background:#f5eeda;color:#3a2f22;text-align:center;padding:4rem 1.5rem">' +
  '<h1 style="letter-spacing:.2em">TABELLA</h1>' +
  '<p>You are offline and the library cache has been cleared.</p>' +
  '<p>Reconnect to the internet, then reopen Tabella to fetch the library afresh.</p></body></html>';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(PRECACHE)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith('tabella-') && key !== VERSION) await caches.delete(key);
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    (async () => {
      const cache = await caches.open(VERSION);
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      try {
        const res = await fetch(req);
        // self-heal after partial eviction
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch (err) {
        if (req.mode === 'navigate') {
          const off = await cache.match('./offline.html');
          return (
            off || new Response(FALLBACK, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
          );
        }
        throw err;
      }
    })()
  );
});
