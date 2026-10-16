/* MindCheck service worker
   - Pages (index.html): network-first, so a new deploy shows up on the next visit; falls back to the cached copy offline.
   - Everything else on this origin: cache-first with background refresh.
   Bump VERSION on every release. */
const VERSION = 'mindcheck-v12-2026-10-16';
const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-512-maskable.png'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(VERSION).then(function (c) {
    return Promise.all(CORE.map(function (u) { return c.add(u).catch(function () { return null; }); }));
  }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  var isPage = req.mode === 'navigate' || (req.headers.get('accept') || '').indexOf('text/html') !== -1;
  if (isPage) {
    e.respondWith(
      fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
        .then(function (res) {
          if (res && res.status === 200) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req.url, copy); }); }
          return res;
        })
        .catch(function () {
          return caches.match(req.url)
            .then(function (m) { return m || caches.match('./index.html'); })
            .then(function (m) { return m || caches.match('./'); })
            .then(function (m) { return m || new Response('You are offline and this page has not been saved yet.', { status: 503, headers: { 'Content-Type': 'text/plain' } }); });
        })
    );
    return;
  }

  e.respondWith(
    caches.match(req.url).then(function (cached) {
      var refresh = fetch(req).then(function (res) {
        if (res && res.status === 200) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req.url, copy); }); }
        return res;
      }).catch(function () { return cached || Response.error(); });
      return cached || refresh;
    })
  );
});
