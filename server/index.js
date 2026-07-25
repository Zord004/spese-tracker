import "dotenv/config";
import express from "express";
import { Client } from "@notionhq/client";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DATABASE_ID = process.env.NOTION_DATABASE_ID;
if (!process.env.NOTION_TOKEN || !DATABASE_ID) { console.error("Missing .env (NOTION_TOKEN / NOTION_DATABASE_ID)"); process.exit(1); }

// ─────────────────────────────────────────────
// Basic Auth opzionale (attiva solo se le variabili sono presenti)
// ─────────────────────────────────────────────
const AUTH_USER = process.env.BASIC_AUTH_USER;
const AUTH_PASS = process.env.BASIC_AUTH_PASS;
function safeEqual(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
if (AUTH_USER && AUTH_PASS) {
  app.use((req, res, next) => {
    const h = req.headers.authorization || "";
    const [scheme, encoded] = h.split(" ");
    if (scheme === "Basic" && encoded) {
      const [u, p] = Buffer.from(encoded, "base64").toString().split(":");
      if (u && p && safeEqual(u, AUTH_USER) && safeEqual(p, AUTH_PASS)) return next();
    }
    res.set("WWW-Authenticate", 'Basic realm="Spese"').status(401).send("Autenticazione richiesta");
  });
  console.log("  🔒 Basic Auth attiva");
}

app.use(helmet({
  contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-eval'", "https://cdnjs.cloudflare.com"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    imgSrc: ["'self'", "data:", "blob:"],
    connectSrc: ["'self'"],
    frameAncestors: ["'none'"], objectSrc: ["'none'"],
  }}, hidePoweredBy: true,
}));
app.use("/api/", rateLimit({ windowMs: 60000, max: 120 }));
const wl = rateLimit({ windowMs: 60000, max: 40 });
app.use(express.json({ limit: "16kb" }));
app.use((req, res, next) => { if (req.path === "/" || req.path.endsWith(".html") || req.path.endsWith("sw.js")) res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate"); next(); });
app.use(express.static(join(__dirname, ".."), { dotfiles: "deny" }));

// ─────────────────────────────────────────────
// Schema dinamico letto da Notion e tenuto in cache in memoria
// ─────────────────────────────────────────────
const DEFAULT_EXP = ["Tecnologia","Casa","Auto/Moto","Salute","Abbigliamento","Svago","Formazione","Altro","Cibo"];
const DEFAULT_INC = ["Stipendio","Bonus","Mancia","Rimborso","Regalo","Vendita","Altro"];
const INCOME_ONLY = ["Stipendio","Bonus","Mancia","Rimborso","Regalo","Vendita"];
const VR = ["Nessuna","Giornaliera","Mensile","Trimestrale","Annuale"];
const VN = ["variabile","fisso"];
const VT = ["spesa","entrata"];
const CURRENCIES = ["EUR","USD","GBP","JPY","CHF","CAD","AUD","SEK","NOK","DKK"];

// ── Tassi di cambio (Frankfurter) con cache giornaliera in memoria ──
const rateCache = {}; // { "USD": { date, rate } }  rate = 1 unità valuta → EUR
async function getRateToEUR(cur) {
  if (cur === "EUR") return 1;
  const today = new Date().toISOString().slice(0, 10);
  if (rateCache[cur] && rateCache[cur].date === today) return rateCache[cur].rate;
  try {
    const r = await fetch(`https://api.frankfurter.dev/v1/latest?base=${cur}&symbols=EUR`);
    const d = await r.json();
    const rate = d?.rates?.EUR;
    if (rate) { rateCache[cur] = { date: today, rate }; return rate; }
  } catch {}
  // fallback: mirror .app
  try {
    const r = await fetch(`https://api.frankfurter.app/latest?from=${cur}&to=EUR`);
    const d = await r.json();
    const rate = d?.rates?.EUR;
    if (rate) { rateCache[cur] = { date: today, rate }; return rate; }
  } catch {}
  return null; // conversione non disponibile
}

let schema = { expenseCats: [...DEFAULT_EXP], incomeCats: [...DEFAULT_INC], loadedAt: null, source: "default" };

async function loadSchema() {
  try {
    const db = await notion.databases.retrieve({ database_id: DATABASE_ID });
    const props = /** @type {Record<string, any>} */ (db.properties || {});
    const prop = props["Categoria"];
    // Verifica esplicita del tipo: se "Categoria" non fosse più un select,
    // meglio accorgersene qui che ritrovarsi una lista vuota senza spiegazione.
    const opts = (prop?.type === "select" ? (prop.select?.options || []) : []).map(o => o.name).filter(Boolean);
    if (opts.length) {
      const incomeCats = opts.filter(o => INCOME_ONLY.includes(o));
      if (!incomeCats.includes("Altro")) incomeCats.push("Altro");
      const expenseCats = opts.filter(o => !INCOME_ONLY.includes(o));
      if (!expenseCats.includes("Altro")) expenseCats.push("Altro");
      schema = { expenseCats, incomeCats, loadedAt: new Date().toISOString(), source: "notion" };
      console.log(`  📋 Schema Notion caricato: ${expenseCats.length} categorie spesa, ${incomeCats.length} entrate`);
    }
  } catch (e) {
    console.warn("  ⚠️  Impossibile leggere lo schema da Notion, uso i default:", e.message);
  }
  return schema;
}

function esc(s){return typeof s!=="string"?"":s.replace(/[<>&"']/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&#39;"})[c]||c)}
function isCustomRecur(v){return typeof v === "string" && /^Ogni\s+\d+\s+mes/i.test(v)}

// Ritenta le chiamate a Notion in caso di rate limit (429) con backoff esponenziale
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function withRetry(fn, tries = 4) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (err) {
      last = err;
      const status = err?.status || err?.code;
      const is429 = status === 429 || err?.code === "rate_limited" || status === "rate_limited";
      if (!is429 || i === tries - 1) throw err;
      const retryAfter = parseFloat(err?.headers?.["retry-after"]) || 0;
      const wait = retryAfter > 0 ? retryAfter * 1000 : Math.min(8000, 500 * 2 ** i);
      console.warn(`  ⏳ Notion 429, ritento tra ${wait}ms`);
      await sleep(wait);
    }
  }
  throw last;
}

function validate(b) {
  const err = [];
  if (!b.name || typeof b.name !== "string" || !b.name.trim()) err.push("Nome obbligatorio");
  const name = esc(String(b.name||"").trim()).slice(0,200);
  const amount = parseFloat(b.amount);
  if (isNaN(amount) || amount <= 0 || amount > 999999999) err.push("Importo non valido");
  if (!b.date || !/^\d{4}-\d{2}-\d{2}$/.test(b.date)) err.push("Data non valida");
  const date = String(b.date||"").slice(0,10);
  const type = VT.includes(b.type) ? b.type : "spesa";
  const catList = type === "entrata" ? schema.incomeCats : schema.expenseCats;
  const cat = catList.includes(b.cat) ? b.cat : "Altro";
  const am = Math.max(1, Math.min(360, parseInt(b.am) || 1));
  let recur = "Nessuna";
  if (VR.includes(b.recur)) recur = b.recur;
  else if (isCustomRecur(b.recur)) { const n = Math.max(1, Math.min(120, parseInt(String(b.recur).match(/\d+/)[0]))); recur = `Ogni ${n} mesi`; }
  const nature = VN.includes(b.nature) ? b.nature : "variabile";
  const note = esc(String(b.note||"").trim()).slice(0,500);
  const location = esc(String(b.location||"").trim()).slice(0,200);
  const detraibile = !!b.detraibile;
  let detrazionePct = parseFloat(b.detrazionePct) || 0;
  if (detrazionePct < 0) detrazionePct = 0; if (detrazionePct > 100) detrazionePct = 100;
  let utilizzi = parseInt(b.utilizzi) || 0;
  if (utilizzi < 0) utilizzi = 0;
  const currency = CURRENCIES.includes(b.currency) ? b.currency : "EUR";
  if (err.length) return { valid: false, error: err.join("; ") };
  return { valid: true, data: { type, name, amount: Math.round(amount*100)/100, date, cat, am, recur, nature, note, location, detraibile, detrazionePct, utilizzi, currency } };
}
function isId(id){return /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(id)}

// Converte l'importo in EUR se la valuta è diversa. `amount` in ingresso è
// l'importo nella valuta scelta; in uscita `amount` è in EUR e `originalAmount`
// conserva il valore originale.
async function applyCurrency(data) {
  const entered = data.amount;
  if (!data.currency || data.currency === "EUR") { data.originalAmount = entered; data.currency = "EUR"; return; }
  const rate = await getRateToEUR(data.currency);
  if (rate) { data.originalAmount = entered; data.amount = Math.round(entered * rate * 100) / 100; }
  else { data.originalAmount = entered; } // conversione non disponibile: tiene il valore com'è
}

function toExp(pg) {
  const p = pg.properties;
  const t = p["Tipo"]?.select?.name;
  return {
    id: pg.id,
    type: t === "Entrata" ? "entrata" : "spesa",
    name: p["Nome"]?.title?.[0]?.plain_text || "",
    amount: p["Importo"]?.number || 0,
    date: p["Data"]?.date?.start || "",
    cat: p["Categoria"]?.select?.name || "Altro",
    am: p["Mesi ammortamento"]?.number || 1,
    recur: p["Ricorrenza"]?.select?.name || "Nessuna",
    nature: (p["Natura"]?.select?.name || "Variabile").toLowerCase(),
    note: p["Note"]?.rich_text?.[0]?.plain_text || "",
    location: p["Luogo"]?.rich_text?.[0]?.plain_text || "",
    detraibile: !!p["Detraibile"]?.checkbox,
    detrazionePct: p["% Detrazione"]?.number || 0,
    utilizzi: p["Utilizzi"]?.number || 0,
    currency: p["Valuta"]?.select?.name || "EUR",
    originalAmount: p["Importo originale"]?.number ?? null,
  };
}
function toN(d) {
  const nm = { variabile: "Variabile", fisso: "Fisso" };
  const tm = { spesa: "Spesa", entrata: "Entrata" };
  const stdRecur = ["Nessuna","Giornaliera","Mensile","Trimestrale","Annuale"];
  const props = {
    "Nome": { title: [{ text: { content: d.name } }] },
    "Importo": { number: d.amount },
    "Data": { date: { start: d.date } },
    "Categoria": { select: { name: d.cat } },
    "Mesi ammortamento": { number: d.am },
    "Natura": { select: { name: nm[d.nature] || "Variabile" } },
    "Note": { rich_text: [{ text: { content: d.note || "" } }] },
    "Luogo": { rich_text: [{ text: { content: d.location || "" } }] },
    "Detraibile": { checkbox: !!d.detraibile },
    "% Detrazione": { number: d.detrazionePct || 0 },
    "Utilizzi": { number: d.utilizzi || 0 },
    "Tipo": { select: { name: tm[d.type] || "Spesa" } },
    "Valuta": { select: { name: d.currency || "EUR" } },
    "Importo originale": { number: d.originalAmount != null ? d.originalAmount : d.amount },
  };
  props["Ricorrenza"] = { select: { name: stdRecur.includes(d.recur) ? d.recur : "Mensile" } };
  return props;
}

// Estrae dal messaggio d'errore Notion il nome di una proprietà inesistente
function missingProp(msg) { const m = String(msg || "").match(/([\w %/'À-ù]+?) is not a property that exists/i); return m ? m[1].trim() : null; }

// Scrittura tollerante: se Notion rifiuta una colonna non esistente, la rimuove e riprova.
// Così colonne opzionali (Tipo, Valuta, Importo originale…) degradano senza errori.
async function safeWrite(fn, props) {
  const p = { ...props };
  for (let i = 0; i < 6; i++) {
    try { return await withRetry(() => fn(p)); }
    catch (err) {
      const miss = missingProp(err?.message) || (String(err?.message||"").includes("Tipo") ? "Tipo" : null);
      if (miss && p[miss] !== undefined) { delete p[miss]; continue; }
      throw err;
    }
  }
  throw new Error("safeWrite: troppe proprietà mancanti");
}
async function safeCreate(data) {
  return await safeWrite((props) => notion.pages.create({ parent: { database_id: DATABASE_ID }, properties: props }), toN(data));
}
async function safeUpdate(id, data) {
  return await safeWrite((props) => notion.pages.update({ page_id: id, properties: props }), toN(data));
}

app.get("/api/expenses", async (_, res) => {
  try {
    const pgs = []; let c;
    do { const r = await withRetry(() => notion.databases.query({ database_id: DATABASE_ID, start_cursor: c, sorts: [{ property: "Data", direction: "descending" }] })); pgs.push(...r.results); c = r.has_more ? r.next_cursor : undefined; } while (c);
    res.json({ ok: true, data: pgs.map(toExp) });
  } catch (e) { console.error("GET:", e.message); res.status(500).json({ ok: false, error: "Errore" }); }
});
app.post("/api/expenses", wl, async (req, res) => {
  const v = validate(req.body);
  if (!v.valid) return res.status(400).json({ ok: false, error: v.error });
  try { await applyCurrency(v.data); const p = await safeCreate(v.data); res.json({ ok: true, data: toExp(p) }); }
  catch (e) { console.error("POST:", e.message); res.status(500).json({ ok: false, error: e.message }); }
});
app.put("/api/expenses/:id", wl, async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).json({ ok: false, error: "ID" });
  const v = validate(req.body);
  if (!v.valid) return res.status(400).json({ ok: false, error: v.error });
  try { await applyCurrency(v.data); const p = await safeUpdate(req.params.id, v.data); res.json({ ok: true, data: toExp(p) }); }
  catch (e) { console.error("PUT:", e.message); res.status(500).json({ ok: false, error: e.message }); }
});
app.delete("/api/expenses/:id", wl, async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).json({ ok: false, error: "ID" });
  try { await withRetry(() => notion.pages.update({ page_id: String(req.params.id), archived: true })); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ ok: false, error: "Errore" }); }
});

// Anteprima conversione valuta (per il form)
app.get("/api/convert", rateLimit({ windowMs: 60000, max: 60 }), async (req, res) => {
  // I parametri ripetuti (?amount=1&amount=9) arrivano come array: si accetta
  // solo il caso stringa, altrimenti la validazione diventa imprevedibile.
  const rawCur = req.query.currency, rawAmt = req.query.amount;
  if (typeof rawCur !== "string" || typeof rawAmt !== "string") return res.json({ ok: false });
  const cur = rawCur.toUpperCase();
  const amount = parseFloat(rawAmt);
  if (!CURRENCIES.includes(cur) || isNaN(amount)) return res.json({ ok: false });
  if (cur === "EUR") return res.json({ ok: true, eur: Math.round(amount * 100) / 100, rate: 1 });
  const rate = await getRateToEUR(cur);
  if (!rate) return res.json({ ok: false });
  res.json({ ok: true, eur: Math.round(amount * rate * 100) / 100, rate });
});

// Schema: lettura dalla cache + ricarica a caldo
app.get("/api/schema", (_, res) => res.json({ ok: true, categories: schema.expenseCats, incomeCategories: schema.incomeCats, loadedAt: schema.loadedAt, source: schema.source }));
app.post("/api/refresh-schema", wl, async (_, res) => {
  const s = await loadSchema();
  res.json({ ok: true, categories: s.expenseCats, incomeCategories: s.incomeCats, loadedAt: s.loadedAt, source: s.source });
});

app.get("/api/geocode", rateLimit({ windowMs: 60000, max: 60 }), async (req, res) => {
  const q = req.query.q;
  if (!q || typeof q !== "string" || q.length > 200) return res.status(400).json({ ok: false });
  try {
    const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1&lang=it`, { headers: { "User-Agent": "SpesaTracker/9" } });
    const d = await r.json();
    if (d.features && d.features.length > 0) { const f = d.features[0], p = f.properties || {}; const lat = f.geometry?.coordinates?.[1], lon = f.geometry?.coordinates?.[0]; const name = [p.name, p.city, p.country].filter(Boolean).join(", ") || q; if (lat && lon) return res.json({ ok: true, lat, lon, name }); }
  } catch {}
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, { headers: { "User-Agent": "SpesaTracker/9" } });
    const d = await r.json();
    if (d.length > 0) return res.json({ ok: true, lat: +d[0].lat, lon: +d[0].lon, name: d[0].display_name });
  } catch {}
  res.json({ ok: false });
});

app.get("/api/autocomplete", rateLimit({ windowMs: 60000, max: 80 }), async (req, res) => {
  const q = req.query.q;
  if (!q || typeof q !== "string" || q.length < 2 || q.length > 200) return res.json({ ok: true, results: [] });
  try {
    const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5&lang=it`, { headers: { "User-Agent": "SpesaTracker/9" } });
    const d = await r.json();
    const results = (d.features || []).map(f => { const p = f.properties || {}; return { name: [p.name, p.city, p.state, p.country].filter(Boolean).join(", "), display: p.name || "", city: p.city || "", country: p.country || "", lat: f.geometry?.coordinates?.[1] || 0, lon: f.geometry?.coordinates?.[0] || 0 }; });
    res.json({ ok: true, results });
  } catch { res.json({ ok: true, results: [] }); }
});

app.all("/api/*", (_, res) => res.status(404).json({ ok: false, error: "Not found" }));

app.listen(Number(PORT), HOST, async () => {
  console.log(`\n  Spese Tracker v9.4\n  http://localhost:${PORT}\n`);
  await loadSchema();
});
