// Service worker — App Shell offline.
//
// Strategia:
//  • codice e stili (JS, CSS, HTML, manifest): RETE PRIMA, con ripiego sulla cache
//    solo se si è offline. Così ogni aggiornamento dell'app arriva subito e,
//    senza rete, l'app si apre comunque dalla cache.
//  • font e icone (non cambiano mai): cache-first.
//  • /api/: mai in cache.
//
// Il server sostituisce il segnaposto con la versione di package.json: a ogni
// release questo file cambia, il browser installa il nuovo service worker e
// "activate" elimina la cache della versione precedente.
const VERSION = "__APP_VERSION__";
const CACHE = "spese-" + VERSION;

// Precache di partenza. Ogni modulo caricato dall'app deve comparire qui
// (lo verifica test/sw.test.js); il resto entra in cache al primo uso.
const CORE = [
  "/", "/index.html", "/manifest.json",
  "/css/styles.css", "/css/fonts.css",
  "/js/errlog.js", "/js/boot.js", "/js/app.js", "/js/catalog.js", "/js/constants.js",
  "/js/layout.js", "/js/models.js", "/js/store.js", "/js/swipe.js", "/js/utils.js",
  "/js/vendor/localforage.min.js",
  "/js/views/analytics.js", "/js/views/forecast.js", "/js/views/form.js", "/js/views/home.js",
  "/js/views/list.js", "/js/views/settings.js", "/js/views/tax-report.js",
  "/fonts/inter-400.woff2", "/fonts/inter-500.woff2", "/fonts/inter-600.woff2",
  "/fonts/libre-franklin-400.woff2", "/fonts/libre-franklin-600.woff2", "/fonts/libre-franklin-700.woff2",
  "/icons/icon-192.svg",
];
const FRESH_FIRST = /\.(?:js|css|html|json)$/;

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // addAll fallirebbe tutto se un file manca: li aggiungo uno a uno in modo tollerante
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

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res && res.ok && res.type === "basic") (await caches.open(CACHE)).put(req, res.clone());
    return res;
  } catch {
    return (await caches.match(req)) || Response.error();
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;         // lascia passare il cross-origin
  if (url.pathname.startsWith("/api/")) return;       // dati: sempre dalla rete, mai in cache

  // Navigazione: rete, e in offline la shell in cache
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok) (await caches.open(CACHE)).put(req, res.clone());
        return res;
      } catch { return (await caches.match("/index.html")) || (await caches.match("/")) || Response.error(); }
    })());
    return;
  }

  // Codice e stili: sempre aggiornati se c'è rete
  if (FRESH_FIRST.test(url.pathname)) { e.respondWith(networkFirst(req)); return; }

  // Font e icone: cache-first
  e.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res && res.ok && res.type === "basic") (await caches.open(CACHE)).put(req, res.clone());
      return res;
    } catch { return Response.error(); }
  })());
});
