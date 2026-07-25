// Definizioni di tipo condivise (solo JSDoc: nessun codice, nessun build step).
// Servono all'editor e al controllo `npm run typecheck` per segnalare
// proprietà mancanti o tipi sbagliati prima che arrivino su Notion.

/**
 * Un movimento: spesa o entrata. Rispecchia una riga del database Notion.
 * @typedef {Object} Expense
 * @property {string} [id]              ID pagina Notion (assente finché non è sincronizzato)
 * @property {"spesa"|"entrata"} [type] Assente equivale a "spesa"
 * @property {string} name              Descrizione
 * @property {number} amount            Importo in EUR (già convertito)
 * @property {string} date              Data ISO "YYYY-MM-DD"
 * @property {string} cat               Categoria (dinamica, letta da Notion)
 * @property {number} [am]              Mesi di ammortamento (1 = nessuno)
 * @property {string} [recur]           "Nessuna" | "Giornaliera" | "Mensile" | "Trimestrale" | "Annuale" | "Ogni N mesi"
 * @property {"variabile"|"fisso"} [nature]
 * @property {string} [note]
 * @property {string} [location]
 * @property {boolean} [detraibile]
 * @property {number} [detrazionePct]   Percentuale di detrazione (0-100)
 * @property {number} [utilizzi]
 * @property {string} [currency]        Valuta d'inserimento (default "EUR")
 * @property {number|null} [originalAmount] Importo nella valuta originale
 * @property {boolean} [_pending]       Creato offline, in attesa di sincronizzazione
 */

/**
 * Una categoria del catalogo (colori inclusi).
 * @typedef {Object} Category
 * @property {string} id
 * @property {string} icon
 * @property {string} color
 */

/**
 * Riga di ripartizione per categoria.
 * @typedef {Object} CategorySlice
 * @property {string} id
 * @property {string} color
 * @property {string} icon
 * @property {number} total
 * @property {number} count
 */

/**
 * Stato di un budget di categoria nel mese corrente.
 * @typedef {Object} BudgetStatus
 * @property {string} id
 * @property {string} color
 * @property {number} spent      Speso nel mese
 * @property {number} limit      Tetto impostato
 * @property {number} ratio      0-1, limitato a 1 per la barra
 * @property {number} pct        Percentuale reale (può superare 100)
 * @property {"ok"|"warn"|"over"} state
 * @property {number} remaining  Può essere negativo se sforato
 */

/**
 * Proiezione del saldo a fine mese.
 * @typedef {Object} Projection
 * @property {number} incomeExpected
 * @property {number} spentSoFar
 * @property {number} upcoming
 * @property {number} projectedExpenses
 * @property {number} projectedBalance
 */

/** Mappa categoria → tetto mensile. @typedef {Record<string, number>} CatBudgets */

export {};
