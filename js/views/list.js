import { CATEGORIES } from "../constants.js";
import {
  getCategoryById,
  amortizationProgress,
} from "../models.js";
import { formatCurrency, formatDate, progressBar } from "../utils.js";

/**
 * Render the expense list view.
 * @param {HTMLElement} container
 * @param {Array} expenses
 * @param {string} filterCat - "all" or category id
 * @param {object} callbacks - { onEditExpense, onDeleteExpense, onFilterChange }
 */
export function renderList(container, expenses, filterCat, callbacks) {
  const filtered =
    filterCat === "all"
      ? expenses
      : expenses.filter((e) => e.cat === filterCat);
  const sorted = [...filtered].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

  const filterBar = `
    <div class="filter-bar">
      <button class="chip ${filterCat === "all" ? "on" : ""}" data-filter="all"
        ${filterCat === "all" ? 'style="border-color:#c4b5fd;background:rgba(196,181,253,0.08);color:#c4b5fd"' : ""}>Tutte</button>
      ${CATEGORIES.map((c) => {
        const on = filterCat === c.id;
        return `<button class="chip ${on ? "on" : ""}" data-filter="${c.id}"
          ${on ? `style="border-color:${c.color};background:${c.color}14;color:${c.color}"` : ""}>${c.icon}</button>`;
      }).join("")}
    </div>
  `;

  const items =
    sorted.length === 0
      ? '<div class="empty" style="padding:36px">Nessuna spesa</div>'
      : sorted.map((e) => {
          const c = getCategoryById(e.cat);
          const { elapsed, total, ratio } = amortizationProgress(e);
          return `
            <div class="card list-card">
              <div class="list-card-top">
                <div class="exp-row-left">
                  <span style="font-size:22px">${c.icon}</span>
                  <div>
                    <div class="exp-name" style="font-weight:600">${e.name}</div>
                    <div class="exp-meta o">${formatDate(e.date)}${e.note ? ` · ${e.note}` : ""}</div>
                  </div>
                </div>
                <div class="exp-row-right">
                  <div style="font-size:15px;font-weight:700" class="o">${formatCurrency(e.amount)}</div>
                  ${e.am > 1 ? `<div style="font-size:11px;color:${c.color};font-weight:600" class="o">${formatCurrency(e.amount / e.am)}/m</div>` : ""}
                </div>
              </div>
              ${e.am > 1 ? `
                <div class="amort-bar">
                  <div class="amort-bar-header">
                    <span class="o">Ammortamento</span>
                    <span class="o">${elapsed}/${total} (${Math.round(ratio * 100)}%)</span>
                  </div>
                  ${progressBar(ratio, c.color)}
                </div>
              ` : ""}
              <div class="list-actions">
                <button class="sm-btn" data-edit="${e.id}">Modifica</button>
                <button class="del-btn" data-delete="${e.id}">Elimina</button>
              </div>
            </div>
          `;
        }).join("");

  container.innerHTML = `${filterBar}<div style="padding:0 14px">${items}</div>`;

  // Bind events
  container.querySelectorAll("[data-filter]").forEach((btn) => {
    btn.addEventListener("click", () => callbacks.onFilterChange(btn.dataset.filter));
  });
  container.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => callbacks.onEditExpense(btn.dataset.edit));
  });
  container.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => callbacks.onDeleteExpense(btn.dataset.delete));
  });
}
