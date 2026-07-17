// Catalogo categorie "vivo": parte dai default in constants.js e viene
// aggiornato a runtime con lo schema letto da Notion (/api/schema).
// Alle categorie nuove (non note) assegna un colore deterministico.
import { CATEGORIES, INCOME_CATEGORIES } from "./constants.js";

const FALLBACK_PALETTE = ["#c56a3f","#3f6098","#9a7c3b","#a34d4d","#4f8a6b","#7a5c96","#9c5a78","#4a7a96","#6a8f5a","#b0704a","#5a7ab0","#8a6a9c"];
function hashIndex(str, mod) { let h = 0; for (let i = 0; i < String(str).length; i++) h = (h * 31 + String(str).charCodeAt(i)) >>> 0; return h % mod; }

let _exp = CATEGORIES.map(c => ({ ...c }));
let _inc = INCOME_CATEGORIES.map(c => ({ ...c }));

export function expenseCategories() { return _exp; }
export function incomeCategories() { return _inc; }

export function setCategories(expNames, incNames) {
  const knownExp = new Map(CATEGORIES.map(c => [c.id, c.color]));
  const knownInc = new Map(INCOME_CATEGORIES.map(c => [c.id, c.color]));
  if (Array.isArray(expNames) && expNames.length) {
    _exp = expNames.map(id => ({ id, icon: "•", color: knownExp.get(id) || FALLBACK_PALETTE[hashIndex(id, FALLBACK_PALETTE.length)] }));
  }
  if (Array.isArray(incNames) && incNames.length) {
    _inc = incNames.map(id => ({ id, icon: "•", color: knownInc.get(id) || "#1a7048" }));
  }
}

export function getCat(id, type = "spesa") {
  const list = type === "entrata" ? _inc : _exp;
  return list.find(c => c.id === id) || {
    id: id || "Altro", icon: "•",
    color: type === "entrata" ? "#1a7048" : FALLBACK_PALETTE[hashIndex(id || "Altro", FALLBACK_PALETTE.length)],
  };
}
