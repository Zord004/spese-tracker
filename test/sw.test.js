import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const PUBLIC = fileURLToPath(new URL("../public/", import.meta.url));
const sw = readFileSync(join(PUBLIC, "sw.js"), "utf8");
const core = [...sw.match(/const CORE = \[([\s\S]*?)\];/)[1].matchAll(/"([^"]+)"/g)].map(m => m[1]);

function walk(dir, base = "") {
  return readdirSync(join(dir, base), { withFileTypes: true }).flatMap(d =>
    d.isDirectory() ? walk(dir, `${base}/${d.name}`) : [`${base}/${d.name}`]);
}

describe("service worker", () => {
  test("ogni modulo JS dell'app è nel precache (altrimenti offline non si apre)", () => {
    // types.js contiene solo definizioni JSDoc: non viene mai caricato dal browser
    const modules = walk(join(PUBLIC, "js")).filter(f => f.endsWith(".js") && !f.endsWith("/types.js")).map(f => `/js${f}`);
    const missing = modules.filter(m => !core.includes(m));
    assert.deepEqual(missing, [], `moduli non presenti in CORE: ${missing.join(", ")}`);
  });
  test("ogni file del precache esiste davvero (niente refusi)", () => {
    const missing = core.filter(u => u !== "/" && !existsSync(join(PUBLIC, u)));
    assert.deepEqual(missing, []);
  });
  test("il nome della cache dipende dalla versione, scritta dal server", () => {
    assert.match(sw, /const VERSION = "__APP_VERSION__"/);
    assert.match(sw, /const CACHE = "spese-" \+ VERSION/);
  });
  test("codice e stili usano la rete prima (gli aggiornamenti arrivano subito)", () => {
    assert.match(sw, /FRESH_FIRST = \/.*js.*css.*html/);
    assert.match(sw, /networkFirst\(req\)/);
  });
  test("index.html non referenzia asset con parametri di versione manuali", () => {
    const html = readFileSync(join(PUBLIC, "index.html"), "utf8");
    assert.doesNotMatch(html, /\?v=\d+/);
  });
});
