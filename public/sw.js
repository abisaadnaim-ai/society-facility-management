/* Society FM service worker.
   Strategy: network-first for navigations (so staff never see a stale operational
   UI), cache-first for Next.js hashed static assets (safe: content-addressed),
   and an offline fallback page. Supabase and all cross-origin requests are never
   handled here, so live auth/data always go straight to the network. */
const VERSION = "society-fm-v1";
const STATIC_CACHE = `static-${VERSION}`;
const PRECACHE = ["/offline.html", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Let the page trigger an immediate activation of a new SW.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Only handle same-origin GETs; Supabase/API/cross-origin pass straight through.
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first, fall back to offline page.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("/offline.html"))
    );
    return;
  }

  // Hashed static assets: cache-first (immutable, content-addressed).
  if (url.pathname.startsWith("/_next/static/") || PRECACHE.includes(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) =>
        cached ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
          return res;
        })
      )
    );
    return;
  }
  // Everything else same-origin: just go to the network.
});
