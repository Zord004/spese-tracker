import { STORAGE_KEY } from "./constants.js";

/**
 * ExpenseStore – dual persistence layer.
 *
 * Primary:  Notion (via /api/expenses REST endpoints)
 * Fallback: localStorage (offline cache)
 *
 * Strategy:
 *   - All reads try Notion first, fall back to cache
 *   - All writes go to Notion, then update cache
 *   - If Notion is unreachable, operates offline from cache
 */
class ExpenseStore {
  constructor(key = STORAGE_KEY) {
    this._key = key;
    this._listeners = [];
  }

  // ── Event system (for sync status updates) ──

  /** Register a listener: fn({ syncing, error, source }) */
  onStatusChange(fn) {
    this._listeners.push(fn);
  }

  _emit(status) {
    this._listeners.forEach((fn) => fn(status));
  }

  // ── Local cache ──

  _getCache() {
    try {
      return JSON.parse(localStorage.getItem(this._key) || "[]");
    } catch {
      return [];
    }
  }

  _setCache(expenses) {
    localStorage.setItem(this._key, JSON.stringify(expenses));
  }

  // ── API helpers ──

  async _api(path, options = {}) {
    const res = await fetch(`/api/expenses${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // ── CRUD operations ──

  /**
   * Fetch all expenses. Tries Notion first, falls back to cache.
   * @returns {Promise<{ data: Array, source: "notion"|"cache" }>}
   */
  async getAll() {
    this._emit({ syncing: true, error: null });
    try {
      const result = await this._api("");
      if (result.ok) {
        this._setCache(result.data);
        this._emit({ syncing: false, error: null, source: "notion" });
        return { data: result.data, source: "notion" };
      }
      throw new Error("API error");
    } catch (err) {
      this._emit({ syncing: false, error: err.message, source: "cache" });
      return { data: this._getCache(), source: "cache" };
    }
  }

  /**
   * Add a new expense.
   * @param {object} expense - { name, amount, date, cat, am, note }
   */
  async add(expense) {
    this._emit({ syncing: true, error: null });
    try {
      const result = await this._api("", {
        method: "POST",
        body: JSON.stringify(expense),
      });
      if (result.ok) {
        const all = await this._api("");
        if (all.ok) this._setCache(all.data);
        this._emit({ syncing: false, error: null, source: "notion" });
        return { data: result.data, source: "notion" };
      }
      throw new Error("API error");
    } catch (err) {
      // Offline fallback
      const cached = this._getCache();
      const local = { ...expense, id: `local_${Date.now()}`, _pending: true };
      cached.unshift(local);
      this._setCache(cached);
      this._emit({ syncing: false, error: err.message, source: "cache" });
      return { data: local, source: "cache" };
    }
  }

  /**
   * Update an expense by its Notion page id.
   */
  async update(id, updates) {
    this._emit({ syncing: true, error: null });
    try {
      await this._api(`/${id}`, {
        method: "PUT",
        body: JSON.stringify(updates),
      });
      const all = await this._api("");
      if (all.ok) this._setCache(all.data);
      this._emit({ syncing: false, error: null, source: "notion" });
    } catch (err) {
      const cached = this._getCache().map((e) =>
        e.id === id ? { ...e, ...updates } : e
      );
      this._setCache(cached);
      this._emit({ syncing: false, error: err.message, source: "cache" });
    }
  }

  /**
   * Delete (archive) an expense in Notion.
   */
  async delete(id) {
    this._emit({ syncing: true, error: null });
    try {
      await this._api(`/${id}`, { method: "DELETE" });
      const all = await this._api("");
      if (all.ok) this._setCache(all.data);
      this._emit({ syncing: false, error: null, source: "notion" });
    } catch (err) {
      const cached = this._getCache().filter((e) => e.id !== id);
      this._setCache(cached);
      this._emit({ syncing: false, error: err.message, source: "cache" });
    }
  }

  /** Clear local cache only. */
  clearCache() {
    localStorage.removeItem(this._key);
  }

  /** Export cached data as JSON string. */
  exportJSON() {
    return JSON.stringify(this._getCache(), null, 2);
  }

  /** Import from JSON into local cache. Does NOT push to Notion. */
  importJSON(json) {
    const data = JSON.parse(json);
    if (!Array.isArray(data)) throw new Error("Invalid format");
    this._setCache(data);
    return data;
  }
}

export const store = new ExpenseStore();
