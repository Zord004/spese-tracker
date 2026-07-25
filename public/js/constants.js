// Palette categoria — tinte desaturate, coerenti col tema istituzionale
export const CATEGORIES = [
  { id: "Cibo",          icon: "•", color: "#c56a3f" },
  { id: "Tecnologia",    icon: "•", color: "#3f6098" },
  { id: "Casa",          icon: "•", color: "#9a7c3b" },
  { id: "Auto/Moto",     icon: "•", color: "#a34d4d" },
  { id: "Salute",        icon: "•", color: "#4f8a6b" },
  { id: "Abbigliamento", icon: "•", color: "#7a5c96" },
  { id: "Svago",         icon: "•", color: "#9c5a78" },
  { id: "Formazione",    icon: "•", color: "#4a7a96" },
  { id: "Altro",         icon: "•", color: "#7c8a99" },
];

export const INCOME_CATEGORIES = [
  { id: "Stipendio", icon: "•", color: "#1a7048" },
  { id: "Bonus",     icon: "•", color: "#1a7048" },
  { id: "Mancia",    icon: "•", color: "#9a7c3b" },
  { id: "Rimborso",  icon: "•", color: "#4a7a96" },
  { id: "Regalo",    icon: "•", color: "#9c5a78" },
  { id: "Vendita",   icon: "•", color: "#7a5c96" },
  { id: "Altro",     icon: "•", color: "#7c8a99" },
];

export const AMORT_OPTIONS = [
  { value: 1, label: "—" },
  { value: 3, label: "3m" },
  { value: 6, label: "6m" },
  { value: 12, label: "12m" },
  { value: 24, label: "24m" },
  { value: 36, label: "36m" },
  { value: 60, label: "60m" },
  { value: "custom", label: "Custom" },
];

export const RECURRENCE_OPTIONS = [
  { value: "Nessuna",      label: "Nessuna" },
  { value: "Giornaliera",  label: "Ogni giorno" },
  { value: "Mensile",      label: "Ogni mese" },
  { value: "Trimestrale",  label: "Ogni trimestre" },
  { value: "Annuale",      label: "Ogni anno" },
  { value: "custom",       label: "Custom" },
];

export const NATURE_OPTIONS = [
  { value: "variabile", label: "Variabile" },
  { value: "fisso",     label: "Fisso" },
];

export const TYPE_OPTIONS = [
  { value: "spesa",   label: "Spesa" },
  { value: "entrata", label: "Entrata" },
];

export const DEDUCTION_DEFAULTS = {
  "Salute": 19, "Casa": 50, "Formazione": 19,
  "Auto/Moto": 0, "Tecnologia": 0, "Abbigliamento": 0, "Svago": 0, "Cibo": 0, "Altro": 0,
};

export const DEFAULT_CATEGORY = "Altro";

// Valute supportate per la multi-valuta (il server converte in EUR)
export const CURRENCIES = ["EUR", "USD", "GBP", "JPY", "CHF", "CAD", "AUD", "SEK", "NOK", "DKK"];
export const STORAGE_KEY = "myexpenses";
export const BUDGET_KEY = "myexpenses_budget";
export const THEME_KEY = "myexpenses_theme";
export const GEOCACHE_KEY = "myexpenses_geocache";
export const INCOME_KEY = "myexpenses_income";
export const VARBUDGET_KEY = "myexpenses_varbudget";
export const CAT_BUDGETS_KEY = "myexpenses_cat_budgets";
export const TAX_PROFILE_KEY = "myexpenses_tax_profile";
