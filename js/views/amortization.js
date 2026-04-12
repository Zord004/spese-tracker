import {
  amortizationTimeline,
  activeAmortizations,
  getCategoryById,
  getAmortizationMonths,
} from "../models.js";
import {
  formatCurrency,
  currentMonthKey,
  monthLabel,
  progressBar,
} from "../utils.js";

/**
 * Render the amortization overview.
 * @param {HTMLElement} container
 * @param {Array} expenses
 */
export function renderAmortization(container, expenses) {
  const timeline = amortizationTimeline(expenses);
  const active = activeAmortizations(expenses);
  const nowMK = currentMonthKey();
  const maxVal = Math.max(...timeline.map(([, v]) => v), 1);

  const timelineHTML =
    timeline.length === 0
      ? '<div class="empty">Nessuna spesa con ammortamento</div>'
      : timeline
          .map(([mk, val]) => {
            const isCurrent = mk === nowMK;
            return `
              <div style="margin-bottom:11px">
                <div class="amort-timeline-row">
                  <span class="o" style="font-size:12px;font-weight:${isCurrent ? 700 : 400};color:${isCurrent ? "#c4b5fd" : "rgba(255,255,255,0.35)"}">
                    ${monthLabel(mk)}${isCurrent ? " ●" : ""}
                  </span>
                  <span class="o" style="font-size:12px;font-weight:600;color:${isCurrent ? "#c4b5fd" : "rgba(255,255,255,0.4)"}">
                    ${formatCurrency(val)}
                  </span>
                </div>
                ${progressBar(val / maxVal, isCurrent ? "#7c3aed" : "rgba(255,255,255,0.08)")}
              </div>
            `;
          })
          .join("");

  const activeHTML =
    active.length === 0
      ? '<div class="empty">Nessuno</div>'
      : active
          .map((e) => {
            const c = getCategoryById(e.cat);
            const months = getAmortizationMonths(e);
            return `
              <div class="active-amort-row">
                <div class="active-amort-top">
                  <span style="font-size:13px">${c.icon} ${e.name}</span>
                  <span class="o" style="font-size:13px;font-weight:600;color:${c.color}">
                    ${formatCurrency(e.amount / e.am)}/m
                  </span>
                </div>
                <div class="active-amort-sub o">
                  ${formatCurrency(e.amount)} tot · Fine ${monthLabel(months[months.length - 1])}
                </div>
              </div>
            `;
          })
          .join("");

  container.innerHTML = `
    <div class="card">
      <div class="lbl">Timeline ammortamenti</div>
      <div class="o" style="font-size:12px;color:rgba(255,255,255,0.25);margin-top:2px;margin-bottom:14px">
        Costo mensile nel tempo
      </div>
      ${timelineHTML}
    </div>

    <div class="card">
      <div class="lbl" style="margin-bottom:8px">Attivi questo mese</div>
      ${activeHTML}
    </div>
  `;
}
