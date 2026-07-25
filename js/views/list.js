import { expenseCategories } from "../catalog.js";
import { isIncome } from "../models.js";
import { escapeHtml, monthKey, monthLabel } from "../utils.js";
import { attachSwipe, swipeWrap } from "../swipe.js";
import { rowInner } from "./home.js";

export function renderList(container, expenses, filterCat, searchQuery, callbacks) {
  let filtered = filterCat === "all" ? expenses
    : filterCat === "entrate" ? expenses.filter(isIncome)
    : filterCat === "spese" ? expenses.filter(e => !isIncome(e))
    : expenses.filter(e => e.cat === filterCat);

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(e =>
      e.name.toLowerCase().includes(q) ||
      (e.note || "").toLowerCase().includes(q) ||
      (e.cat || "").toLowerCase().includes(q) ||
      (e.location || "").toLowerCase().includes(q)
    );
  }

  const sorted = [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const groups = {};
  sorted.forEach(e => { const mk = e.date ? monthKey(e.date) : "—"; (groups[mk] = groups[mk] || []).push(e); });

  /** @type {{v: string, label: string, color?: string}[]} */
  const filterChips = [
    { v: "all", label: "Tutte" }, { v: "entrate", label: "Entrate" }, { v: "spese", label: "Spese" },
    ...expenseCategories().map(c => ({ v: c.id, label: c.id, color: c.color })),
  ];

  container.innerHTML = `
    <div class="search">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
      <input id="search-input" type="text" placeholder="Cerca movimento, luogo, nota…" value="${escapeHtml(searchQuery || "")}" autocomplete="off">
    </div>
    <div class="filters">
      ${filterChips.map(f => `<button class="fchip ${filterCat === f.v ? "on" : ""}" data-filter="${escapeHtml(f.v)}">${f.color ? `<span class="dot" style="background:${f.color}"></span>` : ""}${escapeHtml(f.label)}</button>`).join("")}
    </div>
    ${sorted.length !== expenses.length ? `<div class="result-count">${sorted.length} moviment${sorted.length === 1 ? "o" : "i"}</div>` : ""}
    ${!sorted.length ? `
      <div class="card" style="margin-top:8px"><div class="empty"><span class="big">Nessun risultato</span>Nessun movimento corrisponde ai filtri.</div></div>
    ` : Object.entries(groups).map(([mk, items]) => `
      <div class="month-sep">${mk === "—" ? "Senza data" : monthLabel(mk)}</div>
      <div class="card row-swipes">${items.map(e => swipeWrap(e.id, rowInner(e))).join("")}</div>
    `).join("")}
  `;

  const inp = container.querySelector("#search-input");
  let db;
  inp?.addEventListener("input", () => { clearTimeout(db); db = setTimeout(() => callbacks.onSearchChange(inp.value), 200); });
  container.querySelectorAll("[data-filter]").forEach(b => b.addEventListener("click", () => callbacks.onFilterChange(b.dataset.filter)));
  container.querySelectorAll(".row-swipes").forEach(el => attachSwipe(el, { onEdit: callbacks.onEditExpense, onDelete: callbacks.onDelete, onClone: callbacks.onClone }));
}
