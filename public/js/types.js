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

/**
 * Previsione di fine mese (vedi forecastMonth).
 * @typedef {Object} Forecast
 * @property {string} mk @property {number} daysInMonth @property {number} dayOfMonth @property {number} daysLeft
 * @property {number} floor            Parte certa: una tantum registrate + ricorrenti + quote
 * @property {number} committed        Ricorrenti + quote di ammortamento
 * @property {number} spentOneOff      Una tantum del mese già registrate
 * @property {number} dailyRate @property {number} dailyRateCurrent @property {number|null} dailyRateHistory
 * @property {number} expectedRemaining Spesa discrezionale attesa nei giorni rimanenti
 * @property {number} projectedSpend @property {number} low @property {number} high
 * @property {"alta"|"media"|"bassa"} confidence
 * @property {{mk:string, days:number, oneOff:number}[]} history
 * @property {number} incomeExpected @property {boolean} hasIncome @property {number} projectedBalance
 * @property {number} variableNow @property {number} projectedVariable
 */

/**
 * Esito del simulatore what-if (vedi simulateExpense).
 * @typedef {Object} Simulation
 * @property {number} amount @property {number} installments @property {number} charge
 * @property {{mk:string, charge:number}[]} schedule
 * @property {Forecast} before
 * @property {{projectedSpend:number, low:number, high:number, projectedBalance:number, projectedVariable:number}} after
 * @property {{before:number|null, after:number|null}} rate
 * @property {{limit:number, residualBefore:number, residualAfter:number, projectedResidualBefore:number, projectedResidualAfter:number}|null} variable
 * @property {{id:string, limit:number, spentBefore:number, spentAfter:number, residualBefore:number, residualAfter:number}|null} category
 * @property {boolean} hasIncome @property {number|null} avgSaving @property {number|null} monthsToRecover
 * @property {"ok"|"warn"|"over"} level @property {string[]} reasons
 */

export {};
