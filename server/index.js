import "dotenv/config";
import express from "express";
import { Client } from "@notionhq/client";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// ── Notion client ──
const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

if (!process.env.NOTION_TOKEN || !DATABASE_ID) {
  console.error("❌ Manca NOTION_TOKEN o NOTION_DATABASE_ID nel file .env");
  console.error("   Copia .env.example in .env e compila i valori.");
  process.exit(1);
}

// ── Middleware ──
app.use(express.json());
app.use(express.static(join(__dirname, "..")));

// ── Mapping: App ↔ Notion ──

function notionPageToExpense(page) {
  const p = page.properties;
  return {
    id: page.id,
    name: p["Nome"]?.title?.[0]?.plain_text || "",
    amount: p["Importo"]?.number || 0,
    date: p["Data"]?.date?.start || "",
    cat: p["Categoria"]?.select?.name || "Altro",
    am: p["Mesi ammortamento"]?.number || 1,
    note: p["Note"]?.rich_text?.[0]?.plain_text || "",
  };
}

function expenseToNotionProps(expense) {
  return {
    "Nome": { title: [{ text: { content: expense.name } }] },
    "Importo": { number: expense.amount },
    "Data": { date: { start: expense.date } },
    "Categoria": { select: { name: expense.cat } },
    "Mesi ammortamento": { number: expense.am },
    "Note": { rich_text: [{ text: { content: expense.note || "" } }] },
  };
}

// ── API Routes ──

// GET /api/expenses — fetch all expenses from Notion
app.get("/api/expenses", async (_req, res) => {
  try {
    const pages = [];
    let cursor = undefined;

    // Paginate through all results
    do {
      const response = await notion.databases.query({
        database_id: DATABASE_ID,
        start_cursor: cursor,
        sorts: [{ property: "Data", direction: "descending" }],
      });
      pages.push(...response.results);
      cursor = response.has_more ? response.next_cursor : undefined;
    } while (cursor);

    const expenses = pages.map(notionPageToExpense);
    res.json({ ok: true, data: expenses });
  } catch (err) {
    console.error("GET /api/expenses error:", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/expenses — create a new expense
app.post("/api/expenses", async (req, res) => {
  try {
    const page = await notion.pages.create({
      parent: { database_id: DATABASE_ID },
      properties: expenseToNotionProps(req.body),
    });
    res.json({ ok: true, data: notionPageToExpense(page) });
  } catch (err) {
    console.error("POST /api/expenses error:", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PUT /api/expenses/:id — update an expense
app.put("/api/expenses/:id", async (req, res) => {
  try {
    const page = await notion.pages.update({
      page_id: req.params.id,
      properties: expenseToNotionProps(req.body),
    });
    res.json({ ok: true, data: notionPageToExpense(page) });
  } catch (err) {
    console.error("PUT /api/expenses/:id error:", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE /api/expenses/:id — archive (soft-delete) an expense
app.delete("/api/expenses/:id", async (req, res) => {
  try {
    await notion.pages.update({
      page_id: req.params.id,
      archived: true,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/expenses/:id error:", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Start ──
app.listen(PORT, () => {
  console.log();
  console.log("  💰 Expense Tracker avviato!");
  console.log(`  🌐 http://localhost:${PORT}`);
  console.log(`  📋 Notion DB: ${DATABASE_ID}`);
  console.log();
});
