// Rimuove eventuali service worker e cache di versioni precedenti.
// In file esterno (non inline) per rispettare la Content-Security-Policy.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {});
  if (window.caches) caches.keys().then(ks => ks.forEach(k => caches.delete(k))).catch(() => {});
}
