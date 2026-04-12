import { store } from "./store.js";
import { uid } from "./utils.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderList } from "./views/list.js";
import { renderAmortization } from "./views/amortization.js";
import { renderSettings } from "./views/settings.js";
import { showExpenseForm } from "./views/form.js";

class App {
  constructor() {
    // State
    this.expenses = [];
    this.currentView = "dash";
    this.filterCat = "all";
    this.syncStatus = { syncing: false, error: null, source: null };

    // DOM refs
    this.containers = {
      dash: document.getElementById("v-dash"),
      list: document.getElementById("v-list"),
      amort: document.getElementById("v-amort"),
      settings: document.getElementById("v-settings"),
    };
    this.formOverlay = document.getElementById("form-overlay");
    this.toastEl = document.getElementById("toast-el");
    this.fab = document.getElementById("fab-btn");
    this.syncDot = document.getElementById("sync-dot");
    this.syncLabel = document.getElementById("sync-label");

    // Listen to sync status
    store.onStatusChange((status) => {
      this.syncStatus = status;
      this._updateSyncUI();
    });

    this._bindNavigation();
    this._bindFAB();
    this._initialLoad();
  }

  // ── Initial load (async) ──

  async _initialLoad() {
    const { data, source } = await store.getAll();
    this.expenses = data;
    this.render();
  }

  // ── Sync UI ──

  _updateSyncUI() {
    if (!this.syncDot || !this.syncLabel) return;
    const { syncing, error, source } = this.syncStatus;

    if (syncing) {
      this.syncDot.className = "sync-dot syncing";
      this.syncLabel.textContent = "Sincronizzazione...";
    } else if (error) {
      this.syncDot.className = "sync-dot offline";
      this.syncLabel.textContent = "Offline (dati locali)";
    } else if (source === "notion") {
      this.syncDot.className = "sync-dot online";
      this.syncLabel.textContent = `Notion · ${this.expenses.length} spese`;
    } else {
      this.syncDot.className = "sync-dot offline";
      this.syncLabel.textContent = "Cache locale";
    }
  }

  // ── Navigation ──

  _bindNavigation() {
    document.querySelectorAll("[data-nav]").forEach((btn) => {
      btn.addEventListener("click", () => this.switchView(btn.dataset.nav));
    });
  }

  _bindFAB() {
    this.fab.addEventListener("click", () => this.openAddForm());
  }

  switchView(view) {
    this.currentView = view;

    Object.entries(this.containers).forEach(([key, el]) => {
      el.classList.toggle("hidden", key !== view);
    });

    document.querySelectorAll("[data-nav]").forEach((btn) => {
      btn.classList.toggle("on", btn.dataset.nav === view);
    });

    this.fab.classList.toggle("hidden", view === "settings");
    this.render();
  }

  // ── Rendering ──

  render() {
    switch (this.currentView) {
      case "dash":
        renderDashboard(this.containers.dash, this.expenses, {
          onEditExpense: (id) => this.openEditForm(id),
        });
        break;

      case "list":
        renderList(this.containers.list, this.expenses, this.filterCat, {
          onEditExpense: (id) => this.openEditForm(id),
          onDeleteExpense: (id) => this.deleteExpense(id),
          onFilterChange: (cat) => {
            this.filterCat = cat;
            this.render();
          },
        });
        break;

      case "amort":
        renderAmortization(this.containers.amort, this.expenses);
        break;

      case "settings":
        renderSettings(this.containers.settings, this.expenses, {
          onExport: () => this.exportData(),
          onImport: (ev) => this.importData(ev),
          onReset: () => this.resetData(),
          onSync: () => this.forceSync(),
        });
        break;
    }
  }

  // ── Expense CRUD (all async now) ──

  openAddForm() {
    showExpenseForm(this.formOverlay, null, async (data) => {
      if (!data) return;
      await store.add(data);
      const { data: refreshed } = await store.getAll();
      this.expenses = refreshed;
      this.toast("Spesa aggiunta ✓");
      this.render();
    });
  }

  openEditForm(id) {
    const expense = this.expenses.find((e) => e.id === id);
    if (!expense) return;

    showExpenseForm(this.formOverlay, expense, async (data) => {
      if (data === null) {
        await store.delete(id);
        this.toast("Eliminata ✓");
      } else {
        await store.update(id, data);
        this.toast("Aggiornata ✓");
      }
      const { data: refreshed } = await store.getAll();
      this.expenses = refreshed;
      this.render();
    });
  }

  async deleteExpense(id) {
    if (!confirm("Eliminare questa spesa?")) return;
    await store.delete(id);
    const { data: refreshed } = await store.getAll();
    this.expenses = refreshed;
    this.toast("Eliminata ✓");
    this.render();
  }

  // ── Sync ──

  async forceSync() {
    this.toast("Sincronizzazione...");
    const { data, source } = await store.getAll();
    this.expenses = data;
    this.toast(source === "notion" ? "Sincronizzato con Notion ✓" : "Offline — dati dalla cache");
    this.render();
  }

  // ── Data management ──

  exportData() {
    const blob = new Blob([store.exportJSON()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `spese_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    this.toast("Esportato ✓");
  }

  importData(ev) {
    const file = ev.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = store.importJSON(e.target.result);
        this.expenses = data;
        this.toast(`${data.length} spese importate (solo locale) ✓`);
        this.render();
      } catch {
        this.toast("Errore nel file");
      }
    };
    reader.readAsText(file);
  }

  async resetData() {
    if (!confirm("Vuoi davvero cancellare la cache locale?")) return;
    store.clearCache();
    const { data } = await store.getAll();
    this.expenses = data;
    this.toast("Cache locale cancellata");
    this.render();
  }

  // ── Toast ──

  toast(msg) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.remove("hidden");
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.toastEl.classList.add("hidden");
    }, 2300);
  }
}

// ── Boot ──
document.addEventListener("DOMContentLoaded", () => new App());
