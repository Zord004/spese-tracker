import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  isIncome, isExpense, monthlyCost, getAmortizationMonths, isActiveInMonth,
  recurringMonthlyCost, totalRecurringMonthly, totalAmortizedThisMonth,
  totalIncomeThisMonth, categoryBreakdown, fixedVsVariable, savingsRate,
  costPerUse, taxReport, amortizationTimeline, activeAmortizations,
  monthlySpendingTrend, monthComparison, averageMonthlySpending, topExpenses,
  locationBreakdown, variableSpentThisMonth, balanceProjection, savingsRateTrend, categoryBudgetStatus,
  monthlyChargeFor, monthTotal, monthlyIncomeChargeFor,
} from "../public/js/models.js";
import { currentMonthKey, currentYear } from "../public/js/utils.js";

// ── Helper per fixture ancorate al mese corrente ──
// I modelli usano la data odierna, quindi le fixture sono relative a "adesso".
function dateInMonth(offset = 0, day = 15) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const spesa = (o) => ({ type: "spesa", name: "x", amount: 100, date: dateInMonth(0), cat: "Altro", am: 1, recur: "Nessuna", nature: "variabile", detraibile: false, detrazionePct: 0, utilizzi: 0, ...o });
/** Movimento volutamente incompleto: serve a verificare la robustezza sui dati parziali. @param {*} o */
const parziale = (o) => /** @type {any} */ (o);
const entrata = (o) => ({ type: "entrata", name: "y", amount: 1000, date: dateInMonth(0), cat: "Stipendio", am: 1, recur: "Nessuna", nature: "variabile", ...o });

describe("isIncome / isExpense", () => {
  test("distingue entrate e spese", () => {
    assert.equal(isIncome(entrata()), true);
    assert.equal(isExpense(entrata()), false);
    assert.equal(isExpense(spesa()), true);
  });
  test("un movimento senza tipo è trattato come spesa", () => {
    assert.equal(isExpense(parziale({ amount: 10 })), true);
  });
});

describe("monthlyCost e ammortamento", () => {
  test("senza ammortamento il costo mensile è l'importo intero", () => {
    assert.equal(monthlyCost(spesa({ amount: 300, am: 1 })), 300);
  });
  test("con ammortamento divide per i mesi", () => {
    assert.equal(monthlyCost(spesa({ amount: 1200, am: 12 })), 100);
  });
  test("am non valido non causa divisione per zero", () => {
    assert.equal(monthlyCost(parziale({ amount: 500, am: 0 })), 500);
    assert.equal(monthlyCost(parziale({ amount: 500 })), 500);
  });
  test("genera la sequenza corretta di mesi", () => {
    const m = getAmortizationMonths(parziale({ date: "2026-01-15", am: 3 }));
    assert.deepEqual(m, ["2026-01", "2026-02", "2026-03"]);
  });
  // Regressione: acquisti a fine mese saltavano febbraio e duplicavano marzo
  test("acquisto di fine mese distribuisce le quote sui mesi giusti", () => {
    const m = getAmortizationMonths(parziale({ date: "2026-01-31", am: 4 }));
    assert.deepEqual(m, ["2026-01", "2026-02", "2026-03", "2026-04"]);
    assert.equal(new Set(m).size, 4, "nessun mese duplicato");
  });
  test("isActiveInMonth riconosce i mesi coperti", () => {
    const e = parziale({ date: "2026-01-15", am: 3 });
    assert.equal(isActiveInMonth(e, "2026-02"), true);
    assert.equal(isActiveInMonth(e, "2026-05"), false);
  });
});

describe("recurringMonthlyCost", () => {
  test("nessuna ricorrenza costa zero al mese", () => {
    assert.equal(recurringMonthlyCost(spesa({ recur: "Nessuna" })), 0);
    assert.equal(recurringMonthlyCost(spesa({ recur: undefined })), 0);
  });
  test("normalizza ogni periodicità a base mensile", () => {
    assert.equal(recurringMonthlyCost(spesa({ amount: 3, recur: "Giornaliera" })), 90);
    assert.equal(recurringMonthlyCost(spesa({ amount: 15, recur: "Mensile" })), 15);
    assert.equal(recurringMonthlyCost(spesa({ amount: 300, recur: "Trimestrale" })), 100);
    assert.equal(recurringMonthlyCost(spesa({ amount: 1200, recur: "Annuale" })), 100);
  });
  test("supporta la ricorrenza personalizzata", () => {
    assert.equal(recurringMonthlyCost(spesa({ amount: 400, recur: "Ogni 4 mesi" })), 100);
  });
  test("totalRecurringMonthly esclude le entrate", () => {
    const data = [spesa({ amount: 15, recur: "Mensile" }), entrata({ amount: 2000, recur: "Mensile" })];
    assert.equal(totalRecurringMonthly(data), 15);
  });
});

describe("totali del mese", () => {
  test("somma le quote di ammortamento attive", () => {
    const data = [
      spesa({ amount: 1200, am: 12, date: dateInMonth(0, 1) }), // 100/mese, attiva
      spesa({ amount: 600, am: 6, date: dateInMonth(-24, 1) }), // conclusa da tempo
    ];
    assert.equal(totalAmortizedThisMonth(data), 100);
  });
  test("le entrate del mese includono le ricorrenti", () => {
    const data = [
      entrata({ amount: 2000, date: dateInMonth(0, 3) }),
      entrata({ amount: 500, recur: "Mensile", date: dateInMonth(-3, 1) }),
      entrata({ amount: 999, date: dateInMonth(-1, 3) }), // mese scorso, esclusa
    ];
    assert.equal(totalIncomeThisMonth(data), 2500);
  });
});

describe("categoryBreakdown", () => {
  test("aggrega per categoria e ordina per importo", () => {
    const data = [spesa({ cat: "Cibo", amount: 50 }), spesa({ cat: "Casa", amount: 200 }), spesa({ cat: "Cibo", amount: 30 })];
    const b = categoryBreakdown(data);
    assert.equal(b[0].id, "Casa");
    assert.equal(b[0].total, 200);
    assert.equal(b[1].id, "Cibo");
    assert.equal(b[1].total, 80);
    assert.equal(b[1].count, 2);
  });
  test("include categorie sconosciute aggiunte su Notion", () => {
    const b = categoryBreakdown([spesa({ cat: "Mobilità sostenibile", amount: 300 })]);
    assert.equal(b[0].id, "Mobilità sostenibile");
    assert.ok(b[0].color, "deve avere un colore assegnato");
  });
  test("esclude le entrate", () => {
    assert.equal(categoryBreakdown([entrata({ amount: 1000 })]).length, 0);
  });
  test("è mensile: usa la quota delle ricorrenti, non l'importo pieno", () => {
    const b = categoryBreakdown([spesa({ cat: "Auto/Moto", amount: 1200, date: dateInMonth(-2, 10), recur: "Annuale", nature: "fisso" })]);
    assert.equal(b[0].total, 100); // 1200/12, non 1200
  });
  test("è mensile: esclude le una tantum di mesi passati", () => {
    const b = categoryBreakdown([spesa({ cat: "Cibo", amount: 80, date: dateInMonth(-1, 10), recur: "Nessuna" })]);
    assert.equal(b.length, 0); // spesa del mese scorso non entra in quello corrente
  });
  test("il totale della ripartizione coincide con monthTotal del mese", () => {
    const data = [
      spesa({ cat: "Casa", amount: 700, date: dateInMonth(-3, 1), recur: "Mensile", nature: "fisso" }),
      spesa({ cat: "Cibo", amount: 50, date: dateInMonth(0, 10) }),
    ];
    const sum = categoryBreakdown(data).reduce((s, c) => s + c.total, 0);
    assert.equal(sum, monthTotal(data, currentMonthKey()));
  });
});

describe("fixedVsVariable e savingsRate", () => {
  test("separa spese fisse e variabili su base mensile", () => {
    const data = [
      spesa({ nature: "fisso", amount: 700, recur: "Mensile" }),
      spesa({ nature: "variabile", amount: 100, date: dateInMonth(0) }),
    ];
    const r = fixedVsVariable(data);
    assert.equal(r.fixedMonthly, 700);
    assert.equal(r.variableMonthly, 100);
  });
  test("per una voce sia ricorrente sia rateizzata prende il valore maggiore, non la somma", () => {
    const r = fixedVsVariable([spesa({ nature: "fisso", amount: 1200, am: 12, recur: "Mensile", date: dateInMonth(0, 1) })]);
    assert.equal(r.fixedMonthly, 1200); // ricorrente mensile 1200 > quota 100
  });
  test("savings rate su reddito nullo è zero, non infinito", () => {
    assert.equal(savingsRate(0, 500), 0);
  });
  test("savings rate non scende sotto zero", () => {
    assert.equal(savingsRate(1000, 1500), 0);
  });
  test("calcola la percentuale risparmiata", () => {
    assert.equal(savingsRate(2000, 500), 75);
  });
});

describe("costPerUse", () => {
  test("null se non ci sono utilizzi", () => {
    assert.equal(costPerUse(spesa({ amount: 100, utilizzi: 0 })), null);
  });
  test("divide l'importo per gli utilizzi", () => {
    assert.equal(costPerUse(spesa({ amount: 500, utilizzi: 25 })), 20);
  });
});

describe("taxReport", () => {
  const Y = currentYear();
  const data = [
    spesa({ name: "Visita", amount: 200, cat: "Salute", detraibile: true, detrazionePct: 19, date: `${Y}-03-10` }),
    spesa({ name: "Farmaco", amount: 100, cat: "Salute", detraibile: true, detrazionePct: 19, date: `${Y}-04-02` }),
    spesa({ name: "Corso", amount: 500, cat: "Formazione", detraibile: true, detrazionePct: 50, date: `${Y}-05-20` }),
    spesa({ name: "Cena", amount: 60, cat: "Cibo", detraibile: false, date: `${Y}-06-01` }),
    spesa({ name: "Vecchia", amount: 999, cat: "Salute", detraibile: true, detrazionePct: 19, date: `${Y - 2}-03-10` }),
    entrata({ amount: 24000, date: `${Y}-01-31` }),
  ];
  const r = taxReport(data, Y);

  test("considera solo le spese detraibili dell'anno richiesto", () => {
    assert.equal(r.totalSpent, 800); // 200 + 100 + 500, esclusa quella di 2 anni fa
    assert.equal(r.items.length, 3);
  });
  test("calcola la detrazione con le percentuali corrette", () => {
    // 200*0,19 + 100*0,19 + 500*0,50 = 38 + 19 + 250 = 307
    assert.equal(Math.round(r.totalDeduction * 100) / 100, 307);
  });
  test("raggruppa per categoria ordinando per detrazione", () => {
    assert.equal(r.byCategory[0].category, "Formazione"); // 250 > 57
    assert.equal(r.byCategory[1].category, "Salute");
    assert.equal(r.byCategory[1].spent, 300);
  });
  test("il totale di tutte le spese include anche le non detraibili", () => {
    assert.equal(r.totalAllSpent, 860); // 800 + 60
  });
  test("il bilancio è entrate meno spese totali", () => {
    assert.equal(r.totalIncome, 24000);
    assert.equal(r.balance, 24000 - 860);
  });
  test("un anno senza movimenti restituisce zeri, non errori", () => {
    const vuoto = taxReport(data, 1999);
    assert.equal(vuoto.totalDeduction, 0);
    assert.equal(vuoto.byCategory.length, 0);
    assert.equal(vuoto.balance, 0);
  });
});

describe("timeline ammortamenti", () => {
  test("distribuisce l'importo sui mesi e ignora le spese non rateizzate", () => {
    const t = amortizationTimeline([
      spesa({ amount: 1200, am: 12, date: "2026-01-10" }),
      spesa({ amount: 50, am: 1, date: "2026-01-10" }),
    ]);
    assert.equal(t.length, 12);
    assert.equal(t[0][0], "2026-01");
    assert.equal(t[0][1], 100);
  });
  test("activeAmortizations elenca solo le rate in corso", () => {
    const a = activeAmortizations([
      spesa({ amount: 1200, am: 12, date: dateInMonth(-2, 1) }),
      spesa({ amount: 600, am: 6, date: dateInMonth(-30, 1) }),
      spesa({ amount: 50, am: 1 }),
    ]);
    assert.equal(a.length, 1);
  });
});

describe("andamento e confronti", () => {
  test("monthlySpendingTrend restituisce n mesi in ordine cronologico", () => {
    const t = monthlySpendingTrend([spesa({ amount: 100, date: dateInMonth(0) })], 6);
    assert.equal(t.length, 6);
    assert.equal(t[5].mk, currentMonthKey());
    assert.equal(t[5].total, 100);
  });
  test("monthComparison confronta mese corrente e precedente", () => {
    const c = monthComparison([
      spesa({ amount: 300, date: dateInMonth(0) }),
      spesa({ amount: 100, date: dateInMonth(-1) }),
    ]);
    assert.equal(c.current, 300);
    assert.equal(c.previous, 100);
    assert.equal(c.diff, 200);
  });
  test("averageMonthlySpending divide sul numero di mesi", () => {
    const avg = averageMonthlySpending([spesa({ amount: 600, date: dateInMonth(0) })], 6);
    assert.equal(avg, 100);
  });
  test("topExpenses ordina per importo decrescente", () => {
    const t = topExpenses([spesa({ amount: 10 }), spesa({ amount: 900 }), spesa({ amount: 50 })], 2);
    assert.equal(t.length, 2);
    assert.equal(t[0].amount, 900);
  });
  test("locationBreakdown accorpa ignorando maiuscole e spazi", () => {
    const l = locationBreakdown([
      spesa({ amount: 20, location: "Milano" }),
      spesa({ amount: 30, location: " milano " }),
      spesa({ amount: 10, location: "" }),
    ]);
    assert.equal(l.length, 1);
    assert.equal(l[0].total, 50);
    assert.equal(l[0].count, 2);
  });
});

describe("variableSpentThisMonth", () => {
  test("somma le variabili del mese ed esclude le fisse", () => {
    const data = [
      spesa({ amount: 80, nature: "variabile", date: dateInMonth(0) }),
      spesa({ amount: 300, nature: "variabile", date: dateInMonth(0) }),
      spesa({ amount: 700, nature: "fisso", recur: "Mensile" }),
      spesa({ amount: 50, nature: "variabile", date: dateInMonth(-1) }), // mese scorso
    ];
    assert.equal(variableSpentThisMonth(data), 380);
  });
});

describe("categoryBudgetStatus", () => {
  const data = [
    spesa({ cat: "Cibo", amount: 120, date: dateInMonth(0, 5) }),
    spesa({ cat: "Cibo", amount: 80, date: dateInMonth(0, 12) }),
    spesa({ cat: "Svago", amount: 95, date: dateInMonth(0, 8) }),
    spesa({ cat: "Casa", amount: 700, date: dateInMonth(0, 2) }),
    spesa({ cat: "Cibo", amount: 999, date: dateInMonth(-1, 5) }), // mese scorso, ignorata
  ];

  test("restituisce solo le categorie con un tetto impostato", () => {
    const s = categoryBudgetStatus(data, { Cibo: 300 });
    assert.equal(s.length, 1);
    assert.equal(s[0].id, "Cibo");
  });
  test("conta solo le spese del mese corrente", () => {
    const s = categoryBudgetStatus(data, { Cibo: 300 });
    assert.equal(s[0].spent, 200); // 120 + 80, esclusi i 999 del mese scorso
    assert.equal(s[0].remaining, 100);
  });
  test("classifica ok / warn / over sulle soglie giuste", () => {
    const s = categoryBudgetStatus(data, { Cibo: 300, Svago: 100, Casa: 500 });
    const byId = Object.fromEntries(s.map(x => [x.id, x]));
    assert.equal(byId.Cibo.state, "ok");    // 200/300 = 67%
    assert.equal(byId.Svago.state, "warn"); // 95/100 = 95%
    assert.equal(byId.Casa.state, "over");  // 700/500 = 140%
  });
  test("ordina dalla categoria più critica", () => {
    const s = categoryBudgetStatus(data, { Cibo: 300, Svago: 100, Casa: 500 });
    assert.equal(s[0].id, "Casa");
    assert.equal(s[s.length - 1].id, "Cibo");
  });
  test("la barra non supera il 100% anche se il tetto è sforato", () => {
    const s = categoryBudgetStatus(data, { Casa: 500 });
    assert.equal(s[0].ratio, 1);
    assert.ok(s[0].pct > 100, "la percentuale reale resta consultabile");
  });
  test("le spese ricorrenti pesano con la quota mensile", () => {
    const s = categoryBudgetStatus([spesa({ cat: "Svago", amount: 15, recur: "Mensile", date: dateInMonth(-5, 1) })], { Svago: 100 });
    assert.equal(s[0].spent, 15);
  });
  test("una categoria senza spese resta a zero", () => {
    const s = categoryBudgetStatus([], { Cibo: 300 });
    assert.equal(s[0].spent, 0);
    assert.equal(s[0].state, "ok");
  });
  test("i tetti a zero o negativi vengono ignorati", () => {
    assert.equal(categoryBudgetStatus(data, { Cibo: 0, Svago: -50 }).length, 0);
  });
  test("nessun budget impostato non produce righe", () => {
    assert.deepEqual(categoryBudgetStatus(data, {}), []);
    assert.deepEqual(categoryBudgetStatus(data), []);
  });
});

describe("monthlyChargeFor e monthTotal (regola unica per mese)", () => {
  test("una tantum: conta solo nel suo mese", () => {
    const e = spesa({ amount: 100, date: dateInMonth(0, 10), recur: "Nessuna", am: 1 });
    assert.equal(monthlyChargeFor(e, currentMonthKey()), 100);
    // mese scorso → 0
    const prevMk = dateInMonth(-1).slice(0, 7);
    assert.equal(monthlyChargeFor(e, prevMk), 0);
  });
  // Regressione: le ricorrenti devono contare in OGNI mese dal mese d'origine
  test("ricorrente mensile: conta ogni mese dall'origine in poi, non solo nel primo", () => {
    const netflix = spesa({ amount: 15, date: dateInMonth(-3, 10), recur: "Mensile", nature: "fisso" });
    const originMk = dateInMonth(-3).slice(0, 7);
    const midMk = dateInMonth(-1).slice(0, 7);
    const curMk = currentMonthKey();
    assert.equal(monthlyChargeFor(netflix, originMk), 15, "mese d'origine");
    assert.equal(monthlyChargeFor(netflix, midMk), 15, "mese intermedio");
    assert.equal(monthlyChargeFor(netflix, curMk), 15, "mese corrente");
  });
  test("ricorrente: NON conta nei mesi precedenti all'origine", () => {
    const e = spesa({ amount: 15, date: dateInMonth(0, 10), recur: "Mensile" });
    const prevMk = dateInMonth(-2).slice(0, 7);
    assert.equal(monthlyChargeFor(e, prevMk), 0);
  });
  test("ricorrente annuale: spalmata a 1/12 ogni mese dall'origine", () => {
    const e = spesa({ amount: 1200, date: dateInMonth(-2, 10), recur: "Annuale", nature: "fisso" });
    assert.equal(monthlyChargeFor(e, currentMonthKey()), 100);
  });
  test("ammortizzato: quota solo nei mesi coperti", () => {
    const e = spesa({ amount: 1200, date: dateInMonth(-2, 1), recur: "Nessuna", am: 12 });
    assert.equal(monthlyChargeFor(e, currentMonthKey()), 100);
    // 20 mesi fa non era ancora iniziato
    assert.equal(monthlyChargeFor(e, dateInMonth(-20).slice(0, 7)), 0);
  });
  test("monthTotal somma tutto correttamente", () => {
    const data = [
      spesa({ amount: 700, date: dateInMonth(-5, 1), recur: "Mensile", nature: "fisso" }),
      spesa({ amount: 15, date: dateInMonth(-3, 1), recur: "Mensile", nature: "fisso" }),
      spesa({ amount: 50, date: dateInMonth(0, 10), recur: "Nessuna" }),
    ];
    // mese corrente: 700 + 15 + 50 = 765
    assert.equal(monthTotal(data, currentMonthKey()), 765);
    // due mesi fa: solo affitto 700 + netflix 15 = 715 (la spesa una tantum non c'era)
    assert.equal(monthTotal(data, dateInMonth(-2).slice(0, 7)), 715);
  });
});

describe("monthlySpendingTrend con ricorrenti (regressione)", () => {
  test("una ricorrente compare in tutti i mesi dall'origine, non solo nel primo", () => {
    const data = [spesa({ amount: 100, date: dateInMonth(-4, 10), recur: "Mensile", nature: "fisso" })];
    const trend = monthlySpendingTrend(data, 6);
    // origine 4 mesi fa: gli ultimi 5 mesi (da -4 a 0) devono valere 100, il più vecchio (-5) 0
    assert.equal(trend[0].total, 0, "mese precedente all'origine");
    assert.equal(trend[1].total, 100);
    assert.equal(trend[5].total, 100, "mese corrente");
  });
  test("il mese corrente del grafico coincide con monthTotal del mese corrente", () => {
    const data = [
      spesa({ amount: 700, date: dateInMonth(-5, 1), recur: "Mensile", nature: "fisso" }),
      spesa({ amount: 50, date: dateInMonth(0, 10) }),
    ];
    const trend = monthlySpendingTrend(data, 6);
    assert.equal(trend[5].total, monthTotal(data, currentMonthKey()));
  });
});

describe("coerenza tra le funzioni mensili (regressione)", () => {
  const data = [
    spesa({ cat: "Casa", amount: 800, date: dateInMonth(-4, 10), recur: "Mensile", nature: "fisso" }),
    spesa({ cat: "Tecnologia", amount: 1200, date: dateInMonth(-2, 1), recur: "Nessuna", nature: "variabile", am: 12 }),
    spesa({ cat: "Cibo", amount: 60, date: dateInMonth(0, 10), recur: "Nessuna", nature: "variabile" }),
    entrata({ amount: 2000, date: dateInMonth(-4, 3), recur: "Mensile" }),
  ];
  const cur = currentMonthKey();

  test("il grafico spesa e quello del tasso di risparmio usano la stessa spesa", () => {
    const sp = monthlySpendingTrend(data, 6);
    const sr = savingsRateTrend(data, 0, 6);
    sp.forEach((s, i) => assert.equal(s.total, sr[i].spent, `mese ${s.mk}`));
  });
  test("le entrate ricorrenti si proiettano nel tasso di risparmio", () => {
    const sr = savingsRateTrend(data, 0, 6);
    assert.equal(sr[5].income, 2000, "stipendio mensile presente nel mese corrente");
    assert.equal(sr[1].income, 2000, "e anche nei mesi successivi all'origine");
  });
  test("fissi + variabili == monthTotal del mese", () => {
    const fv = fixedVsVariable(data);
    assert.equal(fv.fixedMonthly + fv.variableMonthly, monthTotal(data, cur));
  });
  test("l'ammortamento pesa come quota mensile nella spesa variabile", () => {
    assert.equal(variableSpentThisMonth(data), 160); // PC 100 + Cibo 60 (l'affitto è fisso)
  });
  test("budget per categoria e ripartizione coincidono per la stessa categoria", () => {
    const bud = categoryBudgetStatus(data, { Casa: 1000, Tecnologia: 500 });
    const brk = categoryBreakdown(data, cur);
    ["Casa", "Tecnologia"].forEach(c => {
      const b = bud.find(x => x.id === c)?.spent;
      const r = brk.find(x => x.id === c)?.total;
      assert.equal(b, r, `categoria ${c}`);
    });
  });
  test("balanceProjection: spentSoFar + upcoming == spesa totale del mese", () => {
    const p = balanceProjection(data, 0);
    assert.equal(p.spentSoFar + p.upcoming, monthTotal(data, cur));
    assert.equal(p.projectedExpenses, monthTotal(data, cur));
  });
});

describe("balanceProjection", () => {
  test("sottrae le spese sostenute e le ricorrenti ancora da pagare", () => {
    const data = [
      entrata({ amount: 2000, date: dateInMonth(0, 3) }),
      spesa({ amount: 300, date: dateInMonth(0, 10) }),
      spesa({ amount: 600, recur: "Mensile", nature: "fisso", date: dateInMonth(-1, 1) }),
    ];
    const p = balanceProjection(data, 0);
    assert.equal(p.incomeExpected, 2000);
    assert.equal(p.spentSoFar, 300);
    assert.equal(p.upcoming, 600);
    assert.equal(p.projectedBalance, 1100);
  });
  test("somma l'entrata fissa configurata a quelle registrate", () => {
    const p = balanceProjection([entrata({ amount: 500, date: dateInMonth(0, 3) })], 2000);
    assert.equal(p.incomeExpected, 2500);
  });
  test("senza entrate la proiezione è negativa, non NaN", () => {
    const p = balanceProjection([spesa({ amount: 100, date: dateInMonth(0) })], 0);
    assert.equal(p.projectedBalance, -100);
    assert.ok(!Number.isNaN(p.projectedBalance));
  });
});

describe("savingsRateTrend", () => {
  test("restituisce n mesi con l'ultimo pari a quello corrente", () => {
    const t = savingsRateTrend([entrata({ amount: 2000, date: dateInMonth(0, 3) }), spesa({ amount: 980, date: dateInMonth(0, 10) })], 0, 6);
    assert.equal(t.length, 6);
    assert.equal(t[5].mk, currentMonthKey());
    assert.equal(Math.round(t[5].rate), 51); // (2000-980)/2000
  });
  test("senza reddito il tasso è null, non zero fuorviante", () => {
    const t = savingsRateTrend([spesa({ amount: 100, date: dateInMonth(0) })], 0, 3);
    assert.equal(t[2].rate, null);
  });
  test("il tasso resta nell'intervallo 0-100", () => {
    const t = savingsRateTrend([entrata({ amount: 1000, date: dateInMonth(0, 1) }), spesa({ amount: 5000, date: dateInMonth(0, 2) })], 0, 2);
    assert.ok(t[1].rate >= 0 && t[1].rate <= 100);
  });
});

describe("robustezza con dati vuoti o incompleti", () => {
  test("le funzioni aggregate reggono la lista vuota", () => {
    assert.equal(totalAmortizedThisMonth([]), 0);
    assert.equal(totalRecurringMonthly([]), 0);
    assert.equal(totalIncomeThisMonth([]), 0);
    assert.equal(variableSpentThisMonth([]), 0);
    assert.deepEqual(categoryBreakdown([]), []);
    assert.equal(balanceProjection([], 0).projectedBalance, 0);
  });
  test("un movimento senza categoria finisce in Altro", () => {
    const b = categoryBreakdown([spesa({ cat: undefined, amount: 10 })]);
    assert.equal(b[0].id, "Altro");
  });
});
