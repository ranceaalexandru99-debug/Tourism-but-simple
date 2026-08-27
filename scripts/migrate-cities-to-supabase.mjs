// Seed Supabase with the destination data that currently ships as static files.
//
//   1. Run supabase/schema.sql once in the Supabase SQL editor.
//   2. Put SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env (no VITE_ prefix).
//   3. node scripts/migrate-cities-to-supabase.mjs [--dry]
//
// Idempotent: rows are upserted by primary key, so re-running after a data
// refresh updates in place instead of duplicating. Safe to interrupt and resume.
//
// The service_role key is required because the tables have RLS on with no write
// policy — that is deliberate, see supabase/schema.sql.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DRY = process.argv.includes("--dry");

// Read .env by hand — this is a standalone script, not a Vite process.
function loadEnv() {
  try {
    for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch { /* no .env — rely on the real environment */ }
}
loadEnv();

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL) { console.error("Lipsește SUPABASE_URL (sau VITE_SUPABASE_URL) în .env"); process.exit(1); }
if (!SERVICE_KEY && !DRY) {
  console.error("Lipsește SUPABASE_SERVICE_ROLE_KEY în .env.");
  console.error("Îl iei din Supabase → Project Settings → API → service_role.");
  console.error("Rulează cu --dry ca să verifici datele fără să scrii nimic.");
  process.exit(1);
}

// EXACTLY the normalization the client applies to a search query. If these two
// ever drift, searches silently stop matching.
const normalize = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const db = SERVICE_KEY
  ? createClient(URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

// ---------------------------------------------------------------- cities ----
const cities = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "destinations.json"), "utf8"));
const cityRows = cities.map((d) => ({
  id: d.id,
  name: d.n,
  name_norm: normalize(d.n),
  country: d.c,
  lat: d.ll[0],
  lon: d.ll[1],
  population: d.p ?? null,
  rank: d.r,
  continent: d.co ?? null,
  tier: d.t ?? null,
  img: d.img ?? null,
}));
console.log(`[migrare] ${cityRows.length} orașe pregătite`);

// -------------------------------------------------------------- city_pois ---
const poiDir = path.join(ROOT, "data", "pois");
const poiRows = [];
for (const f of fs.readdirSync(poiDir).filter((f) => /^Q\d+\.json$/.test(f))) {
  const d = JSON.parse(fs.readFileSync(path.join(poiDir, f), "utf8"));
  if (!d.pois?.length) continue;
  poiRows.push({
    city_id: d.qid,
    source: d.source || "osm",
    pois: d.pois,
    generated_at: d.generatedAt || null,
  });
}
const totalPois = poiRows.reduce((s, r) => s + r.pois.length, 0);
console.log(`[migrare] ${poiRows.length} orașe cu POI (${totalPois} obiective)`);

// A POI row whose city is missing would violate the foreign key — catch it here
// with a clear message instead of a cryptic constraint error mid-upload.
const cityIds = new Set(cityRows.map((r) => r.id));
const orphans = poiRows.filter((r) => !cityIds.has(r.city_id));
if (orphans.length) {
  console.error(`[migrare] ${orphans.length} fișiere POI fără oraș în index:`, orphans.slice(0, 5).map((r) => r.city_id));
  process.exit(1);
}

if (DRY) {
  console.log("\n[migrare] --dry: nimic nu a fost scris.");
  console.log("  exemplu oraș:", JSON.stringify(cityRows[0]));
  console.log("  exemplu POI :", { ...poiRows[0], pois: `[${poiRows[0].pois.length} obiective]` });
  process.exit(0);
}

// ----------------------------------------------------------------- upload ---
// Batches are bounded by BYTES as well as row count. A flat 25 rows was written
// when a city held ~60 POIs and ~10 KB; cities now reach 153 POIs and 28 KB, so
// the same 25 rows had grown to a 651 KB request — and the crawl is still adding.
// Sizing by payload means the batch shrinks on its own as the data grows,
// instead of quietly drifting toward whatever limit gives out first.
const MAX_BATCH_BYTES = 256 * 1024;

async function upsertAll(table, rows, conflictKey, maxRows) {
  let done = 0;
  let i = 0;
  while (i < rows.length) {
    const chunk = [];
    let bytes = 0;
    while (i < rows.length && chunk.length < maxRows) {
      const size = JSON.stringify(rows[i]).length;
      // Always take at least one row, even an oversized one — a single city
      // bigger than the budget still has to go somewhere.
      if (chunk.length && bytes + size > MAX_BATCH_BYTES) break;
      chunk.push(rows[i++]);
      bytes += size;
    }
    const { error } = await db.from(table).upsert(chunk, { onConflict: conflictKey });
    if (error) {
      console.error(`\n[migrare] ${table} a eșuat la rândul ${done}:`, error.message);
      process.exit(1);
    }
    done += chunk.length;
    process.stdout.write(`\r[migrare] ${table}: ${done}/${rows.length}`);
  }
  process.stdout.write("\n");
}

await upsertAll("cities", cityRows, "id", 500);
await upsertAll("city_pois", poiRows, "city_id", 25);

const { count: cityCount } = await db.from("cities").select("*", { count: "exact", head: true });
const { count: poiCount } = await db.from("city_pois").select("*", { count: "exact", head: true });
console.log(`\n[migrare] GATA. în baza de date: ${cityCount} orașe, ${poiCount} cu POI.`);
