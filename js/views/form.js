import { CATEGORIES, AMORT_OPTIONS, DEFAULT_CATEGORY } from "../constants.js";
import { formatCurrency, todayISO } from "../utils.js";

/**
 * Show the add/edit expense form as a bottom sheet overlay.
 * @param {HTMLElement} overlay - the overlay container
 * @param {object|null} expense - null for new, expense obj for edit
 * @param {function} onSubmit - callback({ name, amount, date, cat, am, note })
 */
export function showExpenseForm(overlay, expense, onSubmit) {
  const isEdit = expense !== null;
  let selectedCat = expense?.cat || DEFAULT_CATEGORY;
  let selectedAm = expense?.am || 1;

  function renderChips(containerId, items, selected, onSelect) {
    const el = overlay.querySelector(`#${containerId}`);
    if (!el) return;
    el.innerHTML = items
      .map((item) => {
        const on = item.value === selected || item.id === selected;
        const color = item.color || "#c4b5fd";
        const label = item.label || `${item.icon} ${item.id}`;
        const style = on
          ? `border-color:${color};background:${color}14;color:${color}`
          : "";
        return `<button class="chip ${on ? "on" : ""}" style="${style}" data-val="${item.value || item.id}">${label}</button>`;
      })
      .join("");
    el.querySelectorAll(".chip").forEach((btn) => {
      btn.addEventListener("click", () => onSelect(btn.dataset.val));
    });
  }

  function updatePreview() {
    const amount = parseFloat(overlay.querySelector("#f-amount")?.value || 0);
    const previewEl = overlay.querySelector("#f-preview");
    if (!previewEl) return;
    if (amount && selectedAm > 1) {
      previewEl.innerHTML = `
        <div class="preview">
          <span style="font-size:13px;color:rgba(255,255,255,0.4)">Costo mensile: </span>
          <span class="o" style="font-size:16px;font-weight:600;color:#c4b5fd">${formatCurrency(amount / selectedAm)}</span>
          <span style="font-size:11px;color:rgba(255,255,255,0.25)"> × ${selectedAm} mesi</span>
        </div>`;
    } else {
      previewEl.innerHTML = "";
    }
  }

  function renderFormContent() {
    renderChips(
      "f-cats",
      CATEGORIES.map((c) => ({ ...c, value: c.id, label: `${c.icon} ${c.id}` })),
      selectedCat,
      (val) => { selectedCat = val; renderFormContent(); }
    );
    renderChips("f-ams", AMORT_OPTIONS, selectedAm, (val) => {
      selectedAm = parseInt(val);
      renderFormContent();
      updatePreview();
    });
    updatePreview();
  }

  overlay.innerHTML = `
    <div class="overlay-bg">
      <div class="sheet">
        <div class="sheet-header">
          <h2 class="o">${isEdit ? "Modifica spesa" : "Nuova spesa"}</h2>
          <button class="close" id="form-close">✕</button>
        </div>
        <div class="form-body">
          <div><div class="lbl">Descrizione</div><input class="inp" id="f-name" placeholder="es. MacBook Pro" value="${expense?.name || ""}" autocomplete="off"></div>
          <div class="form-row">
            <div class="flex1"><div class="lbl">Importo (€)</div><input class="inp" id="f-amount" type="number" step="0.01" placeholder="0.00" value="${expense?.amount || ""}" inputmode="decimal"></div>
            <div class="flex1"><div class="lbl">Data</div><input class="inp" id="f-date" type="date" value="${expense?.date || todayISO()}"></div>
          </div>
          <div><div class="lbl">Categoria</div><div class="chips" id="f-cats"></div></div>
          <div><div class="lbl">Ammortamento</div><div class="chips" id="f-ams"></div></div>
          <div><div class="lbl">Note</div><input class="inp" id="f-note" placeholder="Opzionale..." value="${expense?.note || ""}" autocomplete="off"></div>
          <div id="f-preview"></div>
          <button class="btn-p" id="f-submit">${isEdit ? "Salva modifiche" : "Aggiungi spesa"}</button>
          ${isEdit ? '<button class="del-btn form-delete" id="f-delete">Elimina spesa</button>' : ""}
        </div>
      </div>
    </div>
  `;
  overlay.classList.remove("hidden");

  renderFormContent();

  // Focus on name field (slight delay for animation)
  setTimeout(() => overlay.querySelector("#f-name")?.focus(), 100);

  // Amount change → update preview
  overlay.querySelector("#f-amount")?.addEventListener("input", updatePreview);

  // Close
  const close = () => overlay.classList.add("hidden");
  overlay.querySelector("#form-close").addEventListener("click", close);
  overlay.querySelector(".overlay-bg").addEventListener("click", (ev) => {
    if (ev.target.classList.contains("overlay-bg")) close();
  });

  // Submit
  overlay.querySelector("#f-submit").addEventListener("click", () => {
    const name = overlay.querySelector("#f-name").value.trim();
    const amount = parseFloat(overlay.querySelector("#f-amount").value);
    const date = overlay.querySelector("#f-date").value;
    const note = overlay.querySelector("#f-note").value.trim();
    if (!name || !amount) return;
    onSubmit({ name, amount, date, cat: selectedCat, am: selectedAm, note });
    close();
  });

  // Delete (edit mode only)
  overlay.querySelector("#f-delete")?.addEventListener("click", () => {
    if (confirm("Eliminare questa spesa?")) {
      onSubmit(null); // null signals deletion
      close();
    }
  });
}
