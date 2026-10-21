import { categoryBreakdown, monthlySpendingTrend, monthComparison, averageMonthlySpending, topExpenses, getCategoryById, fixedVsVariable, taxReport, totalIncomeThisMonth, savingsRate, savingsRateTrend, amortizationTimeline, activeAmortizations, recurringExpenses, recurringMonthlyCost, costPerUse, isExpense, locationBreakdown, monthTotal } from "../models.js";
import { escapeHtml, formatCurrency, currentMonthKey, monthShort, monthLabel, currentYear, infoBtn } from "../utils.js";
import { renderForecast, renderSimulator } from "./forecast.js";
import { groupBlocks } from "../layout.js";

let _tab = "overview";
/** Apre una scheda dell'Analisi al prossimo rendering (usato dai link della Home). @param {string} t */
export function setAnalyticsTab(t) { _tab = t; }
let _periodMk = null; // mese selezionato nella Panoramica (default: mese corrente)
function shiftMonth(mk, delta) { const [y, m] = mk.split("-").map(Number); const d = new Date(y, m - 1 + delta, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }

// Tooltip condiviso per i grafici: un tap su una fetta o una barra mostra i
// dettagli. Vive fuori dal contenuto (che viene ri-renderizzato), così il
// listener si registra una sola volta.
let _tipEl;
function ensureChartTip() {
  if (_tipEl) return;
  _tipEl = document.createElement("div");
  _tipEl.className = "chart-tip hidden";
  document.body.appendChild(_tipEl);
  document.addEventListener("click", (e) => {
    const target = /** @type {Element} */ (e.target);
    const el = target && target.closest && target.closest("[data-tip]");
    if (el) {
      _tipEl.textContent = el.getAttribute("data-tip");
      _tipEl.classList.remove("hidden");
      const r = el.getBoundingClientRect(), tr = _tipEl.getBoundingClientRect();
      let left = r.left + r.width / 2 - tr.width / 2;
      left = Math.max(8, Math.min(left, window.innerWidth - tr.width - 8));
      let top = r.top - tr.height - 10;
      if (top < 8) top = r.bottom + 10;
      _tipEl.style.left = left + "px";
      _tipEl.style.top = top + "px";
      e.stopPropagation();
    } else {
      _tipEl.classList.add("hidden");
    }
  });
}

export function renderAnalytics(container, expenses, callbacks) {
  ensureChartTip();
  container.innerHTML = `
    <div class="subtabs">
      <button class="subtab ${_tab === "overview" ? "on" : ""}" data-tab="overview">Panoramica</button>
      <button class="subtab ${_tab === "forecast" ? "on" : ""}" data-tab="forecast">Previsione</button>
      <button class="subtab ${_tab === "sim" ? "on" : ""}" data-tab="sim">Simulatore</button>
      <button class="subtab ${_tab === "trend" ? "on" : ""}" data-tab="trend">Andamento</button>
      <button class="subtab ${_tab === "amort" ? "on" : ""}" data-tab="amort">Ammortam.</button>
      <button class="subtab ${_tab === "tax" ? "on" : ""}" data-tab="tax">Fiscale</button>
    </div>
    <div id="tab-content"></div>
  `;
  container.querySelectorAll(".subtab").forEach(t => t.addEventListener("click", () => { _tab = t.dataset.tab; renderAnalytics(container, expenses, callbacks); }));
  const content = container.querySelector("#tab-content");
  content.classList.toggle("cols", ["overview", "trend", "forecast"].includes(_tab));
  const goTab = t => { _tab = t; renderAnalytics(container, expenses, callbacks); };
  if (_tab === "overview") { renderOverview(content, expenses, callbacks); groupBlocks(content); }
  else if (_tab === "forecast") renderForecast(content, expenses, { ...callbacks, goTab });
  else if (_tab === "sim") renderSimulator(content, expenses, callbacks);
  else if (_tab === "trend") { renderTrend(content, expenses, callbacks); groupBlocks(content); }
  else if (_tab === "amort") renderAmort(content, expenses);
  else if (_tab === "tax") renderTax(content, expenses, callbacks);
}

function renderOverview(el, expenses, callbacks) {
  if (!_periodMk) _periodMk = currentMonthKey();
  const isCurrentPeriod = _periodMk >= currentMonthKey();
  const cats = categoryBreakdown(expenses, _periodMk);
  const total = cats.reduce((s, c) => s + c.total, 0);
  const fv = fixedVsVariable(expenses);
  const totalIncome = (callbacks?.getIncome?.() || 0) + totalIncomeThisMonth(expenses);
  const monthCost = monthTotal(expenses, currentMonthKey());
  const sr = savingsRate(totalIncome, monthCost);
  const top = topExpenses(expenses, 5);
  const places = locationBreakdown(expenses).slice(0, 5);

  el.innerHTML = `
    ${totalIncome > 0 ? `
      <div class="pad"><div class="sec-head"><span class="sec-title">Salute finanziaria</span>${infoBtn("Savings rate: quota del reddito che NON hai speso questo mese. Fissi/mese e Variabili/mese: la tua spesa mensile ricorrente e quella occasionale.")}</div></div>
      <div class="card pad-card">
        <div class="stat-3">
          <div class="s"><div class="l">Savings rate</div><div class="v tnum" style="color:${sr >= 20 ? "var(--credit)" : sr >= 10 ? "var(--brass)" : "var(--debit)"}">${sr.toFixed(0)}%</div></div>
          <div class="s"><div class="l">Fissi/mese</div><div class="v tnum">${formatCurrency(fv.fixedMonthly)}</div></div>
          <div class="s"><div class="l">Variab./mese</div><div class="v tnum">${formatCurrency(fv.variableMonthly)}</div></div>
        </div>
      </div>
    ` : ""}

    ${expenses.filter(isExpense).length ? `
      <div class="pad"><div class="sec-head">
        <span class="sec-title">Per categoria</span>${infoBtn("Spesa divisa per categoria nel mese selezionato. Il totale coincide con la spesa di quel mese. Ricorrenti e ammortamenti contano come quota mensile. Usa le frecce per cambiare mese.")}
        <div class="period-nav">
          <button class="pnav" data-period="prev" aria-label="Mese precedente">‹</button>
          <span class="period-label">${monthLabel(_periodMk)}</span>
          <button class="pnav" data-period="next" aria-label="Mese successivo"${isCurrentPeriod ? " disabled" : ""}>›</button>
        </div>
      </div></div>
      ${cats.length ? `
        <div class="card pad-card">
          ${donut(cats)}
        </div>
        <div class="card" style="margin-top:12px">
          ${cats.map(c => `
            <div class="catrow">
              <div class="catrow-top">
                <div class="catrow-name"><span class="swatch" style="background:${c.color}"></span><span>${escapeHtml(c.id)}</span><span class="pct">${((c.total / total) * 100).toFixed(0)}%</span></div>
                <div class="catrow-amt tnum">${formatCurrency(c.total)}</div>
              </div>
              <div class="track"><div class="fill" style="width:${(c.total / (cats[0].total || 1)) * 100}%;background:${c.color}"></div></div>
            </div>
          `).join("")}
        </div>
      ` : `<div class="card"><div class="empty"><span class="big">Nessuna spesa</span>In ${monthLabel(_periodMk)} non risultano spese. Cambia mese con le frecce.</div></div>`}
    ` : `<div class="card" style="margin-top:12px"><div class="empty"><span class="big">Nessun dato</span>Aggiungi movimenti per vedere le statistiche.</div></div>`}

    ${top.length ? `
      <div class="pad"><div class="sec-head"><span class="sec-title">Spese maggiori</span></div></div>
      <div class="card">
        ${top.map((e, i) => {
          const c = getCategoryById(e.cat);
          return `<div class="txrow">
            <div class="tx-ico">${i + 1}<span class="cat-dot" style="background:${c.color}"></span></div>
            <div class="tx-main"><div class="tx-name">${escapeHtml(e.name)}</div><div class="tx-meta">${escapeHtml(e.cat)}</div></div>
            <div class="tx-amt"><div class="a tnum">${formatCurrency(e.amount)}</div></div>
          </div>`;
        }).join("")}
      </div>
    ` : ""}

    ${places.length ? `
      <div class="pad"><div class="sec-head"><span class="sec-title">Luoghi</span></div></div>
      <div class="card">
        ${places.map(l => `<div class="txrow"><div class="tx-main"><div class="tx-name">${escapeHtml(l.location)}</div><div class="tx-meta">${l.count} ${l.count === 1 ? "spesa" : "spese"}</div></div><div class="tx-amt"><div class="a tnum">${formatCurrency(l.total)}</div></div></div>`).join("")}
      </div>
    ` : ""}
  `;

  // Navigatore mese per la sezione "Per categoria"
  el.querySelectorAll("[data-period]").forEach(b => b.addEventListener("click", () => {
    if (b.hasAttribute("disabled")) return;
    _periodMk = shiftMonth(_periodMk, b.dataset.period === "prev" ? -1 : 1);
    renderOverview(el, expenses, callbacks); groupBlocks(el);
  }));
}

function renderTrend(el, expenses, callbacks) {
  const spending = monthlySpendingTrend(expenses, 6);
  const comp = monthComparison(expenses);
  const avg = averageMonthlySpending(expenses, 6);
  const nowMK = currentMonthKey();
  const max = Math.max(...spending.map(s => s.total), 1);
  const fixedIncome = callbacks?.getIncome?.() || 0;
  const srTrend = savingsRateTrend(expenses, fixedIncome, 6);
  const hasSR = srTrend.some(s => s.rate !== null);

  el.innerHTML = `
    <div class="pad"><div class="sec-head"><span class="sec-title">Spesa · ultimi 6 mesi</span>${infoBtn("Spesa totale imputata a ciascun mese. Le ricorrenti (abbonamenti, affitto) e le rate degli ammortamenti sono incluse come quota mensile, non solo nel mese d'acquisto.")}</div></div>
    <div class="card pad-card">
      <div class="bars">
        ${spending.map(s => {
          const tip = `${monthLabel(s.mk)} · ${formatCurrency(s.total)}`;
          return `
          <div class="bar-wrap">
            <div class="bar-val tnum">${s.total > 0 ? formatCurrency(s.total) : ""}</div>
            <div class="bar-col"><div class="bar ${s.mk === nowMK ? "now" : ""}" style="height:${Math.max(2, (s.total / max) * 100)}%" data-tip="${escapeHtml(tip)}" title="${escapeHtml(tip)}"></div></div>
            <div class="bar-lbl">${monthShort(s.mk)}</div>
          </div>
        `; }).join("")}
      </div>
    </div>

    ${hasSR ? `
      <div class="pad"><div class="sec-head"><span class="sec-title">Tasso di risparmio · ultimi 6 mesi</span>${infoBtn("Per ogni mese, la percentuale di reddito non spesa. Verde = stai risparmiando bene, rosso = poco. Richiede l'entrata mensile impostata in Altro.")}</div></div>
      <div class="card pad-card">
        <div class="bars">
          ${srTrend.map(s => {
            const r = s.rate;
            const h = r === null ? 0 : Math.max(2, r);
            const col = r === null ? "var(--line-2)" : r >= 20 ? "var(--credit)" : r >= 10 ? "var(--brass)" : "var(--debit)";
            const tip = r === null ? `${monthLabel(s.mk)} · dati insufficienti`
              : `${monthLabel(s.mk)} · risparmio ${r.toFixed(0)}% · entrate ${formatCurrency(s.income)} · spese ${formatCurrency(s.spent)}`;
            return `<div class="bar-wrap">
              <div class="bar-val tnum">${r === null ? "—" : r.toFixed(0) + "%"}</div>
              <div class="bar-col"><div class="bar" style="height:${h}%;background:${col}" data-tip="${escapeHtml(tip)}" title="${escapeHtml(tip)}"></div></div>
              <div class="bar-lbl">${monthShort(s.mk)}</div>
            </div>`;
          }).join("")}
        </div>
        <div class="dim" style="font-size:11px;color:var(--ink-3);text-align:center;margin-top:10px">Percentuale di reddito non spesa. Richiede l'entrata mensile impostata in Altro.</div>
      </div>
    ` : `
      <div class="pad"><div class="sec-head"><span class="sec-title">Tasso di risparmio</span></div></div>
      <div class="card"><div class="empty"><span class="big">Imposta l'entrata mensile</span>Vai in Altro → Finanze per vedere il tasso di risparmio nel tempo.</div></div>
    `}

    <div class="pad"><div class="sec-head"><span class="sec-title">Confronto</span></div></div>
    <div class="card pad-card">
      <div class="stat-3">
        <div class="s"><div class="l">Questo mese</div><div class="v tnum">${formatCurrency(comp.current)}</div></div>
        <div class="s"><div class="l">Mese scorso</div><div class="v tnum">${formatCurrency(comp.previous)}</div></div>
        <div class="s"><div class="l">Media 6m</div><div class="v tnum">${formatCurrency(avg)}</div></div>
      </div>
    </div>
  `;
}

function renderAmort(el, expenses) {
  const timeline = amortizationTimeline(expenses);
  const active = activeAmortizations(expenses);
  const recurring = recurringExpenses(expenses);
  const nowMK = currentMonthKey();
  const maxVal = Math.max(...timeline.map(([, v]) => v), 1);
  const cpwItems = expenses.filter(e => isExpense(e) && (parseInt(e.utilizzi) || 0) > 0).sort((a, b) => (costPerUse(a) || Infinity) - (costPerUse(b) || Infinity));

  el.innerHTML = `
    ${timeline.length ? `
      <div class="pad"><div class="sec-head"><span class="sec-title">Piano ammortamenti</span></div></div>
      <div class="card pad-card">
        ${timeline.slice(0, 12).map(([mk, v]) => {
          const cur = mk === nowMK;
          return `<div class="catrow" style="padding-left:0;padding-right:0">
            <div class="catrow-top">
              <span style="font-size:13px;color:${cur ? "var(--ink)" : "var(--ink-2)"};font-weight:${cur ? "600" : "400"}">${monthLabel(mk)}${cur ? " · in corso" : ""}</span>
              <span class="catrow-amt tnum">${formatCurrency(v)}</span>
            </div>
            <div class="track"><div class="fill" style="width:${(v / maxVal) * 100}%;background:${cur ? "var(--brass)" : "var(--navy)"}"></div></div>
          </div>`;
        }).join("")}
      </div>
    ` : ""}

    ${active.length ? `
      <div class="pad"><div class="sec-head"><span class="sec-title">Attivi questo mese</span></div></div>
      <div class="card">
        ${active.map(e => {
          const c = getCategoryById(e.cat);
          const initial = (e.name || "?").charAt(0).toUpperCase();
          return `<div class="txrow"><div class="tx-ico">${escapeHtml(initial)}<span class="cat-dot" style="background:${c.color}"></span></div><div class="tx-main"><div class="tx-name">${escapeHtml(e.name)}</div><div class="tx-meta">${escapeHtml(e.cat)} · ${e.am} mesi</div></div><div class="tx-amt"><div class="a tnum">${formatCurrency(e.amount / e.am)}/m</div><div class="s tnum">tot ${formatCurrency(e.amount)}</div></div></div>`;
        }).join("")}
      </div>
    ` : ""}

    ${recurring.length ? `
      <div class="pad"><div class="sec-head"><span class="sec-title">Ricorrenti</span></div></div>
      <div class="card">
        ${recurring.map(e => {
          const inc = e.type === "entrata";
          const c = getCategoryById(e.cat, inc ? "entrata" : "spesa");
          const initial = (e.name || "?").charAt(0).toUpperCase();
          return `<div class="txrow"><div class="tx-ico" ${inc ? 'style="color:var(--credit)"' : ""}>${escapeHtml(initial)}<span class="cat-dot" style="background:${c.color}"></span></div><div class="tx-main"><div class="tx-name">${escapeHtml(e.name)}</div><div class="tx-meta">${escapeHtml(e.recur)}</div></div><div class="tx-amt"><div class="a ${inc ? "credit" : ""} tnum">${inc ? "+ " : ""}${formatCurrency(recurringMonthlyCost(e))}/m</div></div></div>`;
        }).join("")}
      </div>
    ` : ""}

    ${cpwItems.length ? `
      <div class="pad"><div class="sec-head"><span class="sec-title">Costo per utilizzo</span></div></div>
      <div class="card">
        ${cpwItems.slice(0, 10).map(e => {
          const c = getCategoryById(e.cat);
          const cpw = costPerUse(e);
          const col = cpw < 1 ? "var(--credit)" : cpw < 10 ? "var(--brass)" : "var(--ink)";
          const initial = (e.name || "?").charAt(0).toUpperCase();
          return `<div class="txrow"><div class="tx-ico">${escapeHtml(initial)}<span class="cat-dot" style="background:${c.color}"></span></div><div class="tx-main"><div class="tx-name">${escapeHtml(e.name)}</div><div class="tx-meta">${formatCurrency(e.amount)} ÷ ${e.utilizzi} usi</div></div><div class="tx-amt"><div class="a tnum" style="color:${col}">${formatCurrency(cpw)}</div></div></div>`;
        }).join("")}
      </div>
    ` : ""}

    ${!timeline.length && !active.length && !recurring.length && !cpwItems.length ? `
      <div class="card" style="margin-top:12px"><div class="empty"><span class="big">Niente da mostrare</span>Aggiungi spese con ammortamento o ricorrenza.</div></div>
    ` : ""}
  `;
}

function renderTax(el, expenses, callbacks) {
  const year = currentYear();
  const t = taxReport(expenses, year);
  const hasData = t.allExpenses.length > 0 || t.incomeItems.length > 0;

  el.innerHTML = `
    <div class="pad"><div class="sec-head"><span class="sec-title">Bilancio ${year}</span></div></div>
    ${!hasData ? `
      <div class="card"><div class="empty"><span class="big">Nessun dato per ${year}</span>Aggiungi spese o entrate.</div></div>
    ` : `
      <div style="margin:0 var(--pad)">
        <div class="tax-balance">
          <div class="cell"><div class="l">Entrate</div><div class="v tnum" style="color:var(--credit)">${formatCurrency(t.totalIncome)}</div></div>
          <div class="cell"><div class="l">Uscite</div><div class="v tnum">${formatCurrency(t.totalAllSpent)}</div></div>
          <div class="cell"><div class="l">Bilancio</div><div class="v tnum" style="color:${t.balance >= 0 ? "var(--credit)" : "var(--debit)"}">${t.balance >= 0 ? "+" : ""}${formatCurrency(t.balance)}</div></div>
        </div>
      </div>

      ${t.totalDeduction > 0 ? `
        <div class="pad"><div class="sec-head"><span class="sec-title">Detrazioni</span></div></div>
        <div class="credit-card">
          <div class="cc-eye">Credito d'imposta stimato</div>
          <div class="cc-fig tnum"><span class="cur">€</span> ${formatCurrency(t.totalDeduction).replace("€", "").trim()}</div>
          <div class="cc-sub">su ${formatCurrency(t.totalSpent)} di spese detraibili · ${t.items.length} voci</div>
        </div>
      ` : ""}

      <div style="padding:20px var(--pad) 0">
        <button class="btn btn-primary" id="open-tax-report">Report per il commercialista</button>
      </div>
    `}
  `;
  el.querySelector("#open-tax-report")?.addEventListener("click", () => callbacks?.onOpenTaxReport?.());
}

function donut(cats) {
  const total = cats.reduce((s, c) => s + c.total, 0);
  if (!total) return "";
  const size = 180, cx = size / 2, cy = size / 2, r = size * 0.36, sw = size * 0.10;
  const circ = 2 * Math.PI * r;
  let off = 0;
  const segs = cats.map(c => {
    const dl = (c.total / total) * circ;
    const pct = ((c.total / total) * 100).toFixed(0);
    const tip = `${c.id} · ${formatCurrency(c.total)} · ${pct}%`;
    const s = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c.color}" stroke-width="${sw}" stroke-dasharray="${dl} ${circ - dl}" stroke-dashoffset="${-off}" transform="rotate(-90 ${cx} ${cy})" data-tip="${escapeHtml(tip)}" style="cursor:pointer"><title>${escapeHtml(tip)}</title></circle>`;
    off += dl;
    return s;
  });
  return `<svg viewBox="0 0 ${size} ${size}" class="donut-svg">
    ${segs.join("")}
    <text x="${cx}" y="${cy - 3}" text-anchor="middle" fill="var(--ink)" font-family="Libre Franklin" font-weight="700" font-size="19">${formatCurrency(total)}</text>
    <text x="${cx}" y="${cy + 15}" text-anchor="middle" fill="var(--ink-3)" font-family="Inter" font-size="9" letter-spacing="1">TOTALE</text>
  </svg>`;
}
