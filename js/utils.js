export function escapeHtml(s) { return typeof s !== "string" ? "" : s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
export function formatCurrency(n) { return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: Math.abs(n) >= 1000 ? 0 : 2 }).format(n); }
export function formatCurrencyFull(n) { return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n); }
export function monthKey(d) { const t = new Date(d); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`; }
export function monthLabel(k) { const [y, m] = k.split("-"); return ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"][+m-1] + " " + y; }
export function monthShort(k) { const [, m] = k.split("-"); return ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"][+m-1]; }
export function addMonths(d, n) { const t = new Date(d); t.setMonth(t.getMonth() + n); return t; }
export function todayISO() { return new Date().toISOString().split("T")[0]; }
export function currentMonthKey() { return monthKey(new Date().toISOString()); }
export function currentYear() { return new Date().getFullYear(); }
export function formatDate(d) {
  const date = new Date(d);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Oggi";
  if (diffDays === 1) return "Ieri";
  if (diffDays < 7) return `${diffDays}g fa`;
  return date.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}
export function formatDateLong(d) { return new Date(d).toLocaleDateString("it-IT"); }
