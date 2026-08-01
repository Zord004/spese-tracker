/**
 * Calcoli sui movimenti: ammortamenti, ricorrenze, budget, proiezioni, fisco.
 * Funzioni pure e senza dipendenze dal DOM: sono coperte da test/models.test.js.
 * @typedef {import("./types.js").Expense} Expense
 * @typedef {import("./types.js").CategorySlice} CategorySlice
 * @typedef {import("./types.js").BudgetStatus} BudgetStatus
 * @typedef {import("./types.js").Projection} Projection
 * @typedef {import("./types.js").CatBudgets} CatBudgets
 */
import { CATEGORIES, INCOME_CATEGORIES } from "./constants.js";
import { getCat, expenseCategories } from "./catalog.js";
import { monthKey, addMonths, currentMonthKey, currentYear } from "./utils.js";

/** @param {Expense} e @returns {boolean} */
export function isIncome(e) { return e.type === "entrata"; }
/** Un movimento senza `type` è considerato una spesa. @param {Expense} e @returns {boolean} */
export function isExpense(e) { return !e.type || e.type === "spesa"; }

/** Elenca le chiavi mese (YYYY-MM) coperte dall'ammortamento. @param {Expense} e @returns {string[]} */
export function getAmortizationMonths(e) {
  const r = []; const am = Math.max(1, Math.trunc(Number(e.am)) || 1);
  for (let i = 0; i < am; i++) r.push(monthKey(addMonths(e.date, i).toISOString()));
  return r;
}
/** Quota mensile di una spesa rateizzata. @param {Expense} e @returns {number} */
export function monthlyCost(e) { return e.amount / Math.max(1, Math.trunc(Number(e.am)) || 1); }
/** @param {Expense} e @param {string} mk chiave mese YYYY-MM @returns {boolean} */
export function isActiveInMonth(e, mk) { return getAmortizationMonths(e).includes(mk); }
export function amortizationProgress(e) { const mk = currentMonthKey(), m = getAmortizationMonths(e), el = m.filter(x => x <= mk).length; const am = Math.max(1, Math.trunc(Number(e.am)) || 1); return { elapsed: el, total: am, ratio: el / am }; }

/** Costo mensile equivalente di una ricorrenza. @param {Expense} e @returns {number} */
export function recurringMonthlyCost(e) {
  if (!e.recur || e.recur === "Nessuna") return 0;
  if (e.recur === "Giornaliera") return e.amount * 30;
  if (e.recur === "Mensile") return e.amount;
  if (e.recur === "Trimestrale") return e.amount / 3;
  if (e.recur === "Annuale") return e.amount / 12;
  if (typeof e.recur === "string" && e.recur.startsWith("Ogni ")) {
    const n = parseInt(e.recur.replace(/\D/g, "")) || 1;
    return e.amount / Math.max(1, n);
  }
  return 0;
}
/** @param {Expense[]} expenses @returns {number} */
export function totalRecurringMonthly(expenses) {
  return expenses.filter(isExpense).reduce((s, e) => s + recurringMonthlyCost(e), 0);
}
export function recurringExpenses(expenses) { return expenses.filter(e => e.recur && e.recur !== "Nessuna"); }

// Regola UNICA per l'addebito imputato a un mese (niente doppi conteggi):
// - ricorrente → quota mensile, da ogni mese dal mese d'origine in poi
// - ammortizzato → quota nei mesi coperti dall'ammortamento
// - una tantum → importo pieno, solo nel suo mese
/** @param {Expense} e @param {string} mk chiave mese YYYY-MM @returns {number} */
export function monthlyChargeFor(e, mk) {
  if (!isExpense(e)) return 0;
  if (e.recur && e.recur !== "Nessuna") return monthKey(e.date) <= mk ? recurringMonthlyCost(e) : 0;
  return isActiveInMonth(e, mk) ? monthlyCost(e) : 0;
}
/** Spesa totale imputata a un dato mese. @param {Expense[]} expenses @param {string} mk @returns {number} */
export function monthTotal(expenses, mk) {
  return expenses.reduce((s, e) => s + monthlyChargeFor(e, mk), 0);
}

/** @param {Expense[]} expenses @returns {number} */
export function totalAmortizedThisMonth(expenses) {
  const mk = currentMonthKey();
  return expenses.filter(isExpense).reduce((s, e) => {
    if (e.recur && e.recur !== "Nessuna") return s;   // le ricorrenti contano nel loro bucket, non qui
    return isActiveInMonth(e, mk) ? s + monthlyCost(e) : s;
  }, 0);
}
/** @param {Expense[]} expenses @returns {number} */
export function totalSpent(expenses) { return expenses.filter(isExpense).reduce((s, e) => s + e.amount, 0); }
/** @param {Expense[]} expenses @returns {number} */
export function totalIncomeThisMonth(expenses) {
  const mk = currentMonthKey();
  return expenses.filter(isIncome).reduce((s, e) => {
    if (monthKey(e.date) === mk && (!e.recur || e.recur === "Nessuna")) return s + e.amount;
    if (e.recur && e.recur !== "Nessuna") return s + recurringMonthlyCost(e);
    return s;
  }, 0);
}
/** @param {string} id @param {string} [type] */
export function getCategoryById(id, type = "spesa") {
  return getCat(id, type);
}

/** Ripartizione per categoria, derivata dai dati. @param {Expense[]} expenses @returns {CategorySlice[]} */
export function categoryBreakdown(expenses, mk = currentMonthKey()) {
  // Ripartizione per categoria del mese indicato (default: mese corrente),
  // con la stessa regola di "Spesa del mese": quota delle ricorrenti, quota
  // degli ammortamenti e spese una tantum del mese. Le categorie sono derivate
  // dai dati, così supporta anche quelle nuove aggiunte su Notion.
  const map = {};
  expenses.filter(isExpense).forEach(e => {
    const charge = monthlyChargeFor(e, mk);
    if (charge <= 0) return;
    const id = e.cat || "Altro";
    if (!map[id]) { const c = getCat(id, "spesa"); map[id] = { id, color: c.color, icon: c.icon, total: 0, count: 0 }; }
    map[id].total += charge; map[id].count++;
  });
  return Object.values(map).filter(c => c.count > 0).sort((a, b) => b.total - a.total);
}

/** @param {Expense[]} expenses @returns {{fixedMonthly:number, variableMonthly:number}} */
export function fixedVsVariable(expenses) {
  const mk = currentMonthKey();
  const exps = expenses.filter(isExpense);
  const fixed = exps.filter(e => e.nature === "fisso");
  const variable = exps.filter(e => e.nature !== "fisso");
  const calc = arr => arr.reduce((s, e) => {
    const recur = recurringMonthlyCost(e);
    const amort = isActiveInMonth(e, mk) ? monthlyCost(e) : 0;
    return s + Math.max(recur, amort);
  }, 0);
  return { fixedMonthly: calc(fixed), variableMonthly: calc(variable) };
}

/** @param {number} income @param {number} monthlyExpenses @returns {number} percentuale 0-100 */
export function savingsRate(income, monthlyExpenses) {
  if (income <= 0) return 0;
  return Math.max(0, ((income - monthlyExpenses) / income) * 100);
}

/** @param {Expense} e @returns {number|null} null se non ci sono utilizzi */
export function costPerUse(e) {
  const uses = Math.trunc(Number(e.utilizzi)) || 0;
  if (uses <= 0) return null;
  return e.amount / uses;
}

/** Report per il commercialista (730/Unico). @param {Expense[]} expenses @param {number} [year] */
export function taxReport(expenses, year = currentYear()) {
  const yearDeductible = expenses.filter(e => isExpense(e) && e.detraibile && new Date(e.date).getFullYear() === year);
  const byCategory = {};
  let totalDeductibleSpent = 0, totalDeduction = 0;
  yearDeductible.forEach(e => {
    const pct = Number(e.detrazionePct) || 0;
    const deduction = e.amount * (pct / 100);
    if (!byCategory[e.cat]) byCategory[e.cat] = { category: e.cat, count: 0, spent: 0, deduction: 0, items: [] };
    byCategory[e.cat].count++; byCategory[e.cat].spent += e.amount;
    byCategory[e.cat].deduction += deduction;
    byCategory[e.cat].items.push({ ...e, deduction });
    totalDeductibleSpent += e.amount; totalDeduction += deduction;
  });
  const allExpenses = expenses.filter(e => isExpense(e) && new Date(e.date).getFullYear() === year);
  const allByCategory = {};
  let totalAllSpent = 0;
  allExpenses.forEach(e => {
    if (!allByCategory[e.cat]) allByCategory[e.cat] = { category: e.cat, count: 0, spent: 0, items: [] };
    allByCategory[e.cat].count++; allByCategory[e.cat].spent += e.amount;
    allByCategory[e.cat].items.push(e); totalAllSpent += e.amount;
  });
  const incomeYear = expenses.filter(e => isIncome(e) && new Date(e.date).getFullYear() === year);
  const totalIncome = incomeYear.reduce((s, e) => s + e.amount, 0);
  return {
    year,
    totalSpent: totalDeductibleSpent, totalDeduction,
    byCategory: Object.values(byCategory).sort((a, b) => b.deduction - a.deduction),
    items: yearDeductible,
    totalAllSpent,
    allByCategory: Object.values(allByCategory).sort((a, b) => b.spent - a.spent),
    allExpenses,
    totalIncome, incomeItems: incomeYear,
    balance: totalIncome - totalAllSpent,
  };
}

export function amortizationTimeline(expenses) { const m = {}; expenses.filter(isExpense).forEach(e => { const am = Math.trunc(Number(e.am)) || 1; if (am <= 1) return; getAmortizationMonths(e).forEach(mk => { m[mk] = (m[mk] || 0) + monthlyCost(e); }); }); return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0])); }
export function activeAmortizations(expenses) { const mk = currentMonthKey(); return expenses.filter(e => isExpense(e) && (Math.trunc(Number(e.am)) || 1) > 1 && isActiveInMonth(e, mk)); }
/** @param {Expense[]} expenses @param {number} [n] */
export function monthlySpendingTrend(expenses, n = 6) { const now = new Date(), months = []; for (let i = n - 1; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push(monthKey(d.toISOString())); } return months.map(mk => ({ mk, total: monthTotal(expenses, mk) })); }
/** @param {Expense[]} expenses @returns {{current:number, previous:number, diff:number}} */
export function monthComparison(expenses) { const now = new Date(), cur = currentMonthKey(), prev = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()); const c = monthTotal(expenses, cur), p = monthTotal(expenses, prev); return { current: c, previous: p, diff: c - p }; }
export function averageMonthlySpending(expenses, n = 6) { const t = monthlySpendingTrend(expenses, n); return t.reduce((s, m) => s + m.total, 0) / n; }
/** @param {Expense[]} expenses @param {number} [n] @returns {Expense[]} */
export function topExpenses(expenses, n = 5) { return [...expenses.filter(isExpense)].sort((a, b) => b.amount - a.amount).slice(0, n); }
/** @param {Expense[]} expenses */
export function locationBreakdown(expenses) { const map = {}; expenses.filter(isExpense).forEach(e => { if (!e.location) return; const k = e.location.toLowerCase().trim(); if (!map[k]) map[k] = { location: e.location, total: 0, count: 0 }; map[k].total += e.amount; map[k].count++; }); return Object.values(map).sort((a, b) => b.total - a.total); }

// Spesa variabile effettiva del mese corrente (per la barra budget)
/** @param {Expense[]} expenses @returns {number} */
export function variableSpentThisMonth(expenses) {
  const mk = currentMonthKey();
  return expenses.filter(e => isExpense(e) && e.nature !== "fisso").reduce((s, e) => {
    const recur = recurringMonthlyCost(e);
    if (recur > 0) return s + recur;
    return monthKey(e.date) === mk ? s + e.amount : s;
  }, 0);
}

// Stato dei budget per categoria nel mese corrente.
// `budgets` è una mappa { categoria: tetto }. Restituisce solo le categorie
// con un tetto impostato, ordinate dalla più critica alla più tranquilla.
/** @param {Expense[]} expenses @param {CatBudgets} [budgets] @returns {BudgetStatus[]} */
export function categoryBudgetStatus(expenses, budgets = {}) {
  const mk = currentMonthKey();
  const spentByCat = {};
  expenses.filter(isExpense).forEach(e => {
    const id = e.cat || "Altro";
    const recur = recurringMonthlyCost(e);
    const amount = recur > 0 ? recur : (monthKey(e.date) === mk ? e.amount : 0);
    if (amount > 0) spentByCat[id] = (spentByCat[id] || 0) + amount;
  });
  return Object.entries(budgets)
    .filter(([, limit]) => limit > 0)
    .map(([id, limit]) => {
      const spent = spentByCat[id] || 0;
      const ratio = spent / limit;
      const pct = ratio * 100;
      const state = /** @type {"ok"|"warn"|"over"} */ (ratio > 1 ? "over" : ratio >= 0.85 ? "warn" : "ok");
      const cat = getCat(id, "spesa");
      return { id, color: cat.color, spent, limit, ratio: Math.min(1, ratio), pct, state, remaining: limit - spent };
    })
    .sort((a, b) => b.pct - a.pct);
}

// Proiezione del saldo a fine mese: prende quanto già speso/incassato nel mese
// e aggiunge le ricorrenti/fisse che devono ancora scattare.
/** @param {Expense[]} expenses @param {number} [fixedIncome] @returns {Projection} */
export function balanceProjection(expenses, fixedIncome = 0) {
  const mk = currentMonthKey();
  const incomeEntries = expenses.filter(e => isIncome(e) && monthKey(e.date) === mk).reduce((s, e) => s + e.amount, 0);
  const incomeExpected = fixedIncome + incomeEntries;
  const spentSoFar = expenses.filter(e => isExpense(e) && monthKey(e.date) === mk).reduce((s, e) => s + e.amount, 0);
  // Ricorrenti che colpiranno ancora questo mese (la cui riga origine non è di questo mese)
  const upcoming = expenses.filter(e => isExpense(e) && e.recur && e.recur !== "Nessuna" && monthKey(e.date) !== mk)
    .reduce((s, e) => s + recurringMonthlyCost(e), 0);
  const projectedExpenses = spentSoFar + upcoming;
  return { incomeExpected, spentSoFar, upcoming, projectedExpenses, projectedBalance: incomeExpected - projectedExpenses };
}
/** @param {Expense[]} expenses @param {number} [fixedIncome] @param {number} [n] */
export function savingsRateTrend(expenses, fixedIncome = 0, n = 6) {
  const now = new Date();
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mk = monthKey(d.toISOString());
    const spent = expenses.filter(e => isExpense(e) && monthKey(e.date) === mk).reduce((s, e) => s + e.amount, 0);
    const incomeEntries = expenses.filter(e => isIncome(e) && monthKey(e.date) === mk).reduce((s, e) => s + e.amount, 0);
    const income = fixedIncome + incomeEntries;
    const rate = income > 0 ? Math.max(0, Math.min(100, ((income - spent) / income) * 100)) : null;
    out.push({ mk, rate, income, spent });
  }
  return out;
}
