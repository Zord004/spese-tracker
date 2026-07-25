import { AMORT_OPTIONS, RECURRENCE_OPTIONS, NATURE_OPTIONS, TYPE_OPTIONS, DEDUCTION_DEFAULTS, DEFAULT_CATEGORY, CURRENCIES } from "../constants.js";
import { expenseCategories, incomeCategories } from "../catalog.js";
import { escapeHtml, formatCurrency, todayISO } from "../utils.js";

let _acDebounce = null, _acController = null;
async function fetchSuggestions(q) {
  if (!q || q.length < 2) return [];
  if (_acController) _acController.abort();
  _acController = new AbortController();
  try {
    const r = await fetch(`/api/autocomplete?q=${encodeURIComponent(q)}`, { signal: _acController.signal });
    const d = await r.json();
    return d.ok ? d.results : [];
  } catch { return []; }
}
function isCustomRecur(v) { return typeof v === "string" && /^Ogni\s+\d+\s+mes/i.test(v); }
function extractCustomMonths(v) { const m = String(v).match(/\d+/); return m ? parseInt(m[0]) : 1; }

export function showExpenseForm(overlay, expense, onSubmit) {
  const isEdit = !!(expense && expense.id);
  let selType = expense?.type || "spesa";
  let selCat = expense?.cat || DEFAULT_CATEGORY;
  let selCurrency = expense?.currency || "EUR";
  let selAm = expense?.am || 1;
  let customAmOpen = false;
  let selRecur = expense?.recur || "Nessuna";
  let customRecurOpen = false;
  let customRecurMonths = isCustomRecur(selRecur) ? extractCustomMonths(selRecur) : 2;
  let selNature = expense?.nature || "variabile";
  let detraibile = !!expense?.detraibile;
  let detrazionePct = expense?.detrazionePct != null ? expense.detrazionePct : (DEDUCTION_DEFAULTS[selCat] || 0);
  let utilizzi = expense?.utilizzi || 0;
  let selectedLocation = expense?.location || "";
  let advancedOpen = false;

  if (isEdit) {
    if (isCustomRecur(expense.recur)) customRecurOpen = true;
    const predefinedAm = [1, 3, 6, 12, 24, 36, 60];
    if (expense.am && !predefinedAm.includes(expense.am)) customAmOpen = true;
    if (expense.detraibile || (expense.utilizzi || 0) > 0 || expense.nature === "fisso") advancedOpen = true;
  }

  function chips(elId, items, sel, onSel) {
    const el = overlay.querySelector(`#${elId}`);
    if (!el) return;
    el.innerHTML = items.map(it => {
      const on = (it.value || it.id) === sel;
      return `<button class="chip ${on ? "on" : ""}" data-val="${it.value || it.id}" type="button">${it.color ? `<span class="chip-dot" style="background:${it.color}"></span>` : ""}${escapeHtml(it.label || it.id)}</button>`;
    }).join("");
    el.querySelectorAll(".chip").forEach(b => b.addEventListener("click", () => onSel(b.dataset.val)));
  }

  function preview() {
    const amt = parseFloat(overlay.querySelector("#f-amount")?.value || 0);
    const el = overlay.querySelector("#f-preview");
    if (!el) return;
    const parts = [];
    const amVal = customAmOpen ? (parseInt(overlay.querySelector("#f-am-custom")?.value) || 1) : selAm;
    const recurVal = customRecurOpen ? `Ogni ${customRecurMonths} mesi` : selRecur;
    if (amt && amVal > 1) parts.push(`${formatCurrency(amt / amVal)}/mese × ${amVal} mesi`);
    if (amt && recurVal === "Giornaliera") parts.push(`${formatCurrency(amt * 30)}/mese`);
    else if (amt && recurVal === "Mensile") parts.push(`${formatCurrency(amt)}/mese`);
    else if (amt && recurVal === "Trimestrale") parts.push(`${formatCurrency(amt / 3)}/mese`);
    else if (amt && recurVal === "Annuale") parts.push(`${formatCurrency(amt / 12)}/mese`);
    else if (amt && isCustomRecur(recurVal)) { const n = extractCustomMonths(recurVal); parts.push(`${formatCurrency(amt / n)}/mese (ogni ${n}m)`); }
    if (amt && detraibile && detrazionePct > 0 && selType === "spesa") parts.push(`detrai ${formatCurrency(amt * detrazionePct / 100)}`);
    if (amt && utilizzi > 0) parts.push(`${formatCurrency(amt / utilizzi)} per uso`);
    el.innerHTML = parts.length ? `<div class="pv">${parts.join(" · ")}</div>` : "";
  }

  function renderChips() {
    chips("f-type", TYPE_OPTIONS, selType, v => {
      selType = v;
      const newList = v === "entrata" ? incomeCategories() : expenseCategories();
      if (!newList.find(c => c.id === selCat)) selCat = newList[0].id;
      renderChips();
      overlay.querySelector("#expense-only")?.classList.toggle("hidden", v === "entrata");
      preview();
    });
    const catList = selType === "entrata" ? incomeCategories() : expenseCategories();
    chips("f-cat", catList.map(c => ({ ...c, value: c.id, label: c.id })), selCat, v => {
      selCat = v;
      if (detraibile) { detrazionePct = DEDUCTION_DEFAULTS[v] || 0; const inp = overlay.querySelector("#f-detrazione-pct"); if (inp) inp.value = detrazionePct; }
      renderChips();
    });
    chips("f-recur", RECURRENCE_OPTIONS, customRecurOpen ? "custom" : selRecur, v => {
      if (v === "custom") customRecurOpen = true; else { customRecurOpen = false; selRecur = v; }
      renderChips();
      overlay.querySelector("#custom-recur-box")?.classList.toggle("hidden", !customRecurOpen);
      preview();
    });
    chips("f-am", AMORT_OPTIONS, customAmOpen ? "custom" : selAm, v => {
      if (v === "custom") customAmOpen = true; else { customAmOpen = false; selAm = parseInt(v); }
      renderChips();
      overlay.querySelector("#custom-am-box")?.classList.toggle("hidden", !customAmOpen);
      preview();
    });
    chips("f-nature", NATURE_OPTIONS, selNature, v => { selNature = v; renderChips(); });
    preview();
  }

  overlay.innerHTML = `
    <div class="overlay">
      <div class="sheet">
        <div class="sheet-header">
          <span class="sheet-title">${isEdit ? "Modifica movimento" : "Nuovo movimento"}</span>
          <button class="sheet-close" id="form-close">×</button>
        </div>

        <div class="field"><div class="segmented" id="f-type"></div></div>

        <div class="field">
          <label class="field-label">Importo</label>
          <div class="amount-row">
            <input class="input amount-input tnum" id="f-amount" type="number" step="0.01" placeholder="0,00" value="${(expense?.currency && expense.currency !== "EUR" && expense.originalAmount != null) ? expense.originalAmount : (expense?.amount || "")}" inputmode="decimal">
            <select class="input currency-select" id="f-currency">
              ${CURRENCIES.map(c => `<option value="${c}" ${c === selCurrency ? "selected" : ""}>${c}</option>`).join("")}
            </select>
          </div>
          <div id="f-eur-preview" class="eur-preview ${selCurrency === "EUR" ? "hidden" : ""}"></div>
        </div>

        <div class="field">
          <label class="field-label">Descrizione</label>
          <input class="input" id="f-name" placeholder="es. Spesa Esselunga, Stipendio…" value="${escapeHtml(expense?.name || "")}" autocomplete="off">
        </div>

        <div class="field">
          <label class="field-label">Data</label>
          <input class="input" id="f-date" type="date" value="${expense?.date || todayISO()}">
        </div>

        <div class="field">
          <label class="field-label">Categoria</label>
          <div class="chips" id="f-cat"></div>
        </div>

        <div class="field">
          <label class="field-label">Ricorrenza</label>
          <div class="chips" id="f-recur"></div>
          <div id="custom-recur-box" class="${customRecurOpen ? "" : "hidden"}" style="margin-top:10px">
            <div style="display:flex;align-items:center;gap:8px">
              <span class="field-label" style="margin:0">Ogni</span>
              <input class="input" id="f-recur-custom" type="number" min="1" max="120" value="${customRecurMonths}" inputmode="numeric" style="flex:1">
              <span class="field-label" style="margin:0">mesi</span>
            </div>
          </div>
        </div>

        <div id="expense-only" class="${selType === "entrata" ? "hidden" : ""}">
          <div class="field">
            <label class="field-label">Ammortamento</label>
            <div class="chips" id="f-am"></div>
            <div id="custom-am-box" class="${customAmOpen ? "" : "hidden"}" style="margin-top:10px">
              <div style="display:flex;align-items:center;gap:8px">
                <input class="input" id="f-am-custom" type="number" min="1" max="360" value="${customAmOpen ? (expense?.am || 12) : 12}" inputmode="numeric" style="flex:1">
                <span class="field-label" style="margin:0">mesi</span>
              </div>
            </div>
          </div>

          <div class="field">
            <label class="field-label">Posizione (opzionale)</label>
            <div style="position:relative">
              <input class="input" id="f-location" placeholder="Cerca un luogo…" value="${escapeHtml(selectedLocation)}" autocomplete="off">
              <div id="loc-sugs" class="loc-sugs hidden"></div>
            </div>
          </div>

          <div class="adv-wrap">
            <div class="toggle-row" id="adv-toggle" style="border-bottom:${advancedOpen ? "1px solid var(--line)" : "none"}">
              <div class="toggle-info"><div class="toggle-title">Opzioni avanzate</div><div class="toggle-sub">Natura, detraibilità, utilizzi</div></div>
              <span style="color:var(--ink-3);font-size:18px;transition:transform .2s${advancedOpen ? ";transform:rotate(90deg)" : ""}" id="adv-chev">›</span>
            </div>
            <div id="adv-content" class="${advancedOpen ? "" : "hidden"}">
              <div class="field" style="margin-top:14px">
                <label class="field-label">Natura</label>
                <div class="chips" id="f-nature"></div>
              </div>
              <label class="toggle-row">
                <div class="toggle-info"><div class="toggle-title">Detraibile</div><div class="toggle-sub">Per la dichiarazione dei redditi</div></div>
                <input type="checkbox" id="f-detraibile" ${detraibile ? "checked" : ""}>
                <span class="toggle-slider"></span>
              </label>
              <div id="detrazione-box" class="${detraibile ? "" : "hidden"}" style="padding:12px 0">
                <div style="display:flex;align-items:center;gap:8px">
                  <span class="field-label" style="margin:0">Detrazione</span>
                  <input class="input" id="f-detrazione-pct" type="number" min="0" max="100" step="1" value="${detrazionePct}" inputmode="decimal" style="flex:1">
                  <span class="field-label" style="margin:0">%</span>
                </div>
              </div>
              <div style="padding:14px 0">
                <div class="field-label" style="margin-bottom:8px">Utilizzi (per il costo per uso)</div>
                <div class="stepper">
                  <button class="stepper-btn" type="button" id="uses-minus">−</button>
                  <input class="input stepper-input tnum" id="f-utilizzi" type="number" min="0" value="${utilizzi}" inputmode="numeric">
                  <button class="stepper-btn" type="button" id="uses-plus">+</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="field">
          <label class="field-label">Note</label>
          <input class="input" id="f-note" placeholder="Opzionale" value="${escapeHtml(expense?.note || "")}" autocomplete="off">
        </div>

        <div id="f-preview" class="form-preview"></div>

        <button class="btn btn-primary" id="f-submit">${isEdit ? "Salva modifiche" : "Registra movimento"}</button>
        ${isEdit ? `<button class="btn btn-danger" id="f-delete" style="margin-top:10px">Elimina movimento</button>` : ""}
      </div>
    </div>
  `;

  overlay.classList.remove("hidden");
  renderChips();
  setTimeout(() => overlay.querySelector("#f-amount")?.focus(), 80);

  overlay.querySelector("#f-amount")?.addEventListener("input", preview);
  overlay.querySelector("#f-am-custom")?.addEventListener("input", preview);

  // Conversione valuta: mostra l'equivalente in EUR
  let convTimer;
  async function updateEurPreview() {
    const el = overlay.querySelector("#f-eur-preview");
    if (!el) return;
    const cur = overlay.querySelector("#f-currency")?.value || "EUR";
    el.classList.toggle("hidden", cur === "EUR");
    if (cur === "EUR") return;
    const amt = parseFloat(overlay.querySelector("#f-amount")?.value || 0);
    if (!amt) { el.textContent = ""; return; }
    el.textContent = "conversione…";
    try {
      const r = await fetch(`/api/convert?currency=${cur}&amount=${amt}`);
      const d = await r.json();
      if (d.ok) el.textContent = `≈ ${formatCurrency(d.eur)}  ·  1 ${cur} = ${d.rate.toFixed(4)} €`;
      else el.textContent = "cambio non disponibile ora (verrà convertito al salvataggio)";
    } catch { el.textContent = "cambio non disponibile offline"; }
  }
  overlay.querySelector("#f-currency")?.addEventListener("change", () => { selCurrency = overlay.querySelector("#f-currency").value; updateEurPreview(); });
  overlay.querySelector("#f-amount")?.addEventListener("input", () => { clearTimeout(convTimer); convTimer = setTimeout(updateEurPreview, 350); });
  if (selCurrency !== "EUR") updateEurPreview();
  overlay.querySelector("#f-recur-custom")?.addEventListener("input", ev => { customRecurMonths = Math.max(1, parseInt(ev.target.value) || 1); preview(); });

  overlay.querySelector("#adv-toggle")?.addEventListener("click", () => {
    advancedOpen = !advancedOpen;
    overlay.querySelector("#adv-content")?.classList.toggle("hidden", !advancedOpen);
    const chev = overlay.querySelector("#adv-chev");
    if (chev) chev.style.transform = advancedOpen ? "rotate(90deg)" : "";
    overlay.querySelector("#adv-toggle").style.borderBottom = advancedOpen ? "1px solid var(--line)" : "none";
  });

  overlay.querySelector("#f-detraibile")?.addEventListener("change", ev => {
    detraibile = ev.target.checked;
    overlay.querySelector("#detrazione-box")?.classList.toggle("hidden", !detraibile);
    if (detraibile && detrazionePct === 0) { detrazionePct = DEDUCTION_DEFAULTS[selCat] || 19; const inp = overlay.querySelector("#f-detrazione-pct"); if (inp) inp.value = detrazionePct; }
    preview();
  });
  overlay.querySelector("#f-detrazione-pct")?.addEventListener("input", ev => { detrazionePct = parseFloat(ev.target.value) || 0; preview(); });

  const useInp = overlay.querySelector("#f-utilizzi");
  useInp?.addEventListener("input", () => { utilizzi = parseInt(useInp.value) || 0; preview(); });
  overlay.querySelector("#uses-minus")?.addEventListener("click", () => { utilizzi = Math.max(0, utilizzi - 1); useInp.value = utilizzi; preview(); });
  overlay.querySelector("#uses-plus")?.addEventListener("click", () => { utilizzi++; useInp.value = utilizzi; preview(); });

  const locInput = overlay.querySelector("#f-location");
  const sugBox = overlay.querySelector("#loc-sugs");
  function showSugs(results) {
    if (!results.length) { sugBox.classList.add("hidden"); return; }
    sugBox.innerHTML = results.map((r, i) => {
      const sub = [r.city, r.country].filter(Boolean).join(", ");
      return `<div class="loc-sug" data-idx="${i}"><div class="n">${escapeHtml(r.display || r.name)}</div>${sub ? `<div class="m">${escapeHtml(sub)}</div>` : ""}</div>`;
    }).join("");
    sugBox.classList.remove("hidden");
    sugBox.querySelectorAll("[data-idx]").forEach(el => el.addEventListener("mousedown", ev => {
      ev.preventDefault();
      const picked = results[parseInt(el.dataset.idx)];
      if (picked) { selectedLocation = picked.name; locInput.value = picked.name; }
      sugBox.classList.add("hidden");
    }));
  }
  locInput?.addEventListener("input", () => {
    const val = locInput.value.trim();
    clearTimeout(_acDebounce);
    if (val.length < 2) { sugBox.classList.add("hidden"); return; }
    _acDebounce = setTimeout(async () => showSugs(await fetchSuggestions(val)), 300);
  });
  locInput?.addEventListener("blur", () => setTimeout(() => sugBox?.classList.add("hidden"), 200));

  const close = () => { overlay.classList.add("hidden"); clearTimeout(_acDebounce); };
  overlay.querySelector("#form-close").addEventListener("click", close);
  overlay.querySelector(".overlay").addEventListener("click", ev => { if (ev.target.classList.contains("overlay")) close(); });

  overlay.querySelector("#f-submit").addEventListener("click", () => {
    const name = overlay.querySelector("#f-name").value.trim();
    const amount = parseFloat(overlay.querySelector("#f-amount").value);
    const date = overlay.querySelector("#f-date").value;
    const note = overlay.querySelector("#f-note").value.trim();
    const location = overlay.querySelector("#f-location")?.value.trim() || "";
    if (!name || !amount || amount <= 0) { overlay.querySelector("#f-amount").focus(); return; }

    const amFinal = selType === "entrata" ? 1 : (customAmOpen ? Math.max(1, parseInt(overlay.querySelector("#f-am-custom").value) || 1) : selAm);
    let recurFinal = selRecur;
    if (customRecurOpen) { const n = Math.max(1, parseInt(overlay.querySelector("#f-recur-custom").value) || 1); recurFinal = `Ogni ${n} mesi`; }

    onSubmit({
      type: selType, name, amount, date, cat: selCat,
      am: amFinal, recur: recurFinal,
      nature: selType === "entrata" ? "variabile" : selNature,
      note, location,
      currency: selCurrency || "EUR",
      detraibile: selType === "entrata" ? false : detraibile,
      detrazionePct: (selType === "entrata" || !detraibile) ? 0 : detrazionePct,
      utilizzi: selType === "entrata" ? 0 : utilizzi,
    });
    close();
  });

  overlay.querySelector("#f-delete")?.addEventListener("click", () => { if (confirm("Eliminare questo movimento?")) { onSubmit(null); close(); } });
}
