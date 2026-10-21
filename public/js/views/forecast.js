// Previsione di fine mese e simulatore "what-if" (schermate dentro Analisi).
// Tutti i numeri arrivano da models.js (forecastMonth / simulateExpense): qui
// c'è solo la presentazione.
import { escapeHtml, formatCurrency, monthLabel, monthShort, infoBtn } from "../utils.js";
import { forecastMonth, simulateExpense, isExpense } from "../models.js";
import { expenseCategories } from "../catalog.js";
import { groupBlocks } from "../layout.js";

const CONF = { alta: "Alta", media: "Media", bassa: "Bassa" };
const CONF_TIP = "Quanto è solida la stima. Alta: almeno 3 mesi di storico e il mese è già avviato. Media: qualche mese di storico o il mese è a metà. Bassa: pochi dati, la stima è solo indicativa.";
const pct = n => `${Math.round(n)}%`;
const euro1 = n => String(n.toFixed(1)).replace(".", ",");

/** Barra a segmenti: impegni · spese registrate · attese · fascia di incertezza. */
function forecastBar(fc) {
  const total = Math.max(fc.high, 1);
  const w = v => (Math.max(0, v) / total * 100).toFixed(2);
  return `
    <div class="fc-bar" role="img" aria-label="Composizione della spesa prevista">
      <span class="seg seg-committed" style="width:${w(fc.committed)}%"></span>
      <span class="seg seg-spent" style="width:${w(fc.spentOneOff)}%"></span>
      <span class="seg seg-exp" style="width:${w(fc.expectedRemaining)}%"></span>
      <span class="seg seg-band" style="width:${w(fc.high - fc.projectedSpend)}%"></span>
    </div>
    <div class="fc-legend">
      <span><i class="sw seg-committed"></i>Impegni</span>
      <span><i class="sw seg-spent"></i>Registrate</span>
      <span><i class="sw seg-exp"></i>Attese</span>
    </div>`;
}

function rangeText(fc) {
  return fc.high - fc.low < 0.5 ? "" : `<div class="proj-range tnum">fascia probabile ${formatCurrency(fc.low)} – ${formatCurrency(fc.high)}</div>`;
}
function daysText(fc) { return fc.daysLeft === 0 ? "ultimo giorno del mese" : `${fc.daysLeft} ${fc.daysLeft === 1 ? "giorno" : "giorni"} alla fine del mese`; }

/** Riepilogo compatto per la Home. @param {import("../types.js").Forecast} fc */
export function forecastSummaryHtml(fc) {
  const b = fc.projectedBalance;
  return `
    <div class="proj">
      <div>
        <div class="eyebrow">Spesa prevista</div>
        <div class="proj-fig tnum">${formatCurrency(fc.projectedSpend)}</div>
        ${rangeText(fc)}
      </div>
      <div class="proj-side">
        ${fc.hasIncome ? `<div>Saldo previsto <b class="tnum" style="color:${b >= 0 ? "var(--credit)" : "var(--debit)"}">${b >= 0 ? "+" : ""}${formatCurrency(b)}</b></div>` : ""}
        <div>Già impegnato <b class="tnum">${formatCurrency(fc.floor)}</b></div>
        <div>Ancora atteso <b class="tnum">${formatCurrency(fc.expectedRemaining)}</b></div>
      </div>
    </div>
    ${forecastBar(fc)}
    <div class="fc-conf">Affidabilità <b>${CONF[fc.confidence]}</b> · ${daysText(fc)}</div>`;
}

// ─────────────────────────── Scheda "Previsione" ───────────────────────────
export function renderForecast(el, expenses, callbacks) {
  if (!expenses.some(isExpense)) {
    el.innerHTML = `<div class="card" style="margin-top:12px"><div class="empty"><span class="big">Nessun dato</span>Registra qualche spesa per ottenere una previsione.</div></div>`;
    return;
  }
  const fc = forecastMonth(expenses, { fixedIncome: Number(callbacks.getIncome?.()) || 0 });
  const kv = (l, v, cls = "") => `<div class="kv ${cls}"><span>${l}</span><b class="tnum">${v}</b></div>`;

  // Ritmo di spesa: questo mese vs storico
  let pace = "";
  if (fc.dailyRateHistory != null) {
    const cur = fc.dailyRateCurrent, hist = fc.dailyRateHistory;
    const diff = hist > 0 ? (cur / hist - 1) * 100 : null;
    const tag = diff == null ? "" : diff > 10 ? `<span class="chip-delta up">sopra la tua media</span>` : diff < -10 ? `<span class="chip-delta down">sotto la tua media</span>` : `<span class="chip-delta">in linea</span>`;
    pace = `
      <div class="pad"><div class="sec-head"><span class="sec-title">Ritmo di spesa</span>${infoBtn("Spesa una tantum media al giorno (escluse ricorrenti e rate). La previsione mescola il ritmo di questo mese con quello storico: all'inizio del mese pesa di più lo storico, verso la fine pesa il mese in corso.")}</div></div>
      <div class="card">
        ${kv("Questo mese", `${formatCurrency(cur)} / giorno ${tag}`)}
        ${kv(`Storico (${fc.history.length} ${fc.history.length === 1 ? "mese" : "mesi"})`, `${formatCurrency(hist)} / giorno`)}
        ${kv("Ritmo usato per la stima", `${formatCurrency(fc.dailyRate)} / giorno`)}
      </div>`;
  }

  // Storico delle spese una tantum + mese corrente previsto
  /** @type {{label:string, v:number, tip:string, now?:boolean}[]} */
  const items = [
    ...fc.history.map(h => ({ label: monthShort(h.mk), v: h.oneOff, tip: `${monthLabel(h.mk)}: ${formatCurrency(h.oneOff)} di spese una tantum` })),
    { label: monthShort(fc.mk), v: fc.spentOneOff + fc.expectedRemaining, now: true, tip: `${monthLabel(fc.mk)} (previsto): ${formatCurrency(fc.spentOneOff + fc.expectedRemaining)} di spese una tantum` },
  ];
  const max = Math.max(...items.map(i => i.v), 1);
  const hist = items.length > 1 ? `
      <div class="pad"><div class="sec-head"><span class="sec-title">Storico spese una tantum</span>${infoBtn("Spese non ricorrenti e non rateizzate mese per mese. L'ultima barra (a righe) è il mese corrente: registrato + previsto. Tocca una barra per il valore.")}</div></div>
      <div class="card"><div class="fc-hist">${items.map(i => `
        <div class="fc-col" data-tip="${escapeHtml(i.tip)}"><div class="fc-colwrap"><div class="fc-colbar${i.now ? " now" : ""}" style="height:${(i.v / max * 100).toFixed(1)}%"></div></div><div class="fc-collbl">${i.label}</div></div>`).join("")}
      </div></div>` : "";

  const bal = fc.projectedBalance;
  const balance = fc.hasIncome ? `
      <div class="pad"><div class="sec-head"><span class="sec-title">Saldo a fine mese</span></div></div>
      <div class="card">
        ${kv("Entrate attese", formatCurrency(fc.incomeExpected))}
        ${kv("Spesa prevista", `− ${formatCurrency(fc.projectedSpend)}`)}
        ${kv("Saldo previsto", `<span style="color:${bal >= 0 ? "var(--credit)" : "var(--debit)"}">${bal >= 0 ? "+" : ""}${formatCurrency(bal)}</span>`, "total")}
        ${kv("Tasso di risparmio previsto", pct((bal / fc.incomeExpected) * 100))}
      </div>` : "";

  el.innerHTML = `
    <div class="pad"><div class="sec-head"><span class="sec-title">Previsione di ${monthLabel(fc.mk)}</span>${infoBtn(`Stima della spesa totale a fine mese: la parte certa (spese registrate, ricorrenti e rate) più la spesa che ci si aspetta nei giorni rimanenti, calcolata dalle tue abitudini passate. ${CONF_TIP}`)}</div></div>
    <div class="card pad-card">${forecastSummaryHtml(fc)}</div>

    <div class="pad"><div class="sec-head"><span class="sec-title">Come si compone</span></div></div>
    <div class="card">
      ${kv("Ricorrenti e rate del mese", formatCurrency(fc.committed))}
      ${kv("Spese registrate (una tantum)", formatCurrency(fc.spentOneOff))}
      ${kv(`Attese nei prossimi ${fc.daysLeft} giorni`, `≈ ${formatCurrency(fc.expectedRemaining)}`)}
      ${kv("Spesa prevista", formatCurrency(fc.projectedSpend), "total")}
    </div>

    ${pace}
    ${hist}
    ${balance}

    <div class="pad"><div class="sec-head"><span class="sec-title">E se compro qualcosa?</span></div></div>
    <div class="card pad-card"><button class="btn-wide" id="go-sim">Simula una spesa →</button></div>
  `;
  el.querySelector("#go-sim")?.addEventListener("click", () => callbacks.goTab?.("sim"));
  groupBlocks(el);
}

// ─────────────────────────── Scheda "Simulatore" ───────────────────────────
// Stato mantenuto tra un cambio scheda e l'altro
const _sim = { amount: "", installments: 1, cat: "" };

function parseAmount(v) {
  let s = String(v).trim().replace(/\s/g, "").replace(/€/g, "");
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");            // 1.200 → 1200
  else if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

const LEVEL = {
  ok:   { title: "Sostenibile",  sub: "Rientra nei tuoi limiti." },
  warn: { title: "Attenzione",   sub: "Si può fare, ma stringe i margini." },
  over: { title: "Fuori limite", sub: "Supera almeno uno dei tuoi limiti." },
};

/** @param {import("../types.js").Simulation} sim */
function simResultHtml(sim) {
  const row = (label, b, a, { fmt = formatCurrency, signed = false } = {}) => `
    <div class="sim-row"><span class="sim-lbl">${label}</span>
      <span class="sim-vals tnum"><span class="was">${fmt(b)}</span><span class="arr">→</span><b class="now${signed && a < 0 ? " neg" : ""}">${fmt(a)}</b></span></div>`;
  const L = LEVEL[sim.level];
  const rate = sim.installments > 1
    ? `${formatCurrency(sim.charge)} al mese per ${sim.installments} mesi · totale ${formatCurrency(sim.amount)} <span class="muted">(${monthLabel(sim.schedule[0].mk)} → ${monthLabel(sim.schedule[sim.schedule.length - 1].mk)})</span>`
    : `${formatCurrency(sim.amount)} una tantum, tutti questo mese`;

  let recover = "";
  if (sim.avgSaving != null) {
    recover = sim.monthsToRecover == null
      ? `Negli ultimi mesi non hai risparmiato in media: questa spesa non sarebbe coperta dal risparmio.`
      : sim.monthsToRecover <= 1
        ? `Con il tuo risparmio medio (${formatCurrency(sim.avgSaving)} al mese) la recuperi in meno di un mese.`
        : `Con il tuo risparmio medio (${formatCurrency(sim.avgSaving)} al mese) servono circa ${euro1(sim.monthsToRecover)} mesi per recuperarla.`;
  }
  const hasLimits = !!(sim.variable || sim.category);

  return `
    <div class="pad"><div class="sec-head"><span class="sec-title">Esito</span></div></div>
    <div class="card sim-verdict ${sim.level}">
      <div class="sim-v-title">${L.title}</div>
      <div class="sim-v-sub">${sim.reasons.length ? sim.reasons.map(escapeHtml).join(" ") : L.sub}</div>
      <div class="sim-v-cost tnum">${rate}</div>
    </div>

    <div class="pad"><div class="sec-head"><span class="sec-title">Impatto su ${monthLabel(sim.before.mk)}</span>${infoBtn("Prima → dopo la spesa simulata. Previsione, budget e risparmio sono calcolati con le stesse regole del resto dell'app: le rate pesano come quota mensile.")}</div></div>
    <div class="card">
      ${row("Spesa prevista", sim.before.projectedSpend, sim.after.projectedSpend)}
      ${sim.hasIncome ? row("Saldo previsto", sim.before.projectedBalance, sim.after.projectedBalance, { signed: true }) : ""}
      ${sim.hasIncome ? row("Tasso di risparmio", sim.rate.before, sim.rate.after, { fmt: pct, signed: true }) : ""}
      ${sim.variable ? row("Budget variabile residuo", sim.variable.residualBefore, sim.variable.residualAfter, { signed: true }) : ""}
      ${sim.variable ? row("…a fine mese (previsto)", sim.variable.projectedResidualBefore, sim.variable.projectedResidualAfter, { signed: true }) : ""}
      ${sim.category ? row(`Budget ${escapeHtml(sim.category.id)} residuo`, sim.category.residualBefore, sim.category.residualAfter, { signed: true }) : ""}
    </div>
    ${!sim.hasIncome && !hasLimits ? `<div class="sim-hint">Imposta l'entrata mensile e i budget in <b>Altro</b> per vedere anche l'impatto su saldo, risparmio e limiti.</div>` : ""}
    ${recover ? `<div class="sim-hint">${recover}</div>` : ""}
    <div class="sim-hint muted">Stima basata su ${sim.before.history.length} ${sim.before.history.length === 1 ? "mese" : "mesi"} di storico · affidabilità ${CONF[sim.before.confidence].toLowerCase()}.</div>`;
}

export function renderSimulator(el, expenses, callbacks) {
  const cats = expenseCategories();
  const presets = [1, 3, 6, 12, 24];
  el.innerHTML = `
    <div class="sim-layout">
      <div class="sim-in">
        <div class="pad"><div class="sec-head"><span class="sec-title">Simula una spesa</span>${infoBtn("Inserisci una spesa ipotetica (un telefono, una vacanza…) e vedi subito cosa cambierebbe a fine mese, sul budget e sul risparmio. Non viene salvato niente.")}</div></div>
        <div class="card pad-card">
          <label class="sim-field"><span>Importo (€)</span>
            <input id="sim-amount" type="text" inputmode="decimal" autocomplete="off" placeholder="es. 800" value="${escapeHtml(_sim.amount)}"></label>
          <div class="sim-live" id="sim-live" aria-live="polite"></div>
          <div class="sim-field"><span>Pagamento</span>
            <div class="sim-chips">${presets.map(n => `<button type="button" class="sim-chip ${_sim.installments === n ? "on" : ""}" data-inst="${n}">${n === 1 ? "Una tantum" : `${n} rate`}</button>`).join("")}
              <label class="sim-n-wrap"><span>N° rate</span><input id="sim-n" type="number" inputmode="numeric" min="1" max="120" step="1" value="${_sim.installments}" aria-label="Numero di rate"></label></div></div>
          <label class="sim-field"><span>Categoria (facoltativa)</span>
            <select id="sim-cat"><option value="">— nessuna —</option>${cats.map(c => `<option value="${escapeHtml(c.id)}" ${_sim.cat === c.id ? "selected" : ""}>${escapeHtml(c.id)}</option>`).join("")}</select></label>
        </div>
      </div>
      <div class="sim-out" id="sim-result"></div>
    </div>`;

  const out = el.querySelector("#sim-result");
  const update = () => {
    const sim = simulateExpense(expenses, { amount: parseAmount(_sim.amount), installments: _sim.installments, cat: _sim.cat }, {
      fixedIncome: Number(callbacks.getIncome?.()) || 0,
      varBudget: Number(callbacks.getVarBudget?.()) || 0,
      catBudgets: callbacks.getCatBudgets?.() || {},
    });
    out.innerHTML = sim ? simResultHtml(sim)
      : `<div class="pad"><div class="sec-head"><span class="sec-title">Esito</span></div></div><div class="card"><div class="empty"><span class="big">Inserisci un importo</span>Vedrai subito l'impatto su previsione, budget e risparmio.</div></div>`;
    // Riga sintetica sotto il campo importo: resta visibile anche con la tastiera aperta
    const live = el.querySelector("#sim-live");
    if (live) live.innerHTML = sim
      ? `<i class="dot ${sim.level}"></i><b>${LEVEL[sim.level].title}</b> · ${sim.hasIncome ? `saldo previsto ${formatCurrency(sim.after.projectedBalance)}` : `spesa prevista ${formatCurrency(sim.after.projectedSpend)}`}`
      : "";
  };
  const amountEl = /** @type {HTMLInputElement} */ (el.querySelector("#sim-amount"));
  const nEl = /** @type {HTMLInputElement} */ (el.querySelector("#sim-n"));
  const setN = n => { _sim.installments = Math.min(120, Math.max(1, Math.trunc(n) || 1)); };
  amountEl.addEventListener("input", () => { _sim.amount = amountEl.value; update(); });
  el.querySelectorAll("[data-inst]").forEach(b => b.addEventListener("click", () => {
    setN(Number(/** @type {HTMLElement} */ (b).dataset.inst)); nEl.value = String(_sim.installments);
    el.querySelectorAll("[data-inst]").forEach(x => x.classList.toggle("on", x === b)); update();
  }));
  nEl.addEventListener("input", () => {
    setN(Number(nEl.value));
    el.querySelectorAll("[data-inst]").forEach(x => x.classList.toggle("on", Number(/** @type {HTMLElement} */ (x).dataset.inst) === _sim.installments));
    update();
  });
  el.querySelector("#sim-cat")?.addEventListener("change", e => { _sim.cat = /** @type {HTMLSelectElement} */ (e.target).value; update(); });
  update();
}
