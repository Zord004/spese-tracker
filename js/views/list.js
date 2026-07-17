import { expenseCategories } from "../catalog.js";
import { getCategoryById, isIncome } from "../models.js";
import { escapeHtml, formatCurrency, formatDate, monthKey, monthLabel } from "../utils.js";

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

  const sorted = [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date));

  // Raggruppa per mese
  const groups = {};
  sorted.forEach(e => {
    const mk = e.date ? monthKey(e.date) : "—";
    (groups[mk] = groups[mk] || []).push(e);
  });

  const filterChips = [
    { v: "all", label: "Tutte" },
    { v: "entrate", label: "Entrate" },
    { v: "spese", label: "Spese" },
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
      <div class="card">${items.map(e => renderRow(e)).join("")}</div>
    `).join("")}
  `;

  const inp = container.querySelector("#search-input");
  let db;
  inp?.addEventListener("input", () => { clearTimeout(db); db = setTimeout(() => callbacks.onSearchChange(inp.value), 200); });
  container.querySelectorAll("[data-filter]").forEach(b => b.addEventListener("click", () => callbacks.onFilterChange(b.dataset.filter)));
  container.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => callbacks.onEditExpense(b.dataset.edit)));
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
