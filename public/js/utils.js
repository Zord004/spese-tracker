/** Neutralizza HTML nei testi inseriti dall'utente. @param {*} s @returns {string} */
export function escapeHtml(s) { return typeof s !== "string" ? "" : s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
/** Formato euro italiano; da 1000 in su arrotonda all'unità. @param {number} n @returns {string} */
export function formatCurrency(n) { return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: Math.abs(n) >= 1000 ? 0 : 2 }).format(n); }
/** @param {string|Date} d @returns {string} chiave YYYY-MM */
export function monthKey(d) {
  // Per le date "YYYY-MM-DD" si estrae direttamente (niente Date = niente slittamenti di fuso:
  // new Date("2026-01-01") è mezzanotte UTC e in fusi a ovest scivolerebbe al mese/anno prima).
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d.slice(0, 7);
  const t = new Date(d); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
}
/** @param {string} k chiave YYYY-MM @returns {string} es. "Gen 2026" */
export function monthLabel(k) { const [y, m] = k.split("-"); return ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"][+m-1] + " " + y; }
/** @param {string} k chiave YYYY-MM @returns {string} es. "Gen" */
export function monthShort(k) { const [, m] = k.split("-"); return ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"][+m-1]; }
/** @param {string|Date} d @param {number} n @returns {Date} */
export function addMonths(d, n) {
  // Attenzione: t.setMonth(t.getMonth()+n) da solo "trabocca" (31 gen + 1 mese
  // darebbe 3 marzo, saltando febbraio). Si azzera al giorno 1, si sposta il
  // mese e poi si riporta il giorno, limitandolo all'ultimo giorno valido.
  const t = new Date(d);
  const day = t.getDate();
  t.setDate(1);
  t.setMonth(t.getMonth() + n);
  const lastDay = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  t.setDate(Math.min(day, lastDay));
  return t;
}
/** @returns {string} data odierna YYYY-MM-DD */
export function todayISO() { return new Date().toISOString().split("T")[0]; }
/** @returns {string} chiave del mese corrente YYYY-MM (locale) */
export function currentMonthKey() { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`; }
/** @returns {number} */
export function currentYear() { return new Date().getFullYear(); }
/** @param {string} d @returns {string} */
export function formatDate(d) {
  const date = new Date(d);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return date.toLocaleDateString("it-IT", { day: "numeric", month: "short" }); // data futura
  if (diffDays === 0) return "Oggi";
  if (diffDays === 1) return "Ieri";
  if (diffDays < 7) return `${diffDays}g fa`;
  return date.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}
/** @param {string} d @returns {string} */
export function formatDateLong(d) { return new Date(d).toLocaleDateString("it-IT"); }
