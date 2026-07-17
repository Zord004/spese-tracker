import { totalAmortizedThisMonth, totalSpent, categoryBreakdown, getCategoryById, totalRecurringMonthly, totalIncomeThisMonth, isIncome, isExpense, monthComparison, savingsRate, variableSpentThisMonth } from "../models.js";
import { escapeHtml, formatCurrency, formatDate } from "../utils.js";

export function renderHome(container, expenses, { onEditExpense, budget, varBudget, income, onNavigate }) {
  const amort = totalAmortizedThisMonth(expenses);
  const recur = totalRecurringMonthly(expenses);
  const monthCost = amort + recur;
  const cats = categoryBreakdown(expenses);
  const maxCat = Math.max(...cats.map(c => c.total), 1);
  const recent = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);
  const comp = monthComparison(expenses);
  const incomeMonth = totalIncomeThisMonth(expenses);
  const totalIncomeM = income + incomeMonth;

  let deltaHtml = "";
  if (comp.previous > 0) {
    const pct = ((comp.current - comp.previous) / comp.previous) * 100;
    const cls = pct > 0 ? "up" : "down";
    const arrow = pct > 0 ? "↑" : "↓";
    deltaHtml = `<span class="chip-delta ${cls}">${arrow} ${Math.abs(pct).toFixed(0)}%</span>
      <span>rispetto a mese scorso (${formatCurrency(comp.previous)})</span>`;
  } else {
    deltaHtml = `<span>${expenses.filter(isExpense).length} spese registrate in totale</span>`;
  }

  // Terza cella del ledger
  let thirdCell;
  if (totalIncomeM > 0) {
    const saved = totalIncomeM - monthCost;
    thirdCell = `<div class="cell"><div class="lbl">Risparmio</div><div class="val tnum" style="color:${saved >= 0 ? "var(--credit)" : "var(--debit)"}">${formatCurrency(saved)}</div></div>`;
  } else if (budget > 0) {
    const remaining = budget - monthCost;
    thirdCell = `<div class="cell"><div class="lbl">Budget res.</div><div class="val tnum" style="color:${remaining >= 0 ? "var(--ink)" : "var(--debit)"}">${formatCurrency(remaining)}</div></div>`;
  } else {
    thirdCell = `<div class="cell"><div class="lbl">Movimenti</div><div class="val tnum">${expenses.length}</div></div>`;
  }

  // Barra budget spesa variabile
  let budgetBar = "";
  if (varBudget > 0) {
    const varSpent = variableSpentThisMonth(expenses);
    const ratio = Math.min(1, varSpent / varBudget);
    const pct = (varSpent / varBudget) * 100;
    const over = varSpent > varBudget;
    const near = pct >= 85 && !over;
    const col = over ? "var(--debit)" : near ? "var(--brass)" : "var(--navy)";
    budgetBar = `
      <div class="budget-bar">
        <div class="budget-bar-top">
          <span class="budget-bar-lbl">Spesa variabile</span>
          <span class="budget-bar-val tnum" style="${over ? "color:var(--debit)" : ""}">${formatCurrency(varSpent)} / ${formatCurrency(varBudget)}</span>
        </div>
        <div class="budget-track"><div class="budget-fill" style="width:${ratio * 100}%;background:${col}"></div></div>
        ${over ? `<div class="budget-over">Superato di ${formatCurrency(varSpent - varBudget)}</div>` : ""}
      </div>`;
  }

  container.innerHTML = `
    <div class="statement">
      <div class="eyebrow">Spesa del mese</div>
      <div class="figure tnum">${formatCurrency(monthCost)}</div>
      <div class="brass-rule"></div>
      <div class="sub">${deltaHtml}</div>
      ${budgetBar}
      <div class="ledger-3">
        <div class="cell"><div class="lbl">Ammortizz.</div><div class="val tnum">${formatCurrency(amort)}</div></div>
        <div class="cell"><div class="lbl">Ricorrenti</div><div class="val tnum">${formatCurrency(recur)}</div></div>
        ${thirdCell}
      </div>
    </div>

    ${totalIncomeM > 0 ? `
      <div class="pad"><div class="sec-head"><span class="sec-title">Entrate del mese</span></div></div>
      <div class="card pad-card">
        <div class="income-box">
          <div>
            <div class="eyebrow" style="color:var(--credit)">Accreditato</div>
            <div class="big tnum">${formatCurrency(totalIncomeM)}</div>
          </div>
          <div class="side">
            ${income > 0 ? `<div>Fissa <b class="tnum">${formatCurrency(income)}</b></div>` : ""}
            ${incomeMonth > 0 ? `<div>Occasionali <b class="tnum">${formatCurrency(incomeMonth)}</b></div>` : ""}
          </div>
        </div>
      </div>
    ` : ""}

    ${cats.length ? `
      <div class="pad"><div class="sec-head"><span class="sec-title">Ripartizione</span><button class="sec-link" data-nav="analytics">Dettaglio →</button></div></div>
      <div class="card">
        ${cats.slice(0, 5).map(c => `
          <div class="catrow">
            <div class="catrow-top">
              <div class="catrow-name"><span class="swatch" style="background:${c.color}"></span><span>${escapeHtml(c.id)}</span></div>
              <div class="catrow-amt tnum">${formatCurrency(c.total)}</div>
            </div>
            <div class="track"><div class="fill" style="width:${(c.total / maxCat) * 100}%;background:${c.color}"></div></div>
          </div>
        `).join("")}
      </div>
    ` : ""}

    <div class="pad"><div class="sec-head"><span class="sec-title">Ultimi movimenti</span>${expenses.length ? `<button class="sec-link" data-nav="list">Tutti →</button>` : ""}</div></div>
    ${!expenses.length ? `
      <div class="card"><div class="empty"><span class="big">Nessun movimento</span>Tocca + per registrare la prima voce.</div></div>
    ` : `
      <div class="card">${recent.map(e => renderRow(e)).join("")}</div>
    `}
  `;

  container.querySelectorAll("[data-edit]").forEach(el => el.addEventListener("click", () => onEditExpense(el.dataset.edit)));
  container.querySelectorAll("[data-nav]").forEach(el => el.addEventListener("click", () => onNavigate(el.dataset.nav)));
}

function renderRow(e) {
  const inc = isIncome(e);
  const c = getCategoryById(e.cat, inc ? "entrata" : "spesa");
  const initial = (e.name || "?").trim().charAt(0).toUpperCase();
  const tags = [];
  if (e.am > 1) tags.push(`rate ${e.am}m`);
  else if (e.recur && e.recur !== "Nessuna") tags.push(recurLabel(e.recur));
  if (e.detraibile) tags.push(`detr. ${e.detrazionePct}%`);
  const tag = tags.length ? `<span class="tx-tag">${escapeHtml(tags[0])}</span>` : "";

  return `<div class="txrow" data-edit="${escapeHtml(e.id)}">
    <div class="tx-ico" ${inc ? 'style="color:var(--credit)"' : ""}>${escapeHtml(initial)}<span class="cat-dot" style="background:${c.color}"></span></div>
    <div class="tx-main">
      <div class="tx-name">${escapeHtml(e.name)}${tag}</div>
      <div class="tx-meta">${formatDate(e.date)} · ${escapeHtml(e.cat)}${e.location ? ` · ${escapeHtml(e.location)}` : ""}</div>
    </div>
    <div class="tx-amt">
      <div class="a ${inc ? "credit" : ""} tnum">${inc ? "+ " : ""}${formatCurrency(e.amount)}</div>
      ${e.am > 1 ? `<div class="s tnum">${formatCurrency(e.amount / e.am)}/mese</div>` : ""}
    </div>
  </div>`;
}

function recurLabel(r) {
  if (r === "Giornaliera") return "giorn.";
  if (r === "Mensile") return "mens.";
  if (r === "Trimestrale") return "trim.";
  if (r === "Annuale") return "annuale";
  if (typeof r === "string" && r.startsWith("Ogni")) return r.replace("Ogni ", "").replace(" mesi", "m");
  return r;
}
