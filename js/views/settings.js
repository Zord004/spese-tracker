import { formatCurrency } from "../utils.js";
import { totalSpent } from "../models.js";

/**
 * Render the settings / data management view.
 * @param {HTMLElement} container
 * @param {Array} expenses
 * @param {object} callbacks - { onExport, onImport, onReset, onSync }
 */
export function renderSettings(container, expenses, callbacks) {
  container.innerHTML = `
    <div class="card">
      <div class="lbl" style="margin-bottom:12px">Sincronizzazione</div>
      <button class="tool-btn" id="btn-sync" style="width:100%;padding:14px;font-size:14px">
        🔄 Sincronizza con Notion
      </button>
      <div style="margin-top:8px;font-size:11px;color:rgba(255,255,255,0.2);text-align:center" class="o">
        I dati vengono sincronizzati automaticamente ad ogni operazione.
        Usa questo pulsante per forzare un refresh.
      </div>
    </div>

    <div class="card">
      <div class="lbl" style="margin-bottom:12px">Gestione dati</div>
      <div class="tools-row">
        <button class="tool-btn" id="btn-export">📤 Esporta JSON</button>
        <button class="tool-btn" id="btn-import-trigger">📥 Importa JSON</button>
      </div>
      <input type="file" id="import-file" accept=".json" style="display:none">
      <div style="margin-top:10px">
        <button class="tool-btn danger" id="btn-reset">🗑️ Cancella cache locale</button>
      </div>
    </div>

    <div class="card">
      <div class="lbl" style="margin-bottom:8px">Info</div>
      <div class="settings-info">
        <b style="color:#c4b5fd">Expense Tracker</b> · v2.0<br>
        ${expenses.length} spese · Totale ${formatCurrency(totalSpent(expenses))}<br><br>
        <span style="font-size:11px;color:rgba(255,255,255,0.2)">
          Fonte primaria: Notion<br>
          Fallback offline: localStorage<br>
          Server: Express + @notionhq/client
        </span>
      </div>
    </div>
  `;

  container.querySelector("#btn-sync").addEventListener("click", callbacks.onSync);
  container.querySelector("#btn-export").addEventListener("click", callbacks.onExport);
  container.querySelector("#btn-import-trigger").addEventListener("click", () => {
    container.querySelector("#import-file").click();
  });
  container.querySelector("#import-file").addEventListener("change", (ev) => {
    callbacks.onImport(ev);
    ev.target.value = "";
  });
  container.querySelector("#btn-reset").addEventListener("click", callbacks.onReset);
}
