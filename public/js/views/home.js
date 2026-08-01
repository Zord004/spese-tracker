import { totalAmortizedThisMonth, categoryBreakdown, getCategoryById, totalRecurringMonthly, totalIncomeThisMonth, isIncome, isExpense, monthComparison, variableSpentThisMonth, balanceProjection, categoryBudgetStatus, monthTotal } from "../models.js";
import { escapeHtml, formatCurrency, formatDate, currentMonthKey } from "../utils.js";
import { attachSwipe, swipeWrap } from "../swipe.js";

export function renderHome(container, expenses, { onEditExpense, onDelete, onClone, onQuickAmount, budget, varBudget, catBudgets, income, onNavigate }) {
  const amort = totalAmortizedThisMonth(expenses);
  const recur = totalRecurringMonthly(expenses);
  const monthCost = monthTotal(expenses, currentMonthKey());
  const cats = categoryBreakdown(expenses);
  const maxCat = Math.max(...cats.map(c => c.total), 1);
  const recent = [...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6);
  const comp = monthComparison(expenses);
  const incomeMonth = totalIncomeThisMonth(expenses);
  const totalIncomeM = income + incomeMonth;
  const proj = balanceProjection(expenses, income);

  let deltaHtml = "";
  if (comp.previous > 0) {
    const pct = ((comp.current - comp.previous) / comp.previous) * 100;
    const cls = pct > 0 ? "up" : "down";
    const arrow = pct > 0 ? "↑" : "↓";
    deltaHtml = `<span class="chip-delta ${cls}">${arrow} ${Math.abs(pct).toFixed(0)}%</span><span>rispetto a mese scorso (${formatCurrency(comp.previous)})</span>`;
  } else {
    deltaHtml = `<span>${expenses.filter(isExpense).length} spese registrate in totale</span>`;
  }

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

  // Budget per categoria (solo quelle con un tetto impostato)
  const budgetStatus = categoryBudgetStatus(expenses, catBudgets || {});
  let catBudgetSection = "";
  if (budgetStatus.length) {
    const overCount = budgetStatus.filter(b => b.state === "over").length;
    catBudgetSection = `
      <div class="pad"><div class="sec-head"><span class="sec-title">Budget categorie</span>${overCount ? `<span class="sec-warn">${overCount} sforat${overCount === 1 ? "o" : "i"}</span>` : ""}</div></div>
      <div class="card">
        ${budgetStatus.map(b => `
          <div class="catrow">
            <div class="catrow-top">
              <div class="catrow-name"><span class="swatch" style="background:${b.color}"></span><span>${escapeHtml(b.id)}</span></div>
              <div class="catrow-amt tnum ${b.state}">${formatCurrency(b.spent)} <span class="of">/ ${formatCurrency(b.limit)}</span></div>
            </div>
            <div class="track"><div class="fill bud-${b.state}" style="width:${b.ratio * 100}%"></div></div>
            <div class="catrow-note ${b.state}">${b.state === "over"
              ? `Sforato di ${formatCurrency(b.spent - b.limit)}`
              : `Restano ${formatCurrency(b.remaining)} · ${b.pct.toFixed(0)}% usato`}</div>
          </div>
        `).join("")}
      </div>`;
  }

  // Card proiezione saldo fine mese (solo se conosciamo un'entrata)
  let projCard = "";
  if (proj.incomeExpected > 0) {
    const b = proj.projectedBalance;
    projCard = `
      <div class="pad"><div class="sec-head"><span class="sec-title">Proiezione fine mese</span></div></div>
      <div class="card pad-card">
        <div class="proj">
          <div>
            <div class="eyebrow">Saldo previsto</div>
            <div class="proj-fig tnum" style="color:${b >= 0 ? "var(--credit)" : "var(--debit)"}">${b >= 0 ? "+" : ""}${formatCurrency(b)}</div>
          </div>
          <div class="proj-side">
            <div>Entrate <b class="tnum">${formatCurrency(proj.incomeExpected)}</b></div>
            <div>Spese finora <b class="tnum">${formatCurrency(proj.spentSoFar)}</b></div>
            ${proj.upcoming > 0 ? `<div>Ancora da pagare <b class="tnum">${formatCurrency(proj.upcoming)}</b></div>` : ""}
          </div>
        </div>
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

    ${projCard}

    ${catBudgetSection}

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
      <div class="card row-swipes">${recent.map(e => swipeWrap(e.id, rowInner(e))).join("")}</div>
    `}
  `;

  container.querySelectorAll("[data-nav]").forEach(el => el.addEventListener("click", () => onNavigate(el.dataset.nav)));
  const swipes = container.querySelector(".row-swipes");
  if (swipes) attachSwipe(swipes, { onEdit: onEditExpense, onDelete, onClone, onQuickAmount });
}

export function rowInner(e) {
  const inc = isIncome(e);
  const c = getCategoryById(e.cat, inc ? "entrata" : "spesa");
  const initial = (e.name || "?").trim().charAt(0).toUpperCase();
  const tags = [];
  if (e.am > 1) tags.push(`rate ${e.am}m`);
  else if (e.recur && e.recur !== "Nessuna") tags.push(recurLabel(e.recur));
  if (e.detraibile) tags.push(`detr. ${e.detrazionePct}%`);
  const tag = tags.length ? `<span class="tx-tag">${escapeHtml(tags[0])}</span>` : "";
  const foreign = e.currency && e.currency !== "EUR" && e.originalAmount != null;
  const sub = e.am > 1 ? `${formatCurrency(e.amount / e.am)}/mese` : (foreign ? `${formatNum(e.originalAmount)} ${escapeHtml(e.currency)}` : "");

  return `<div class="txrow">
    <div class="tx-ico" ${inc ? 'style="color:var(--credit)"' : ""}>${escapeHtml(initial)}<span class="cat-dot" style="background:${c.color}"></span></div>
    <div class="tx-main">
      <div class="tx-name">${escapeHtml(e.name)}${tag}</div>
      <div class="tx-meta">${formatDate(e.date)} · ${escapeHtml(e.cat)}${e.location ? ` · ${escapeHtml(e.location)}` : ""}</div>
    </div>
    <div class="tx-amt">
      <div class="a qa ${inc ? "credit" : ""} tnum" data-qa title="Tocca per modificare l'importo">${inc ? "+ " : ""}${formatCurrency(e.amount)}</div>
      ${sub ? `<div class="s tnum">${sub}</div>` : ""}
    </div>
  </div>`;
}

function formatNum(n) { return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 }).format(n); }

function recurLabel(r) {
  if (r === "Giornaliera") return "giorn.";
  if (r === "Mensile") return "mens.";
  if (r === "Trimestrale") return "trim.";
  if (r === "Annuale") return "annuale";
  if (typeof r === "string" && r.startsWith("Ogni")) return r.replace("Ogni ", "").replace(" mesi", "m");
  return r;
}
