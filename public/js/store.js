/**
 * Persistenza: IndexedDB (via localforage) per i dati corposi,
 * localStorage per le impostazioni scalari. Gestisce la coda offline.
 * @typedef {import("./types.js").Expense} Expense
 * @typedef {import("./types.js").CatBudgets} CatBudgets
 */
import { STORAGE_KEY, BUDGET_KEY, THEME_KEY, GEOCACHE_KEY, INCOME_KEY, TAX_PROFILE_KEY, VARBUDGET_KEY, CAT_BUDGETS_KEY } from "./constants.js";
const PENDING_KEY = "myexpenses_pending";

// localforage globale (vendorizzato, caricato in index.html prima del modulo).
// Se per qualsiasi motivo non è disponibile, si ripiega su un adattatore
// asincrono su localStorage invece di far crashare tutto il modulo.
/** @type {any} */ const lf = (/** @type {any} */ (window)).localforage;
let idb;
if (lf && typeof lf.createInstance === "function") {
  idb = lf.createInstance({ name: "spese-tracker", storeName: "kv" });
} else {
  console.error("localforage non disponibile: uso il fallback su localStorage");
  idb = {
    getItem: async (/** @type {string} */ k) => { const v = localStorage.getItem("lf_" + k); return v == null ? null : JSON.parse(v); },
    setItem: async (/** @type {string} */ k, /** @type {any} */ val) => { localStorage.setItem("lf_" + k, JSON.stringify(val)); return val; },
    removeItem: async (/** @type {string} */ k) => { localStorage.removeItem("lf_" + k); },
  };
}

class ExpenseStore {
  constructor(key = STORAGE_KEY) {
    this._key = key;
    this._listeners = [];
    this._pendingCount = 0;     // mirror sincrono per la UI
    this._ready = this._init();
  }

  async _init() {
    // Migrazione una-tantum da localStorage (versioni <= 9.1) a IndexedDB
    try {
      const legacy = localStorage.getItem(this._key);
      const existing = await idb.getItem(this._key);
      if (legacy && !existing) { await idb.setItem(this._key, JSON.parse(legacy)); localStorage.removeItem(this._key); }
      const legacyPending = localStorage.getItem(PENDING_KEY);
      const existingPending = await idb.getItem(PENDING_KEY);
      if (legacyPending && !existingPending) { await idb.setItem(PENDING_KEY, JSON.parse(legacyPending)); localStorage.removeItem(PENDING_KEY); }
      const legacyGeo = localStorage.getItem(GEOCACHE_KEY);
      const existingGeo = await idb.getItem(GEOCACHE_KEY);
      if (legacyGeo && !existingGeo) { await idb.setItem(GEOCACHE_KEY, JSON.parse(legacyGeo)); localStorage.removeItem(GEOCACHE_KEY); }
    } catch {}
    this._pendingCount = (await this._getPending()).length;
    this._syncCountUI();
  }

  onStatusChange(fn) { this._listeners.push(fn); }
  _emit(s) { this._listeners.forEach(fn => fn(s)); }
  _syncCountUI() { this._emit({ ...( this._lastStatus || { syncing:false, error:null, source:"cache" } ), _countOnly:true }); }

  // ── Dati corposi su IndexedDB (async) ──
  async _getCache() { try { return (await idb.getItem(this._key)) || []; } catch { return []; } }
  async _setCache(e) { try { await idb.setItem(this._key, e); } catch {} }
  async _getPending() { try { return (await idb.getItem(PENDING_KEY)) || []; } catch { return []; } }
  async _setPending(q) { try { await idb.setItem(PENDING_KEY, q); this._pendingCount = q.length; } catch {} }
  async _addPending(op) { const q = await this._getPending(); q.push(op); await this._setPending(q); }
  /** @returns {number} operazioni in attesa (lettura sincrona dal mirror) */
  pendingCount() { return this._pendingCount; }   // sincrono, dal mirror

  async getGeoCache() { try { return (await idb.getItem(GEOCACHE_KEY)) || {}; } catch { return {}; } }
  async setGeoCache(c) { try { await idb.setItem(GEOCACHE_KEY, c); } catch {} }

  // ── Impostazioni scalari su localStorage (sync, minuscole) ──
  getBudget() { const v = localStorage.getItem(BUDGET_KEY); return v ? parseFloat(v) : 0; }
  setBudget(a) { localStorage.setItem(BUDGET_KEY, String(a)); }
  getVarBudget() { const v = localStorage.getItem(VARBUDGET_KEY); return v ? parseFloat(v) : 0; }
  setVarBudget(a) { localStorage.setItem(VARBUDGET_KEY, String(a)); }
  getTheme() { return localStorage.getItem(THEME_KEY) || "light"; }
  setTheme(t) { localStorage.setItem(THEME_KEY, t); }
  getIncome() { const v = localStorage.getItem(INCOME_KEY); return v ? parseFloat(v) : 0; }
  setIncome(a) { localStorage.setItem(INCOME_KEY, String(a)); }
  getTaxProfile() { try { return JSON.parse(localStorage.getItem(TAX_PROFILE_KEY) || "{}"); } catch { return {}; } }
  setTaxProfile(p) { localStorage.setItem(TAX_PROFILE_KEY, JSON.stringify(p || {})); }
  /** Budget per categoria: { "Cibo": 300, "Svago": 100 } */
  getCatBudgets() { try { return JSON.parse(localStorage.getItem(CAT_BUDGETS_KEY) || "{}"); } catch { return {}; } }
  /** @param {string} cat @param {number} amount 0 rimuove il tetto */
  setCatBudget(cat, amount) {
    const b = this.getCatBudgets();
    if (amount > 0) b[cat] = amount; else delete b[cat];
    localStorage.setItem(CAT_BUDGETS_KEY, JSON.stringify(b));
  }

  /** Svuota la coda offline con pacing anti rate-limit. @returns {Promise<number>} operazioni riuscite */
  async syncPending() {
    if (this._syncing) return 0;          // evita esecuzioni sovrapposte (doppio invio)
    this._syncing = true;
    try {
      const queue = await this._getPending(); if (!queue.length) return 0;
      let synced = 0; const remaining = [];
      const pause = (ms) => new Promise(r => setTimeout(r, ms));
      for (let i = 0; i < queue.length; i++) {
        const op = queue[i];
        try {
          if (op.type === "add") { await this._api("", { method: "POST", body: JSON.stringify(op.data) }); synced++; }
          else if (op.type === "update") { await this._api(`/${op.id}`, { method: "PUT", body: JSON.stringify(op.data) }); synced++; }
          else if (op.type === "delete") { await this._api(`/${op.id}`, { method: "DELETE" }); synced++; }
        } catch { remaining.push(op); }
        // Pacing: ~350ms tra un'operazione e l'altra, sotto il limite di 3 req/s di Notion
        if (i < queue.length - 1) await pause(350);
      }
      await this._setPending(remaining); return synced;
    } finally { this._syncing = false; }
  }

  async geocode(place) {
    if (!place) return null;
    const cache = await this.getGeoCache(), key = place.toLowerCase().trim();
    if (cache[key]) return cache[key];
    if (cache[key] === null) return null;
    const tryQuery = async (q) => {
      try { const r = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`); const d = await r.json(); if (d.ok) return { lat: d.lat, lon: d.lon, name: d.name }; } catch {}
      return null;
    };
    let geo = await tryQuery(place);
    if (!geo && !place.toLowerCase().includes("italia")) geo = await tryQuery(`${place}, Italia`);
    if (!geo) { const parts = place.split(/[,•\-—–]/).map(s => s.trim()).filter(Boolean); for (const part of parts) { if (part.length < 3) continue; geo = await tryQuery(part); if (geo) break; } }
    cache[key] = geo || null;
    await this.setGeoCache(cache);
    return geo;
  }

  async _api(p, o = {}) { const r = await fetch(`/api/expenses${p}`, { headers: { "Content-Type": "application/json" }, ...o }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }

  /** Legge da Notion; in caso di errore ripiega sulla cache locale.
   * @returns {Promise<{data: Expense[], source: string, syncedPending: number}>} */
  async getAll() {
    await this._ready;
    this._lastStatus = { syncing: true, error: null }; this._emit(this._lastStatus);
    try { const sc = await this.syncPending(); const r = await this._api("");
      if (r.ok) { await this._setCache(r.data); this._lastStatus = { syncing: false, error: null, source: "notion", syncedPending: sc }; this._emit(this._lastStatus); return { data: r.data, source: "notion", syncedPending: sc }; }
      throw new Error();
    } catch (e) { this._lastStatus = { syncing: false, error: e.message, source: "cache" }; this._emit(this._lastStatus); return { data: await this._getCache(), source: "cache", syncedPending: 0 }; }
  }
  /** @param {Expense} exp */
  async add(exp) {
    if (exp.location) this.geocode(exp.location).catch(() => {});
    this._emit({ syncing: true, error: null });
    try { const r = await this._api("", { method: "POST", body: JSON.stringify(exp) });
      if (r.ok) { const all = await this._api(""); if (all.ok) await this._setCache(all.data); this._emit({ syncing: false, error: null, source: "notion" }); return { data: r.data }; } throw new Error();
    } catch (e) { const ts = Date.now(); await this._addPending({ type: "add", data: exp, ts }); const c = await this._getCache();
      const local = { ...exp, id: `pending_${ts}`, _pending: true }; c.unshift(local); await this._setCache(c);
      this._emit({ syncing: false, error: e.message, source: "cache" }); return { data: local }; }
  }
  /** @param {string} id @param {Expense} u */
  async update(id, u) {
    if (u.location) this.geocode(u.location).catch(() => {});
    this._emit({ syncing: true, error: null });
    try { await this._api(`/${id}`, { method: "PUT", body: JSON.stringify(u) }); const all = await this._api(""); if (all.ok) await this._setCache(all.data); this._emit({ syncing: false, error: null, source: "notion" });
    } catch (e) {
      if (id.startsWith("pending_")) {
        // Elemento non ancora sincronizzato: aggiorno i dati dell'operazione 'add' in coda,
        // così al sync viene creato con i valori corretti (invece di perdere la modifica).
        const ts = Number(id.slice("pending_".length));
        const q = await this._getPending(); const op = q.find(o => o.type === "add" && o.ts === ts);
        if (op) { op.data = { ...op.data, ...u }; await this._setPending(q); }
      } else await this._addPending({ type: "update", id, data: u, ts: Date.now() });
      await this._setCache((await this._getCache()).map(x => x.id === id ? { ...x, ...u } : x)); this._emit({ syncing: false, error: e.message, source: "cache" }); }
  }
  /** @param {string} id */
  async delete(id) {
    this._emit({ syncing: true, error: null });
    try { await this._api(`/${id}`, { method: "DELETE" }); const all = await this._api(""); if (all.ok) await this._setCache(all.data); this._emit({ syncing: false, error: null, source: "notion" });
    } catch (e) {
      if (id.startsWith("pending_")) {
        // Non ancora sincronizzato: rimuovo l'operazione 'add' dalla coda, così non verrà creato.
        const ts = Number(id.slice("pending_".length));
        await this._setPending((await this._getPending()).filter(o => !(o.type === "add" && o.ts === ts)));
      } else await this._addPending({ type: "delete", id, ts: Date.now() });
      await this._setCache((await this._getCache()).filter(x => x.id !== id)); this._emit({ syncing: false, error: e.message, source: "cache" }); }
  }
  async clearCache() { await idb.removeItem(this._key); await idb.removeItem(PENDING_KEY); this._pendingCount = 0; }
  async exportJSON() { return JSON.stringify(await this._getCache(), null, 2); }
  async exportCSV() {
    const e = await this._getCache();
    const h = "Tipo,Nome,Importo,Data,Categoria,Natura,Ammortamento,Ricorrenza,Luogo,Detraibile,% Detrazione,Utilizzi,Note";
    const rows = e.map(x => { const esc = s => `"${String(s || "").replace(/"/g, '""')}"`;
      return `${esc(x.type||"spesa")},${esc(x.name)},${x.amount},${x.date},${esc(x.cat)},${esc(x.nature || "variabile")},${x.am || 1},${esc(x.recur || "Nessuna")},${esc(x.location || "")},${x.detraibile ? "Sì" : "No"},${x.detrazionePct || 0},${x.utilizzi || 0},${esc(x.note)}`; });
    return [h, ...rows].join("\n");
  }
  /** Importa movimenti AGGIUNGENDOLI a Notion (coda offline-safe), non solo in cache. */
  async importJSON(j) {
    const d = JSON.parse(j);
    if (!Array.isArray(d)) throw new Error("Invalid");
    const q = await this._getPending();
    let ts = Date.now();
    for (const item of d) {
      const { id, _pending, originalAmount, ...clean } = item || {};   // scarta id/flag locali
      if (!clean.name && clean.type !== "entrata") continue;           // salta righe evidentemente vuote
      q.push({ type: "add", data: clean, ts: ts++ });
    }
    await this._setPending(q);
    const synced = await this.syncPending();
    const all = await this._api("").catch(() => null);
    if (all?.ok) await this._setCache(all.data);
    return { imported: d.length, synced };
  }
}
export const store = new ExpenseStore();
