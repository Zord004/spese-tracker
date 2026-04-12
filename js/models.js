import { CATEGORIES } from "./constants.js";
import { monthKey, addMonths, currentMonthKey } from "./utils.js";

/**
 * Return all month-keys covered by an expense's amortization period.
 * @param {object} expense
 * @returns {string[]}
 */
export function getAmortizationMonths(expense) {
  const months = [];
  const duration = expense.am || 1;
  for (let i = 0; i < duration; i++) {
    months.push(monthKey(addMonths(expense.date, i).toISOString()));
  }
  return months;
}

/**
 * Monthly amortized cost of a single expense.
 * @param {object} expense
 * @returns {number}
 */
export function monthlyCost(expense) {
  return expense.amount / (expense.am || 1);
}

/**
 * Check whether an expense is amortized in a given month.
 * @param {object} expense
 * @param {string} mk - month key "YYYY-MM"
 * @returns {boolean}
 */
export function isActiveInMonth(expense, mk) {
  return getAmortizationMonths(expense).includes(mk);
}

/**
 * Amortization progress for an expense: how many months elapsed vs total.
 * @param {object} expense
 * @returns {{ elapsed: number, total: number, ratio: number }}
 */
export function amortizationProgress(expense) {
  const mk = currentMonthKey();
  const months = getAmortizationMonths(expense);
  const elapsed = months.filter((m) => m <= mk).length;
  const total = expense.am || 1;
  return { elapsed, total, ratio: elapsed / total };
}

// ── Aggregations ──

/**
 * Total amortized cost for the current month across all expenses.
 * @param {Array} expenses
 * @returns {number}
 */
export function totalAmortizedThisMonth(expenses) {
  const mk = currentMonthKey();
  return expenses.reduce((sum, e) => {
    return isActiveInMonth(e, mk) ? sum + monthlyCost(e) : sum;
  }, 0);
}

/**
 * Total amount spent (sum of all expenses, not amortized).
 * @param {Array} expenses
 * @returns {number}
 */
export function totalSpent(expenses) {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

/**
 * Breakdown by category: total, monthly amort cost, count.
 * Sorted by total descending, empty categories excluded.
 * @param {Array} expenses
 * @returns {Array}
 */
export function categoryBreakdown(expenses) {
  const mk = currentMonthKey();
  return CATEGORIES.map((cat) => {
    const items = expenses.filter((e) => e.cat === cat.id);
    const total = items.reduce((s, e) => s + e.amount, 0);
    const amortMonth = items.reduce((s, e) => {
      return isActiveInMonth(e, mk) ? s + monthlyCost(e) : s;
    }, 0);
    return { ...cat, total, amortMonth, count: items.length };
  })
    .filter((c) => c.count > 0)
    .sort((a, b) => b.total - a.total);
}

/**
 * Monthly amortization timeline: { "YYYY-MM": totalCost } for all months.
 * Only includes expenses with am > 1.
 * @param {Array} expenses
 * @returns {Array<[string, number]>} sorted entries
 */
export function amortizationTimeline(expenses) {
  const map = {};
  expenses.forEach((e) => {
    if ((e.am || 1) <= 1) return;
    getAmortizationMonths(e).forEach((mk) => {
      map[mk] = (map[mk] || 0) + monthlyCost(e);
    });
  });
  return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
}

/**
 * Expenses with active amortization this month.
 * @param {Array} expenses
 * @returns {Array}
 */
export function activeAmortizations(expenses) {
  const mk = currentMonthKey();
  return expenses.filter((e) => (e.am || 1) > 1 && isActiveInMonth(e, mk));
}

/**
 * Lookup a category object by id.
 * @param {string} id
 * @returns {object}
 */
export function getCategoryById(id) {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
}
