import {
  totalAmortizedThisMonth,
  totalSpent,
  categoryBreakdown,
  getCategoryById,
} from "../models.js";
import { formatCurrency, formatDate, progressBar } from "../utils.js";

/**
 * Render the dashboard view into the given container.
 * @param {HTMLElement} container
 * @param {Array} expenses
 * @param {function} onEditExpense - callback(id)
 */
export function renderDashboard(container, expenses, { onEditExpense }) {
  const amort = totalAmortizedThisMonth(expenses);
  const total = totalSpent(expenses);
  const cats = categoryBreakdown(expenses);
  const maxCat = Math.max(...cats.map((c) => c.total), 1);

  // Sorted by date descending for "recent"
  const recent = [...expenses]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6);

  let html = `
    <div class="card">
      <div class="lbl">Costo ammortizzato / mese</div>
      <div class="big">${formatCurrency(amort)}</div>
      <div class="sub o">Totale speso: ${formatCurrency(total)} · ${expenses.length} ${expenses.length === 1 ? "spesa" : "spese"}</div>
    </div>

    <div class="card">
      <div class="lbl" style="margin-bottom:12px">Per categoria</div>
      ${cats.length === 0 ? '<div class="empty">Nessuna spesa registrata</div>' : ""}
      ${cats.map((c) => `
        <div class="cat-row">
          <div class="cat-row-header">
            <span>${c.icon} ${c.id}</span>
            <span class="o" style="font-size:12px;color:rgba(255,255,255,0.35)">
              ${c.amortMonth > 0 ? `<span style="color:${c.color};font-weight:600">${formatCurrency(c.amortMonth)}/m</span> · ` : ""}${formatCurrency(c.total)}
            </span>
          </div>
          ${progressBar(c.total / maxCat, c.color)}
        </div>
      `).join("")}
    </div>

    <div class="card">
      <div class="lbl" style="margin-bottom:8px">Ultime spese</div>
      ${expenses.length === 0 ? '<div class="empty">Tocca + per iniziare</div>' : ""}
      ${recent.map((e) => {
        const c = getCategoryById(e.cat);
        return `
          <div class="exp-row" data-id="${e.id}">
            <div class="exp-row-left">
              <span class="exp-icon">${c.icon}</span>
              <div>
                <div class="exp-name">${e.name}</div>
                <div class="exp-meta o">${formatDate(e.date)}${e.am > 1 ? ` · ${e.am}m` : ""}</div>
              </div>
            </div>
            <div class="exp-row-right">
              <div class="exp-amount o">${formatCurrency(e.amount)}</div>
              ${e.am > 1 ? `<div class="exp-monthly o" style="color:${c.color}">${formatCurrency(e.amount / e.am)}/m</div>` : ""}
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;

  container.innerHTML = html;

  // Bind click events
  container.querySelectorAll(".exp-row[data-id]").forEach((row) => {
    row.addEventListener("click", () => onEditExpense(row.dataset.id));
  });
}
