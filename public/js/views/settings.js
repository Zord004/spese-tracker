import { formatCurrency, escapeHtml } from "../utils.js";
import { totalSpent, isExpense } from "../models.js";
import { expenseCategories } from "../catalog.js";

// Stato locale: sezione budget-per-categoria aperta o chiusa
let _catBudgetOpen = false;

export function renderSettings(container, expenses, cb) {
  const theme = cb.getTheme();
  const income = cb.getIncome();
  const budget = cb.getBudget();
  const varBudget = cb.getVarBudget();
  const catBudgets = cb.getCatBudgets ? cb.getCatBudgets() : {};
  const catBudgetCount = Object.values(catBudgets).filter(v => v > 0).length;
  const catBudgetOpen = _catBudgetOpen;

  container.innerHTML = `
    <div class="pad"><div class="sec-head"><span class="sec-title">Finanze</span></div></div>
    <div class="list-group">
      <div class="list-item" id="set-income">
        <div class="list-item-main"><div class="list-item-title">Entrata mensile fissa</div><div class="list-item-sub">Base per il tasso di risparmio</div></div>
        <div class="list-item-value tnum">${income > 0 ? formatCurrency(income) : "—"}</div>
        <span class="list-item-arrow">›</span>
      </div>
      <div class="list-item" id="set-budget">
        <div class="list-item-main"><div class="list-item-title">Budget mensile</div><div class="list-item-sub">Tetto di spesa complessivo</div></div>
        <div class="list-item-value tnum">${budget > 0 ? formatCurrency(budget) : "—"}</div>
        <span class="list-item-arrow">›</span>
      </div>
      <div class="list-item" id="set-varbudget">
        <div class="list-item-main"><div class="list-item-title">Limite spesa variabile</div><div class="list-item-sub">Barra nell'intestazione del conto</div></div>
        <div class="list-item-value tnum">${varBudget > 0 ? formatCurrency(varBudget) : "—"}</div>
        <span class="list-item-arrow">›</span>
      </div>
      <div class="list-item" id="set-catbudget">
        <div class="list-item-main"><div class="list-item-title">Budget per categoria</div><div class="list-item-sub">${catBudgetCount > 0 ? `${catBudgetCount} categori${catBudgetCount === 1 ? "a" : "e"} con tetto` : "Nessun tetto impostato"}</div></div>
        <span class="list-item-arrow">${catBudgetOpen ? "⌄" : "›"}</span>
      </div>
      ${catBudgetOpen ? `
        <div class="catbudget-list">
          ${expenseCategories().map(c => `
            <div class="list-item sub" data-catbudget="${escapeHtml(c.id)}">
              <div class="list-item-main"><div class="list-item-title"><span class="swatch" style="background:${c.color}"></span>${escapeHtml(c.id)}</div></div>
              <div class="list-item-value tnum">${catBudgets[c.id] > 0 ? formatCurrency(catBudgets[c.id]) : "—"}</div>
              <span class="list-item-arrow">›</span>
            </div>
          `).join("")}
        </div>
      ` : ""}
    </div>

    <div class="pad"><div class="sec-head"><span class="sec-title">Fiscale</span></div></div>
    <div class="list-group">
      <div class="list-item" id="open-tax">
        <div class="list-item-main"><div class="list-item-title">Report commercialista</div><div class="list-item-sub">Anagrafica, entrate, detrazioni</div></div>
        <span class="list-item-arrow">›</span>
      </div>
    </div>

    <div class="pad"><div class="sec-head"><span class="sec-title">Aspetto</span></div></div>
    <div class="list-group settings-pad">
      <div class="segmented">
        <button class="segmented-btn ${theme === "light" ? "on" : ""}" id="theme-light">Chiaro</button>
        <button class="segmented-btn ${theme === "dark" ? "on" : ""}" id="theme-dark">Scuro</button>
        <button class="segmented-btn ${theme === "system" ? "on" : ""}" id="theme-system">Sistema</button>
      </div>
    </div>

    <div class="pad"><div class="sec-head"><span class="sec-title">Dati</span></div></div>
    <div class="list-group">
      <div class="list-item" id="btn-sync">
        <div class="list-item-main"><div class="list-item-title">Sincronizza con Notion</div><div class="list-item-sub">${cb.getPendingCount() > 0 ? `${cb.getPendingCount()} in coda offline` : "Aggiorna ora"}</div></div>
        <span class="list-item-arrow">↻</span>
      </div>
      <div class="list-item" id="btn-schema">
        <div class="list-item-main"><div class="list-item-title">Aggiorna schema da Notion</div><div class="list-item-sub">Rileva nuove categorie senza riavviare</div></div>
        <span class="list-item-arrow">↻</span>
      </div>
      <div class="list-item" id="btn-json"><div class="list-item-main"><div class="list-item-title">Esporta JSON</div></div><span class="list-item-arrow">↓</span></div>
      <div class="list-item" id="btn-csv"><div class="list-item-main"><div class="list-item-title">Esporta CSV</div></div><span class="list-item-arrow">↓</span></div>
      <div class="list-item" id="btn-import"><div class="list-item-main"><div class="list-item-title">Importa JSON</div></div><span class="list-item-arrow">↑</span></div>
      <div class="list-item" id="btn-reset"><div class="list-item-main"><div class="list-item-title" style="color:var(--debit)">Cancella cache locale</div></div></div>
    </div>
    <input type="file" id="import-file" accept=".json" class="hidden">

    <div class="pad"><div class="sec-head"><span class="sec-title">Informazioni</span></div></div>
    <div class="list-group settings-pad">
      <div class="list-item-main">
        <div class="list-item-title">Spese · conto personale</div>
        <div class="list-item-sub" style="margin-top:4px">v9.1 · ${expenses.filter(isExpense).length} spese · ${formatCurrency(totalSpent(expenses))} registrati</div>
      </div>
    </div>
  `;

  container.querySelector("#theme-light").addEventListener("click", () => cb.onThemeChange("light"));
  container.querySelector("#theme-dark").addEventListener("click", () => cb.onThemeChange("dark"));
  container.querySelector("#theme-system").addEventListener("click", () => cb.onThemeChange("system"));
  container.querySelector("#set-income").addEventListener("click", () => { const v = prompt("Entrata mensile fissa (€)", income || ""); if (v !== null) cb.onIncomeSave(parseFloat(v) || 0); });
  container.querySelector("#set-budget").addEventListener("click", () => { const v = prompt("Budget mensile (€)", budget || ""); if (v !== null) cb.onBudgetSave(parseFloat(v) || 0); });
  container.querySelector("#set-varbudget").addEventListener("click", () => { const v = prompt("Limite di spesa variabile mensile (€)", varBudget || ""); if (v !== null) cb.onVarBudgetSave(parseFloat(v) || 0); });
  container.querySelector("#set-catbudget")?.addEventListener("click", () => { _catBudgetOpen = !_catBudgetOpen; renderSettings(container, expenses, cb); });
  container.querySelectorAll("[data-catbudget]").forEach(el => el.addEventListener("click", () => {
    const cat = el.dataset.catbudget;
    const v = prompt(`Tetto mensile per "${cat}" (€) — lascia 0 per rimuoverlo`, catBudgets[cat] || "");
    if (v !== null) cb.onCatBudgetSave(cat, parseFloat(v) || 0);
  }));
  container.querySelector("#open-tax").addEventListener("click", cb.onOpenTaxReport);
  container.querySelector("#btn-sync").addEventListener("click", cb.onSync);
  container.querySelector("#btn-schema").addEventListener("click", cb.onRefreshSchema);
  container.querySelector("#btn-json").addEventListener("click", cb.onExport);
  container.querySelector("#btn-csv").addEventListener("click", cb.onExportCSV);
  container.querySelector("#btn-import").addEventListener("click", () => container.querySelector("#import-file").click());
  container.querySelector("#import-file").addEventListener("change", ev => { cb.onImport(ev); ev.target.value = ""; });
  container.querySelector("#btn-reset").addEventListener("click", cb.onReset);
}
