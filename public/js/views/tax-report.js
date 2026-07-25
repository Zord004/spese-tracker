import { taxReport, getCategoryById } from "../models.js";
import { escapeHtml, formatCurrency, formatDateLong, currentYear } from "../utils.js";
import { store } from "../store.js";

export function showTaxReport(overlay, expenses, year = currentYear()) {
  let yr = year;

  function render() {
    const profile = store.getTaxProfile();
    const t = taxReport(expenses, yr);
    const incomeItems = t.incomeItems || [];

    const years = new Set();
    const thisY = new Date().getFullYear();
    years.add(thisY); years.add(thisY - 1);
    expenses.forEach(e => { if (e.date) years.add(new Date(e.date).getFullYear()); });
    const sortedYears = [...years].sort((a, b) => b - a);

    overlay.innerHTML = `
      <div class="overlay">
        <div class="sheet">
          <div class="sheet-header">
            <span class="sheet-title">Report fiscale</span>
            <div style="display:flex;gap:8px">
              <button class="sheet-close no-print" id="tax-print" title="Stampa" style="font-size:14px">⎙</button>
              <button class="sheet-close" id="tax-close">×</button>
            </div>
          </div>

          <div class="chips no-print" style="margin-bottom:22px">
            ${sortedYears.map(y => `<button class="chip ${y === yr ? "on" : ""}" data-year="${y}">${y}</button>`).join("")}
          </div>

          <div class="tax-block">
            <div class="tax-block-title">Dati anagrafici</div>
            <div class="profile-grid">
              ${pf("name", "Nome e cognome", "Mario Rossi", profile)}
              ${pf("cf", "Codice fiscale", "RSSMRA80A01H501U", profile, "text-transform:uppercase")}
              ${pf("birth", "Data di nascita", "", profile, "", "date")}
              ${pf("birthplace", "Luogo di nascita", "Milano", profile)}
              ${pf("address", "Indirizzo di residenza", "Via Roma 1", profile)}
              ${pf("city", "Città / CAP", "20100 Milano", profile)}
              ${pf("email", "Email", "mario@esempio.it", profile, "", "email")}
              ${pf("phone", "Telefono", "+39…", profile)}
              ${pf("vat", "Partita IVA", "IT12345678901", profile)}
              ${pf("employer", "Datore / Sostituto d'imposta", "Nome azienda", profile)}
            </div>
            <button class="btn btn-secondary no-print" id="save-profile" style="margin-top:12px">Salva dati anagrafici</button>
          </div>

          <div class="tax-block">
            <div class="tax-block-title">Bilancio ${yr}</div>
            <div class="tax-balance">
              <div class="cell"><div class="l">Entrate</div><div class="v tnum" style="color:var(--credit)">${formatCurrency(t.totalIncome)}</div></div>
              <div class="cell"><div class="l">Uscite</div><div class="v tnum">${formatCurrency(t.totalAllSpent)}</div></div>
              <div class="cell"><div class="l">Bilancio</div><div class="v tnum" style="color:${t.balance >= 0 ? "var(--credit)" : "var(--debit)"}">${t.balance >= 0 ? "+" : ""}${formatCurrency(t.balance)}</div></div>
            </div>
            ${t.totalDeduction > 0 ? `
              <div class="credit-card" style="margin:16px 0 0">
                <div class="cc-eye">Credito d'imposta stimato</div>
                <div class="cc-fig tnum"><span class="cur">€</span> ${formatCurrency(t.totalDeduction).replace("€", "").trim()}</div>
                <div class="cc-sub">su ${formatCurrency(t.totalSpent)} di spese detraibili · ${t.items.length} voci</div>
              </div>
            ` : ""}
          </div>

          ${incomeItems.length ? `
            <div class="tax-block">
              <div class="tax-block-title">Entrate ${yr}</div>
              <div class="card" style="margin:0">
                <table class="ftable">
                  <thead><tr><th>Data</th><th>Descrizione</th><th class="r">Importo</th></tr></thead>
                  <tbody>
                    ${incomeItems.map(e => `<tr><td>${formatDateLong(e.date)}</td><td>${escapeHtml(e.name)}<div class="sub-note">${escapeHtml(e.cat)}</div></td><td class="r" style="color:var(--credit)">+${formatCurrency(e.amount)}</td></tr>`).join("")}
                    <tr class="tot"><td colspan="2">Totale entrate</td><td class="r" style="color:var(--credit)">${formatCurrency(t.totalIncome)}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          ` : ""}

          ${t.allByCategory.length ? `
            <div class="tax-block">
              <div class="tax-block-title">Tutte le spese ${yr}</div>
              ${t.allByCategory.map(cat => {
                const c = getCategoryById(cat.category);
                return `<div class="tax-cat">
                  <div class="tax-cat-head">
                    <div class="n"><span class="swatch" style="background:${c.color}"></span>${escapeHtml(cat.category)} <span style="color:var(--ink-3);font-size:12px;font-weight:400">(${cat.count})</span></div>
                    <span class="catrow-amt tnum">${formatCurrency(cat.spent)}</span>
                  </div>
                  <div class="card" style="margin:0">
                    <table class="ftable">
                      <thead><tr><th>Data</th><th>Descrizione</th><th class="r">Importo</th><th style="text-align:center">Detr.</th></tr></thead>
                      <tbody>
                        ${cat.items.map(it => `<tr><td>${formatDateLong(it.date)}</td><td>${escapeHtml(it.name)}${it.note ? `<div class="sub-note">${escapeHtml(it.note)}</div>` : ""}</td><td class="r">${formatCurrency(it.amount)}</td><td style="text-align:center">${it.detraibile ? `<span style="color:var(--credit)">✓</span>` : ""}</td></tr>`).join("")}
                      </tbody>
                    </table>
                  </div>
                </div>`;
              }).join("")}
              <div class="tax-total-row"><span style="font-weight:700">Totale uscite</span><span class="big tnum">${formatCurrency(t.totalAllSpent)}</span></div>
            </div>
          ` : ""}

          ${t.byCategory.length ? `
            <div class="tax-block">
              <div class="tax-block-title">Detrazioni 730 / Unico ${yr}</div>
              ${t.byCategory.map(cat => {
                const c = getCategoryById(cat.category);
                return `<div class="tax-cat">
                  <div class="tax-cat-head">
                    <div class="n"><span class="swatch" style="background:${c.color}"></span>${escapeHtml(cat.category)} <span style="color:var(--ink-3);font-size:12px;font-weight:400">${formatCurrency(cat.spent)} spesi</span></div>
                    <span class="catrow-amt tnum" style="color:var(--credit)">+${formatCurrency(cat.deduction)}</span>
                  </div>
                  <div class="card" style="margin:0">
                    <table class="ftable">
                      <thead><tr><th>Data</th><th>Descrizione</th><th class="r">Spesa</th><th class="r">%</th><th class="r">Detraz.</th></tr></thead>
                      <tbody>
                        ${cat.items.map(it => `<tr><td>${formatDateLong(it.date)}</td><td>${escapeHtml(it.name)}</td><td class="r">${formatCurrency(it.amount)}</td><td class="r">${it.detrazionePct}%</td><td class="r" style="color:var(--credit)">${formatCurrency(it.deduction)}</td></tr>`).join("")}
                      </tbody>
                    </table>
                  </div>
                </div>`;
              }).join("")}
              <div class="tax-total-row"><span style="font-weight:700">Credito d'imposta totale</span><span class="big tnum" style="color:var(--credit)">+${formatCurrency(t.totalDeduction)}</span></div>
            </div>
          ` : ""}

          <div class="no-print" style="font-size:11px;color:var(--ink-3);text-align:center;padding:16px 4px;line-height:1.6">
            I calcoli sono indicativi. Consulta sempre il tuo commercialista per la dichiarazione effettiva.<br>
            Stime al lordo di franchigie, tetti per fasce di reddito e limiti massimi.
          </div>

          <button class="btn btn-secondary no-print" id="tax-download">Scarica come testo</button>
        </div>
      </div>
    `;

    overlay.classList.remove("hidden");
    overlay.querySelectorAll("[data-year]").forEach(b => b.addEventListener("click", () => { yr = parseInt(b.dataset.year); render(); }));
    overlay.querySelector("#save-profile")?.addEventListener("click", () => {
      const p = {};
      ["name", "cf", "birth", "birthplace", "address", "city", "email", "phone", "vat", "employer"].forEach(k => {
        let val = overlay.querySelector(`#p-${k}`)?.value.trim() || "";
        if (k === "cf") val = val.toUpperCase();
        p[k] = val;
      });
      store.setTaxProfile(p);
      const btn = overlay.querySelector("#save-profile");
      btn.textContent = "✓ Salvato"; setTimeout(() => { btn.textContent = "Salva dati anagrafici"; }, 1200);
    });
    overlay.querySelector("#tax-print")?.addEventListener("click", () => window.print());
    overlay.querySelector("#tax-download")?.addEventListener("click", () => {
      const lines = generatePlainReport(t, store.getTaxProfile(), yr);
      const blob = new Blob([lines], { type: "text/plain;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = `report-fiscale-${yr}.txt`; a.click();
      URL.revokeObjectURL(a.href);
    });
    overlay.querySelector("#tax-close")?.addEventListener("click", () => overlay.classList.add("hidden"));
    overlay.querySelector(".overlay")?.addEventListener("click", ev => { if (ev.target.classList.contains("overlay")) overlay.classList.add("hidden"); });
  }
  render();
}

function pf(key, label, placeholder, profile, style = "", type = "text") {
  return `<div class="field" style="margin-bottom:0"><label class="field-label">${label}</label><input class="input" id="p-${key}" type="${type}" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(profile[key] || "")}" style="${style}"></div>`;
}

function generatePlainReport(t, profile, year) {
  const hr = "═".repeat(64), thin = "─".repeat(64);
  let out = `${hr}\nREPORT FISCALE — Anno ${year}\nGenerato: ${new Date().toLocaleString("it-IT")}\n${hr}\n\n`;
  if (Object.keys(profile).length) {
    out += `DATI ANAGRAFICI\n${thin}\n`;
    if (profile.name) out += `Nome: ${profile.name}\n`;
    if (profile.cf) out += `CF: ${profile.cf}\n`;
    if (profile.birth) out += `Nato il ${new Date(profile.birth).toLocaleDateString("it-IT")}${profile.birthplace ? ` a ${profile.birthplace}` : ""}\n`;
    if (profile.address) out += `Residenza: ${profile.address}${profile.city ? `, ${profile.city}` : ""}\n`;
    if (profile.email) out += `Email: ${profile.email}\n`;
    if (profile.phone) out += `Tel: ${profile.phone}\n`;
    if (profile.vat) out += `P.IVA: ${profile.vat}\n`;
    if (profile.employer) out += `Datore: ${profile.employer}\n`;
    out += "\n";
  }
  out += `BILANCIO ${year}\n${thin}\n`;
  out += `Entrate:               ${formatCurrency(t.totalIncome).padStart(14)}\n`;
  out += `Uscite:                ${formatCurrency(t.totalAllSpent).padStart(14)}\n`;
  out += `BILANCIO:              ${((t.balance >= 0 ? "+" : "") + formatCurrency(t.balance)).padStart(14)}\n\n`;
  out += `Spese detraibili:      ${formatCurrency(t.totalSpent).padStart(14)}\n`;
  out += `CREDITO D'IMPOSTA:     ${formatCurrency(t.totalDeduction).padStart(14)}\n\n`;
  if (t.incomeItems.length) {
    out += `${hr}\nENTRATE\n${thin}\n`;
    t.incomeItems.forEach(e => { out += `${formatDateLong(e.date)}  ${e.name.padEnd(30)} ${e.cat.padEnd(12)} ${formatCurrency(e.amount).padStart(10)}\n`; });
    out += `${thin}\nTotale: ${formatCurrency(t.totalIncome)}\n\n`;
  }
  if (t.allByCategory.length) {
    out += `${hr}\nTUTTE LE SPESE PER CATEGORIA\n${thin}\n`;
    t.allByCategory.forEach(cat => {
      out += `\n[${cat.category}] (${cat.count} · ${formatCurrency(cat.spent)})\n`;
      cat.items.forEach(it => { out += `  ${formatDateLong(it.date)}  ${it.name.padEnd(30)} ${formatCurrency(it.amount).padStart(10)}${it.detraibile ? " *" : ""}\n`; });
    });
    out += `\n${thin}\nTOTALE USCITE: ${formatCurrency(t.totalAllSpent)}\n\n`;
  }
  if (t.byCategory.length) {
    out += `${hr}\nDETRAZIONI 730/UNICO\n${thin}\n`;
    t.byCategory.forEach(cat => {
      out += `\n[${cat.category}] (${cat.count} · ${formatCurrency(cat.spent)} · detraz. ${formatCurrency(cat.deduction)})\n`;
      cat.items.forEach(it => { out += `  ${formatDateLong(it.date)}  ${it.name.padEnd(28)} ${formatCurrency(it.amount).padStart(10)}  ${it.detrazionePct}%  -> ${formatCurrency(it.deduction)}\n`; });
    });
    out += `\n${thin}\nCREDITO D'IMPOSTA: ${formatCurrency(t.totalDeduction)}\n`;
  }
  out += `\n${hr}\n`;
  return out;
}
