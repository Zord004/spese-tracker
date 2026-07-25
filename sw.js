// Service worker v9.3 — App Shell caching.
// Cache-first per gli asset statici, network-only per /api/, fallback offline
// alla shell per la navigazione. Versione nel nome cache = invalidazione pulita.
const CACHE = "spese-v94";
const CORE = [
  "/", "/index.html",
  "/css/styles.css?v=94", "/css/fonts.css",
  "/js/boot.js?v=94", "/js/app.js?v=94",
  "/js/vendor/localforage.min.js",
  "/manifest.json",
  "/fonts/inter-400.woff2", "/fonts/inter-500.woff2", "/fonts/inter-600.woff2",
  "/fonts/libre-franklin-400.woff2", "/fonts/libre-franklin-600.woff2", "/fonts/libre-franklin-700.woff2",
  "/icons/icon-192.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // addAll fallirebbe tutto se un file manca: le aggiungo una a una in modo tollerante
    await Promise.all(CORE.map(u => c.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;         // lascia passare il cross-origin
  if (url.pathname.startsWith("/api/")) return;       // dati: sempre dalla rete, mai in cache

  // Navigazione: prova la rete, in offline ripiega sulla shell in cache
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try { return await fetch(req); }
      catch { return (await caches.match("/index.html")) || (await caches.match("/")) || Response.error(); }
    })());
    return;
  }

  // Asset statici: cache-first, poi rete (e popola la cache)
  e.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res && res.ok && res.type === "basic") { const c = await caches.open(CACHE); c.put(req, res.clone()); }
      return res;
    } catch { return cached || Response.error(); }
  })());
});
