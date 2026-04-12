/**
 * Format a number as EUR currency string.
 * @param {number} n
 * @returns {string}
 */
export function formatCurrency(n) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

/**
 * Return a "YYYY-MM" key for a given ISO date string.
 * @param {string} dateStr - ISO date string
 * @returns {string}
 */
export function monthKey(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Human-readable label for a month key ("2025-03" → "Mar 2025").
 * @param {string} key
 * @returns {string}
 */
export function monthLabel(key) {
  const [y, m] = key.split("-");
  const names = [
    "Gen", "Feb", "Mar", "Apr", "Mag", "Giu",
    "Lug", "Ago", "Set", "Ott", "Nov", "Dic",
  ];
  return `${names[+m - 1]} ${y}`;
}

/**
 * Add n months to a date string and return the new Date.
 * @param {string} dateStr
 * @param {number} n
 * @returns {Date}
 */
export function addMonths(dateStr, n) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + n);
  return d;
}

/**
 * Today's date as "YYYY-MM-DD".
 * @returns {string}
 */
export function todayISO() {
  return new Date().toISOString().split("T")[0];
}

/**
 * Current month key.
 * @returns {string}
 */
export function currentMonthKey() {
  return monthKey(new Date().toISOString());
}

/**
 * Format a date string to Italian locale.
 * @param {string} dateStr
 * @returns {string}
 */
export function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("it-IT");
}

/**
 * Generate a short unique ID.
 * @returns {string}
 */
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/**
 * Render a progress bar HTML string.
 * @param {number} ratio - 0..1
 * @param {string} color - CSS color
 * @returns {string}
 */
export function progressBar(ratio, color) {
  const pct = Math.min(ratio * 100, 100);
  return `<div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>`;
}
