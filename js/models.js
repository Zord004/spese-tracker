import { CATEGORIES, INCOME_CATEGORIES } from "./constants.js";
import { getCat, expenseCategories } from "./catalog.js";
import { monthKey, addMonths, currentMonthKey, currentYear } from "./utils.js";

export function isIncome(e) { return e.type === "entrata"; }
export function isExpense(e) { return !e.type || e.type === "spesa"; }

export function getAmortizationMonths(e) {
  const r = []; const am = Math.max(1, parseInt(e.am) || 1);
  for (let i = 0; i < am; i++) r.push(monthKey(addMonths(e.date, i).toISOString()));
  return r;
}
export function monthlyCost(e) { return e.amount / Math.max(1, parseInt(e.am) || 1); }
export function isActiveInMonth(e, mk) { return getAmortizationMonths(e).includes(mk); }
export function amortizationProgress(e) { const mk = currentMonthKey(), m = getAmortizationMonths(e), el = m.filter(x => x <= mk).length; const am = Math.max(1, parseInt(e.am) || 1); return { elapsed: el, total: am, ratio: el / am }; }

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
export function totalRecurringMonthly(expenses) {
  return expenses.filter(isExpense).reduce((s, e) => s + recurringMonthlyCost(e), 0);
}
export function recurringExpenses(expenses) { return expenses.filter(e => e.recur && e.recur !== "Nessuna"); }

export function totalAmortizedThisMonth(expenses) {
  const mk = currentMonthKey();
  return expenses.filter(isExpense).reduce((s, e) => isActiveInMonth(e, mk) ? s + monthlyCost(e) : s, 0);
}
export function totalSpent(expenses) { return expenses.filter(isExpense).reduce((s, e) => s + e.amount, 0); }
export function totalIncomeThisMonth(expenses) {
  const mk = currentMonthKey();
  return expenses.filter(isIncome).reduce((s, e) => {
    if (monthKey(e.date) === mk && (!e.recur || e.recur === "Nessuna")) return s + e.amount;
    if (e.recur && e.recur !== "Nessuna") return s + recurringMonthlyCost(e);
    return s;
  }, 0);
}
export function getCategoryById(id, type = "spesa") {
  return getCat(id, type);
}

export function categoryBreakdown(expenses) {
  // Deriva le categorie dai dati stessi: supporta anche categorie nuove
  // aggiunte su Notion senza doverle elencare nel codice.
  const map = {};
  expenses.filter(isExpense).forEach(e => {
    const id = e.cat || "Altro";
    if (!map[id]) { const c = getCat(id, "spesa"); map[id] = { id, color: c.color, icon: c.icon, total: 0, count: 0 }; }
    map[id].total += e.amount; map[id].count++;
  });
  return Object.values(map).filter(c => c.count > 0).sort((a, b) => b.total - a.total);
}

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

export function savingsRate(income, monthlyExpenses) {
  if (income <= 0) return 0;
  return Math.max(0, ((income - monthlyExpenses) / income) * 100);
}

export function costPerUse(e) {
  const uses = parseInt(e.utilizzi) || 0;
  if (uses <= 0) return null;
  return e.amount / uses;
}

export function taxReport(expenses, year = currentYear()) {
  const yearDeductible = expenses.filter(e => isExpense(e) && e.detraibile && new Date(e.date).getFullYear() === year);
  const byCategory = {};
  let totalDeductibleSpent = 0, totalDeduction = 0;
  yearDeductible.forEach(e => {
    const pct = parseFloat(e.detrazionePct) || 0;
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

export function amortizationTimeline(expenses) { const m = {}; expenses.filter(isExpense).forEach(e => { const am = parseInt(e.am) || 1; if (am <= 1) return; getAmortizationMonths(e).forEach(mk => { m[mk] = (m[mk] || 0) + monthlyCost(e); }); }); return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0])); }
export function activeAmortizations(expenses) { const mk = currentMonthKey(); return expenses.filter(e => isExpense(e) && (parseInt(e.am) || 1) > 1 && isActiveInMonth(e, mk)); }
export function monthlySpendingTrend(expenses, n = 6) { const now = new Date(), months = []; for (let i = n - 1; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push(monthKey(d.toISOString())); } return months.map(mk => ({ mk, total: expenses.filter(e => isExpense(e) && monthKey(e.date) === mk).reduce((s, e) => s + e.amount, 0) })); }
export function monthComparison(expenses) { const now = new Date(), cur = monthKey(now.toISOString()), prev = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()); const c = expenses.filter(e => isExpense(e) && monthKey(e.date) === cur).reduce((s, e) => s + e.amount, 0); const p = expenses.filter(e => isExpense(e) && monthKey(e.date) === prev).reduce((s, e) => s + e.amount, 0); return { current: c, previous: p, diff: c - p }; }
export function averageMonthlySpending(expenses, n = 6) { const t = monthlySpendingTrend(expenses, n); return t.reduce((s, m) => s + m.total, 0) / n; }
export function topExpenses(expenses, n = 5) { return [...expenses.filter(isExpense)].sort((a, b) => b.amount - a.amount).slice(0, n); }
export function locationBreakdown(expenses) { const map = {}; expenses.filter(isExpense).forEach(e => { if (!e.location) return; const k = e.location.toLowerCase().trim(); if (!map[k]) map[k] = { location: e.location, total: 0, count: 0 }; map[k].total += e.amount; map[k].count++; }); return Object.values(map).sort((a, b) => b.total - a.total); }

// Spesa variabile effettiva del mese corrente (per la barra budget)
export function variableSpentThisMonth(expenses) {
  const mk = currentMonthKey();
  return expenses.filter(e => isExpense(e) && e.nature !== "fisso").reduce((s, e) => {
    const recur = recurringMonthlyCost(e);
    if (recur > 0) return s + recur;
    return monthKey(e.date) === mk ? s + e.amount : s;
  }, 0);
}

// Andamento del tasso di risparmio negli ultimi n mesi
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
