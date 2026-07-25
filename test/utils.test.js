import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, formatCurrency, monthKey, monthLabel, monthShort, addMonths, todayISO, currentMonthKey, currentYear } from "../public/js/utils.js";

describe("escapeHtml", () => {
  test("neutralizza i caratteri pericolosi", () => {
    assert.equal(escapeHtml('<script>alert("x")</script>'), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    assert.equal(escapeHtml("Bar & Caffè"), "Bar &amp; Caffè");
    assert.equal(escapeHtml("l'ombrello"), "l&#39;ombrello");
  });
  test("restituisce stringa vuota per valori non stringa", () => {
    assert.equal(escapeHtml(null), "");
    assert.equal(escapeHtml(undefined), "");
    assert.equal(escapeHtml(42), "");
  });
});

describe("formatCurrency", () => {
  test("usa il simbolo euro e la virgola decimale italiana", () => {
    assert.match(formatCurrency(64.3), /€/);
    assert.match(formatCurrency(64.3), /64,30/);
  });
  test("sotto 1000 mostra i centesimi", () => {
    assert.match(formatCurrency(999.99), /999,99/);
  });
  // Scelta dell'app: da 1000 in su i centesimi si perdono per non affollare le cifre
  test("da 1000 in su arrotonda all'euro", () => {
    assert.doesNotMatch(formatCurrency(1234.5), /,/);
    assert.match(formatCurrency(1234.5), /1235/);
  });
  test("raggruppa le migliaia sopra le cinque cifre", () => {
    assert.match(formatCurrency(12345.67), /12\.346/);
  });
  test("gestisce zero e negativi", () => {
    assert.match(formatCurrency(0), /0,00/);
    assert.match(formatCurrency(-50.5), /^-/);
  });
});

describe("monthKey / monthLabel / monthShort", () => {
  test("estrae la chiave YYYY-MM", () => {
    assert.equal(monthKey("2026-03-15"), "2026-03");
    assert.equal(monthKey("2026-12-31"), "2026-12");
  });
  test("etichette italiane", () => {
    assert.equal(monthLabel("2026-01"), "Gen 2026");
    assert.equal(monthLabel("2026-08"), "Ago 2026");
    assert.equal(monthShort("2026-05"), "Mag");
  });
});

describe("addMonths", () => {
  test("somma semplice", () => {
    assert.equal(addMonths("2026-03-15", 2).toISOString().slice(0, 10), "2026-05-15");
  });
  test("attraversa il cambio d'anno", () => {
    assert.equal(addMonths("2026-11-10", 3).toISOString().slice(0, 10), "2027-02-10");
  });
  // Regressione: il bug classico di setMonth faceva diventare 31 gen → 3 mar
  test("non trabocca partendo da fine mese", () => {
    assert.equal(addMonths("2026-01-31", 1).toISOString().slice(0, 10), "2026-02-28");
    assert.equal(addMonths("2026-08-31", 1).toISOString().slice(0, 10), "2026-09-30");
    assert.equal(addMonths("2026-05-31", 1).toISOString().slice(0, 10), "2026-06-30");
  });
  test("gestisce l'anno bisestile", () => {
    assert.equal(addMonths("2028-01-31", 1).toISOString().slice(0, 10), "2028-02-29");
  });
  test("accetta valori negativi", () => {
    assert.equal(addMonths("2026-03-15", -1).toISOString().slice(0, 10), "2026-02-15");
  });
});

describe("helper sulla data corrente", () => {
  test("todayISO ha il formato YYYY-MM-DD", () => {
    assert.match(todayISO(), /^\d{4}-\d{2}-\d{2}$/);
  });
  test("currentMonthKey ha il formato YYYY-MM", () => {
    assert.match(currentMonthKey(), /^\d{4}-\d{2}$/);
  });
  test("currentYear restituisce un anno plausibile", () => {
    assert.ok(currentYear() >= 2024 && currentYear() < 2100);
  });
});
