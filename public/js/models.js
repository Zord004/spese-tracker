/**
 * Calcoli sui movimenti: ammortamenti, ricorrenze, budget, proiezioni, fisco.
 * Funzioni pure e senza dipendenze dal DOM: sono coperte da test/models.test.js.
 * @typedef {import("./types.js").Expense} Expense
 * @typedef {import("./types.js").CategorySlice} CategorySlice
 * @typedef {import("./types.js").BudgetStatus} BudgetStatus
 * @typedef {import("./types.js").Projection} Projection
 * @typedef {import("./types.js").CatBudgets} CatBudgets
 * @typedef {import("./types.js").Forecast} Forecast
 * @typedef {import("./types.js").Simulation} Simulation
 */
import { getCat } from "./catalog.js";
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
// Equivalente per le ENTRATE: ricorrenti dal mese d'origine in poi, una tantum nel loro mese.
/** @param {Expense} e @param {string} mk @returns {number} */
export function monthlyIncomeChargeFor(e, mk) {
  if (!isIncome(e)) return 0;
  if (e.recur && e.recur !== "Nessuna") return monthKey(e.date) <= mk ? recurringMonthlyCost(e) : 0;
  return monthKey(e.date) === mk ? e.amount : 0;
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
  const calc = arr => arr.reduce((s, e) => s + monthlyChargeFor(e, mk), 0);
  return {
    fixedMonthly: calc(exps.filter(e => e.nature === "fisso")),
    variableMonthly: calc(exps.filter(e => e.nature !== "fisso")),
  };
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

// Anno dalla stringa 'YYYY-MM-DD' (robusto al fuso, a differenza di new Date().getFullYear())
function yearOf(d) { return typeof d === "string" && /^\d{4}/.test(d) ? Number(d.slice(0, 4)) : new Date(d).getFullYear(); }
/** Report per il commercialista (730/Unico). @param {Expense[]} expenses @param {number} [year] */
export function taxReport(expenses, year = currentYear()) {
  const yearDeductible = expenses.filter(e => isExpense(e) && e.detraibile && yearOf(e.date) === year);
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
  const allExpenses = expenses.filter(e => isExpense(e) && yearOf(e.date) === year);
  const allByCategory = {};
  let totalAllSpent = 0;
  allExpenses.forEach(e => {
    if (!allByCategory[e.cat]) allByCategory[e.cat] = { category: e.cat, count: 0, spent: 0, items: [] };
    allByCategory[e.cat].count++; allByCategory[e.cat].spent += e.amount;
    allByCategory[e.cat].items.push(e); totalAllSpent += e.amount;
  });
  const incomeYear = expenses.filter(e => isIncome(e) && yearOf(e.date) === year);
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
  return expenses.filter(e => isExpense(e) && e.nature !== "fisso").reduce((s, e) => s + monthlyChargeFor(e, mk), 0);
}

// Stato dei budget per categoria nel mese corrente.
// `budgets` è una mappa { categoria: tetto }. Restituisce solo le categorie
// con un tetto impostato, ordinate dalla più critica alla più tranquilla.
/** @param {Expense[]} expenses @param {CatBudgets} [budgets] @returns {BudgetStatus[]} */
export function categoryBudgetStatus(expenses, budgets = {}) {
  const mk = currentMonthKey();
  const spentByCat = {};
  expenses.filter(isExpense).forEach(e => {
    const charge = monthlyChargeFor(e, mk);
    if (charge <= 0) return;
    const id = e.cat || "Altro";
    spentByCat[id] = (spentByCat[id] || 0) + charge;
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
/** @param {Expense[]} expenses @param {number} [fixedIncome] @param {string} [mk] mese (default: corrente) @returns {Projection} */
export function balanceProjection(expenses, fixedIncome = 0, mk = currentMonthKey()) {
  const exps = expenses.filter(isExpense);
  const isRecurring = e => e.recur && e.recur !== "Nessuna";
  const incomeEntries = expenses.filter(isIncome).reduce((s, e) => s + monthlyIncomeChargeFor(e, mk), 0);
  const incomeExpected = fixedIncome + incomeEntries;
  // Già registrato questo mese: una tantum + quote di ammortamento
  const spentSoFar = exps.filter(e => !isRecurring(e)).reduce((s, e) => s + monthlyChargeFor(e, mk), 0);
  // Ricorrenti/fisse attive questo mese (quota mensile)
  const upcoming = exps.filter(isRecurring).reduce((s, e) => s + monthlyChargeFor(e, mk), 0);
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
    const spent = monthTotal(expenses, mk);
    const incomeEntries = expenses.filter(e => isIncome(e) && monthlyIncomeChargeFor(e, mk) > 0).reduce((s, e) => s + monthlyIncomeChargeFor(e, mk), 0);
    const income = fixedIncome + incomeEntries;
    const rate = income > 0 ? Math.max(0, Math.min(100, ((income - spent) / income) * 100)) : null;
    out.push({ mk, rate, income, spent });
  }
  return out;
}


// ─────────────────────────────────────────────────────────────
// Previsione di fine mese (forecasting)
// ─────────────────────────────────────────────────────────────
// Totale previsto = parte CERTA (una tantum già registrate + ricorrenti + quote
// di ammortamento: la stessa regola di monthTotal) + parte STIMATA (ritmo
// giornaliero di spesa discrezionale × giorni che mancano).
// Il ritmo mescola il passo del mese corrente con la media storica: all'inizio
// del mese pesa lo storico, a fine mese pesa il mese in corso.
// Lo storico usa la mediana (con ≥3 mesi) così un acquisto eccezionale non
// gonfia la stima.

const isOneOff = e => isExpense(e) && !(e.recur && e.recur !== "Nessuna") && (Math.trunc(Number(e.am)) || 1) <= 1;
const sum = a => a.reduce((s, x) => s + x, 0);
const mean = a => a.length ? sum(a) / a.length : 0;
const median = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; };
const stdev = a => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(sum(a.map(x => (x - m) ** 2)) / (a.length - 1)); };
const mkOf = (y, m0) => `${y}-${String(m0 + 1).padStart(2, "0")}`;

/**
 * @param {Expense[]} expenses
 * @param {{fixedIncome?: number, now?: Date, historyMonths?: number}} [opts]
 * @returns {Forecast}
 */
export function forecastMonth(expenses, { fixedIncome = 0, now = new Date(), historyMonths = 6 } = {}) {
  const y = now.getFullYear(), m0 = now.getMonth();
  const mk = mkOf(y, m0);
  const dim = new Date(y, m0 + 1, 0).getDate();
  const day = Math.min(now.getDate(), dim);
  const daysLeft = dim - day;
  const today = `${mk}-${String(day).padStart(2, "0")}`;

  const base = balanceProjection(expenses, fixedIncome, mk);
  const floor = base.projectedExpenses;                       // parte certa del mese
  const oneOffs = expenses.filter(isOneOff);
  const spentOneOff = sum(oneOffs.filter(e => monthKey(e.date) === mk).map(e => e.amount));
  // Il "passo" del mese conta solo ciò che è già avvenuto (le voci datate nel futuro
  // sono già nella parte certa ma non misurano il ritmo).
  const toDate = sum(oneOffs.filter(e => monthKey(e.date) === mk && String(e.date).slice(0, 10) <= today).map(e => e.amount));

  // Storico: mesi completi precedenti, a partire dal primo mese con una spesa una tantum
  const firstMk = oneOffs.map(e => monthKey(e.date)).filter(k => k < mk).sort()[0];
  const history = [];
  if (firstMk) {
    for (let i = historyMonths; i >= 1; i--) {
      const d = new Date(y, m0 - i, 1), k = mkOf(d.getFullYear(), d.getMonth());
      if (k < firstMk) continue;
      history.push({ mk: k, days: new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(),
        oneOff: sum(oneOffs.filter(e => monthKey(e.date) === k).map(e => e.amount)) });
    }
  }
  const rates = history.map(h => h.oneOff / h.days);
  const histRate = history.length ? (history.length >= 3 ? median(rates) : mean(rates)) : null;
  const curRate = day > 0 ? toDate / day : 0;
  const w = histRate == null ? 1 : day / dim;                 // peso del mese in corso
  const dailyRate = w * curRate + (1 - w) * (histRate ?? 0);
  const expectedRemaining = dailyRate * daysLeft;

  // Fascia di incertezza: dalla variabilità storica, oppure ±35% se lo storico non basta
  const band = history.length >= 2
    ? stdev(history.map(h => h.oneOff)) * Math.sqrt(daysLeft / dim)
    : expectedRemaining * 0.35;
  const projectedSpend = floor + expectedRemaining;
  const low = floor + Math.max(0, expectedRemaining - band);
  const high = floor + expectedRemaining + band;

  /** @type {"alta"|"media"|"bassa"} */
  const confidence = history.length >= 3 && day >= 7 ? "alta" : (history.length >= 1 || day >= 10) ? "media" : "bassa";
  const variableNow = sum(expenses.filter(e => isExpense(e) && e.nature !== "fisso").map(e => monthlyChargeFor(e, mk)));

  return {
    mk, daysInMonth: dim, dayOfMonth: day, daysLeft,
    floor, committed: floor - spentOneOff, spentOneOff,
    dailyRate, dailyRateCurrent: curRate, dailyRateHistory: histRate,
    expectedRemaining, projectedSpend, low, high, confidence, history,
    incomeExpected: base.incomeExpected, hasIncome: base.incomeExpected > 0,
    projectedBalance: base.incomeExpected - projectedSpend,
    variableNow, projectedVariable: variableNow + expectedRemaining,
  };
}

// ─────────────────────────────────────────────────────────────
// Simulatore "what-if": impatto di una spesa ipotetica
// ─────────────────────────────────────────────────────────────
// La spesa ipotetica è trattata come un movimento vero (stessa regola mensile),
// quindi i numeri sono coerenti con tutto il resto dell'app. Una tantum = importo
// pieno questo mese; a rate = quota mensile per N mesi (come un ammortamento).
const rateOf = (income, spend) => income > 0 ? ((income - spend) / income) * 100 : null;

/**
 * @param {Expense[]} expenses
 * @param {{amount:number, installments?:number, cat?:string, nature?:"variabile"|"fisso"}} scenario
 * @param {{fixedIncome?:number, varBudget?:number, catBudgets?:CatBudgets, now?:Date, historyMonths?:number}} [ctx]
 * @returns {Simulation|null} null se l'importo non è valido
 */
export function simulateExpense(expenses, scenario, { fixedIncome = 0, varBudget = 0, catBudgets = {}, now = new Date(), historyMonths = 6 } = {}) {
  const amount = Number(scenario?.amount);
  if (!(amount > 0) || !Number.isFinite(amount)) return null;
  const months = Math.min(120, Math.max(1, Math.trunc(Number(scenario.installments)) || 1));
  const nature = scenario.nature === "fisso" ? "fisso" : "variabile";
  const cat = scenario.cat || "";

  const before = forecastMonth(expenses, { fixedIncome, now, historyMonths });
  const mk = before.mk;
  /** @type {Expense} */
  const hyp = { type: "spesa", name: "Simulazione", amount, date: `${mk}-${String(before.dayOfMonth).padStart(2, "0")}`,
    cat: cat || "Altro", am: months, recur: "Nessuna", nature };
  const charge = monthlyChargeFor(hyp, mk);
  const schedule = getAmortizationMonths(hyp).map(k => ({ mk: k, charge: monthlyChargeFor(hyp, k) }));
  const varCharge = nature === "fisso" ? 0 : charge;

  const after = {
    projectedSpend: before.projectedSpend + charge, low: before.low + charge, high: before.high + charge,
    projectedBalance: before.projectedBalance - charge, projectedVariable: before.projectedVariable + varCharge,
  };
  const income = before.incomeExpected;
  const rate = { before: rateOf(income, before.projectedSpend), after: rateOf(income, after.projectedSpend) };

  const variable = varBudget > 0 ? {
    limit: varBudget,
    residualBefore: varBudget - before.variableNow, residualAfter: varBudget - before.variableNow - varCharge,
    projectedResidualBefore: varBudget - before.projectedVariable, projectedResidualAfter: varBudget - after.projectedVariable,
  } : null;

  const catLimit = cat ? Number(catBudgets[cat]) || 0 : 0;
  let category = null;
  if (catLimit > 0) {
    const spent = sum(expenses.filter(e => isExpense(e) && (e.cat || "Altro") === cat).map(e => monthlyChargeFor(e, mk)));
    category = { id: cat, limit: catLimit, spentBefore: spent, spentAfter: spent + charge, residualBefore: catLimit - spent, residualAfter: catLimit - spent - charge };
  }

  // Risparmio medio mensile storico (mesi completi con entrate note) → tempo per "recuperare" la spesa
  const firstAny = expenses.map(e => monthKey(e.date)).sort()[0];
  const savings = [];
  for (let i = historyMonths; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1), k = mkOf(d.getFullYear(), d.getMonth());
    if (!firstAny || k < firstAny) continue;
    const inc = fixedIncome + sum(expenses.filter(isIncome).map(e => monthlyIncomeChargeFor(e, k)));
    if (inc > 0) savings.push(inc - monthTotal(expenses, k));
  }
  const avgSaving = savings.length ? mean(savings) : null;
  const monthsToRecover = avgSaving != null && avgSaving > 0 ? amount / avgSaving : null;

  // Verdetto
  /** @type {string[]} */ const reasons = [];
  let level = /** @type {"ok"|"warn"|"over"} */ ("ok");
  const bump = (l, msg) => { reasons.push(msg); if (l === "over" || level === "ok") level = l === "over" ? "over" : (level === "over" ? "over" : "warn"); };
  if (before.hasIncome) {
    if (after.projectedBalance < 0) bump("over", "Il saldo previsto a fine mese diventa negativo.");
    else if (rate.after != null && rate.after < 10) bump("warn", "Il tasso di risparmio previsto scende sotto il 10%.");
  }
  if (variable) {
    if (variable.residualAfter < 0) bump("over", "Superi il limite di spesa variabile del mese.");
    else if (variable.residualAfter < variable.limit * 0.15) bump("warn", "Resta meno del 15% del budget variabile.");
  }
  if (category) {
    if (category.residualAfter < 0) bump("over", `Superi il budget della categoria ${cat}.`);
    else if (category.residualAfter < category.limit * 0.15) bump("warn", `Resta meno del 15% del budget ${cat}.`);
  }

  return { amount, installments: months, charge, schedule, before, after, rate, variable, category,
    hasIncome: before.hasIncome, avgSaving, monthsToRecover, level, reasons };
}
