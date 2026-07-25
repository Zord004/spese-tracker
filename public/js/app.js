import { store } from "./store.js";
import { setCategories } from "./catalog.js";
import { renderHome } from "./views/home.js";
import { renderList } from "./views/list.js";
import { renderAnalytics } from "./views/analytics.js";
import { renderSettings } from "./views/settings.js";
import { showExpenseForm } from "./views/form.js";
import { showTaxReport } from "./views/tax-report.js";

class App {
  constructor() {
    this.expenses = [];
    this.currentView = "home";
    this.filterCat = "all";
    this.searchQuery = "";
    this.syncStatus = {};
    this.el = {
      home: document.getElementById("v-home"),
      list: document.getElementById("v-list"),
      analytics: document.getElementById("v-analytics"),
      settings: document.getElementById("v-settings"),
    };
    this.formOverlay = document.getElementById("form-overlay");
    this.taxOverlay = document.getElementById("tax-overlay");
    this.toastEl = document.getElementById("toast-el");
    this.fab = document.getElementById("fab-btn");
    this.syncDot = document.getElementById("sync-dot");
    this.syncLabel = document.getElementById("sync-label");
    store.onStatusChange(s => { this.syncStatus = s; this._syncUI(); });
    this._systemMql = window.matchMedia("(prefers-color-scheme: dark)");
    this._systemMql.addEventListener("change", () => { if (store.getTheme() === "system") this._applyResolvedTheme(); });
    this._applyTheme(store.getTheme());
    this._bind();
    this._load();
  }
  _applyTheme(pref) { store.setTheme(pref); this._applyResolvedTheme(); }
  _applyResolvedTheme() {
    const pref = store.getTheme();
    const resolved = pref === "system" ? (this._systemMql.matches ? "dark" : "light") : pref;
    document.documentElement.setAttribute("data-theme", resolved);
    const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute("content", "#1c3d5c");
  }
  async _load() {
    const { data, syncedPending } = await store.getAll();
    this.expenses = data;
    this.render();
    if (syncedPending > 0) this.toast(`${syncedPending} sincronizzate`);
    this._loadSchema();
  }
  async _loadSchema() {
    try {
      const r = await fetch("/api/schema"); const d = await r.json();
      if (d.ok && (d.categories?.length || d.incomeCategories?.length)) {
        setCategories(d.categories, d.incomeCategories);
        this.render();
      }
    } catch {}
  }
  async refreshSchema() {
    this.toast("Aggiorno lo schema…");
    try {
      const r = await fetch("/api/refresh-schema", { method: "POST" }); const d = await r.json();
      if (d.ok) { setCategories(d.categories, d.incomeCategories); this.toast(d.source === "notion" ? `Schema aggiornato · ${d.categories.length} categorie` : "Schema non disponibile"); this.render(); }
      else this.toast("Errore aggiornamento schema");
    } catch { this.toast("Server non raggiungibile"); }
  }
  _syncUI() {
    if (!this.syncDot) return;
    const { syncing, error, source } = this.syncStatus;
    const pc = store.pendingCount();
    if (syncing) { this.syncDot.className = "sync-dot syncing"; this.syncLabel.textContent = "Sincronizzazione…"; }
    else if (error) { this.syncDot.className = "sync-dot offline"; this.syncLabel.textContent = pc > 0 ? `Offline · ${pc} in coda` : "Offline"; }
    else if (source === "notion") { this.syncDot.className = "sync-dot online"; this.syncLabel.textContent = `Sincronizzato · ${this.expenses.length} movimenti`; }
    else { this.syncDot.className = "sync-dot offline"; this.syncLabel.textContent = `Cache locale${pc > 0 ? ` · ${pc} in coda` : ""}`; }
  }
  _bind() {
    /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll("[data-nav]")).forEach(b =>
      b.addEventListener("click", () => this.switchView(b.dataset.nav)));
    this.fab.addEventListener("click", () => this.openAddForm());
    // Torna online: svuota la coda offline nell'istante in cui rientra la rete
    window.addEventListener("online", () => {
      if (store.pendingCount() > 0) this.forceSync();
    });
  }
  switchView(v) {
    this.currentView = v;
    Object.entries(this.el).forEach(([k, el]) => el.classList.toggle("hidden", k !== v));
    /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll("[data-nav]")).forEach(b => b.classList.toggle("on", b.dataset.nav === v));
    this.fab.classList.toggle("hidden", v === "settings");
    this.render();
  }
  render() {
    switch (this.currentView) {
      case "home":
        renderHome(this.el.home, this.expenses, {
          onEditExpense: id => this.openEditForm(id),
          onDelete: id => this.deleteExpense(id),
          onClone: id => this.openCloneForm(id),
          budget: store.getBudget(),
          varBudget: store.getVarBudget(),
          catBudgets: store.getCatBudgets(),
          income: store.getIncome(),
          onNavigate: v => this.switchView(v),
        });
        break;
      case "list":
        renderList(this.el.list, this.expenses, this.filterCat, this.searchQuery, {
          onEditExpense: id => this.openEditForm(id),
          onDelete: id => this.deleteExpense(id),
          onClone: id => this.openCloneForm(id),
          onFilterChange: c => { this.filterCat = c; this.render(); },
          onSearchChange: q => { this.searchQuery = q; this.render(); },
        });
        break;
      case "analytics":
        renderAnalytics(this.el.analytics, this.expenses, {
          getIncome: () => store.getIncome(),
          onOpenTaxReport: () => showTaxReport(this.taxOverlay, this.expenses),
        });
        break;
      case "settings":
        renderSettings(this.el.settings, this.expenses, {
          onExport: async () => this._dl(await store.exportJSON(), "application/json", `spese_${this._ds()}.json`, "JSON esportato"),
          onExportCSV: async () => this._dl(await store.exportCSV(), "text/csv", `spese_${this._ds()}.csv`, "CSV esportato"),
          onImport: ev => this.importData(ev),
          onReset: () => this.resetData(),
          onSync: () => this.forceSync(),
          onRefreshSchema: () => this.refreshSchema(),
          onBudgetSave: v => { store.setBudget(v); this.toast(v > 0 ? `Budget aggiornato` : "Budget rimosso"); this.render(); },
          onVarBudgetSave: v => { store.setVarBudget(v); this.toast(v > 0 ? `Limite aggiornato` : "Limite rimosso"); this.render(); },
          onIncomeSave: v => { store.setIncome(v); this.toast(v > 0 ? `Entrata aggiornata` : "Entrata rimossa"); this.render(); },
          onOpenTaxReport: () => showTaxReport(this.taxOverlay, this.expenses),
          onCatBudgetSave: (cat, v) => { store.setCatBudget(cat, v); this.toast(v > 0 ? `Budget ${cat} aggiornato` : `Budget ${cat} rimosso`); this.render(); },
          getBudget: () => store.getBudget(),
          getVarBudget: () => store.getVarBudget(),
          getCatBudgets: () => store.getCatBudgets(),
          getIncome: () => store.getIncome(),
          getTheme: () => store.getTheme(),
          getPendingCount: () => store.pendingCount(),
          onThemeChange: t => { this._applyTheme(t); this.render(); },
        });
        break;
    }
  }
  openAddForm() {
    showExpenseForm(this.formOverlay, null, async d => {
      if (!d) return;
      await store.add(d);
      const { data } = await store.getAll();
      this.expenses = data;
      this.toast(d.type === "entrata" ? "Entrata registrata" : "Spesa registrata");
      this.render();
    });
  }
  openEditForm(id) {
    const exp = this.expenses.find(e => e.id === id);
    if (!exp) return;
    showExpenseForm(this.formOverlay, exp, async d => {
      if (d === null) { await store.delete(id); this.toast("Movimento eliminato"); }
      else { await store.update(id, d); this.toast("Movimento aggiornato"); }
      const { data } = await store.getAll();
      this.expenses = data;
      this.render();
    });
  }
  async deleteExpense(id) {
    const exp = this.expenses.find(e => e.id === id);
    if (!exp) return;
    if (!confirm(`Eliminare "${exp.name}"?`)) return;
    await store.delete(id);
    this.toast("Movimento eliminato");
    const { data } = await store.getAll();
    this.expenses = data;
    this.render();
  }
  openCloneForm(id) {
    const exp = this.expenses.find(e => e.id === id);
    if (!exp) return;
    // Prefill senza id → il form lo tratta come nuovo movimento
    const prefill = { ...exp, id: undefined, name: exp.name, date: this._ds() };
    showExpenseForm(this.formOverlay, prefill, async d => {
      if (!d) return;
      await store.add(d);
      const { data } = await store.getAll();
      this.expenses = data;
      this.toast("Movimento clonato");
      this.render();
    });
  }
  async forceSync() {
    this.toast("Sincronizzazione…");
    const { data, source, syncedPending } = await store.getAll();
    this.expenses = data;
    let msg = source === "notion" ? "Sincronizzato" : "Offline";
    if (syncedPending > 0) msg = `${syncedPending} sincronizzate`;
    this.toast(msg);
    this.render();
  }
  _dl(c, t, f, m) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([c], { type: t }));
    a.download = f; a.click();
    URL.revokeObjectURL(a.href);
    this.toast(m);
  }
  _ds() { return new Date().toISOString().slice(0, 10); }
  importData(ev) {
    const f = ev.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = async e => {
      try { const d = await store.importJSON(e.target.result); this.expenses = d; this.toast(`${d.length} importate`); this.render(); }
      catch { this.toast("Errore nell'importazione"); }
    };
    r.readAsText(f);
  }
  async resetData() {
    if (!confirm("Cancellare la cache locale? I dati su Notion restano al sicuro.")) return;
    await store.clearCache();
    const { data } = await store.getAll();
    this.expenses = data;
    this.toast("Cache cancellata");
    this.render();
  }
  toast(msg) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.remove("hidden");
    this.toastEl.style.animation = "none";
    this.toastEl.offsetHeight;
    this.toastEl.style.animation = "";
    clearTimeout(this._tt);
    this._tt = setTimeout(() => this.toastEl.classList.add("hidden"), 2000);
  }
}
document.addEventListener("DOMContentLoaded", () => new App());
