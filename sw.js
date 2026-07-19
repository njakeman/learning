/* Tabella service worker — VERSION and PRECACHE are injected by app/build.mjs */
const VERSION = 'tabella-9d7670347870';
const PRECACHE = [
 "./",
 "./assets/app.js",
 "./assets/fonts/cinzel-400.woff2",
 "./assets/fonts/cinzel-600.woff2",
 "./assets/fonts/eb-garamond-400.woff2",
 "./assets/fonts/eb-garamond-500.woff2",
 "./assets/fonts/eb-garamond-600.woff2",
 "./assets/fonts/eb-garamond-italic-400.woff2",
 "./assets/fonts/eb-garamond-italic-500.woff2",
 "./assets/fonts/noto-sans-ogham.woff2",
 "./assets/fonts/noto-sans-runic.woff2",
 "./assets/search.js",
 "./assets/styles.css",
 "./docs/creta-chalk-book.html",
 "./docs/familia-britannica-reader.html",
 "./docs/herbarium-downland-week.html",
 "./docs/latin-exercitia1-case-forge.html",
 "./docs/latin-learning-preferences.html",
 "./docs/latin-vol0-english-cases.html",
 "./docs/latin-vol0-reading-the-marks.html",
 "./docs/latin-vol0a-tricks-of-the-ear.html",
 "./docs/latin-vol0b-time-in-plain-english.html",
 "./docs/latin-vol1-cases.html",
 "./docs/latin-vol10-subjunctive.html",
 "./docs/latin-vol2-declensions.html",
 "./docs/latin-vol3-adjectives.html",
 "./docs/latin-vol3a-demonstratives.html",
 "./docs/latin-vol3b-possessives.html",
 "./docs/latin-vol3c-ambiguity.html",
 "./docs/latin-vol4-verbs.html",
 "./docs/latin-vol4a-complementary-infinitives.html",
 "./docs/latin-vol4b-word-hoard.html",
 "./docs/latin-vol5-stone-latin.html",
 "./docs/latin-vol6-curse-tablets.html",
 "./docs/latin-vol6a-charm-craft.html",
 "./docs/latin-vol7-verb-workshop.html",
 "./docs/latin-vol7a-druids.html",
 "./docs/latin-vol8-time-machine.html",
 "./docs/latin-vol9-reported-world.html",
 "./docs/lectio-1-vindolanda.html",
 "./docs/lectio-aurora.html",
 "./docs/lectio2-ring-of-senicianus.html",
 "./docs/nox-night-book.html",
 "./drills.html",
 "./icons/apple-touch-icon.png",
 "./icons/favicon.png",
 "./icons/icon-192.png",
 "./icons/icon-512-maskable.png",
 "./icons/icon-512.png",
 "./index.html",
 "./manifest.webmanifest",
 "./offline.html",
 "./search-index.json"
];

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
