// Pre-generate POI files for the top cities in src/destinations.json.
//
//   node scripts/batch-pois.mjs [count]     (default 500)
//
// Resumable, in two ways: cities that already have data/pois/{qid}.json are
// skipped, and cities recorded in data/pois/_barren.json — too few sightseeing
// places to build an itinerary from — are skipped too. The second matters at
// full scale: most of the 5000-city tail is barren, and without the ledger every
// restart would spend hours re-asking Overpass the same losing questions.
//
// Dense megacities that time out at the full radius are retried at 3000m then
// 2000m before giving up. The index (data/pois/index.json) is rebuilt
// periodically and once more at the end.
//
// Data © OpenStreetMap contributors (ODbL). Be polite to the free Overpass
// endpoints: one city at a time + a delay between requests.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildOverpassQuery, curateElements, STOP_CATEGORIES } from "../src/osmCurate.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = path.join(ROOT, "data", "pois");
const DEST_FILE = path.join(ROOT, "src", "destinations.json");

const TARGET = Number(process.argv[2]) || 500;
const RADIUS = 5000;
// 2500 was fine for a 500-city run and is not for a 5000-city one: at that pace
// the free endpoints started answering HTTP 500 to two thirds of requests for
// hours. Slower and complete beats fast and half-finished.
const DELAY_MS = 6000;

// Ordered by what actually answered when this was measured: kumi timed out
// entirely (no response in 40s) while the mail.ru mirror returned 200 in 16s.
// Running on effectively one endpoint was producing a third of all failures.
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function overpass(query) {
  let lastErr;
  for (const ep of ENDPOINTS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(ep, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "TurismDarSimplu/0.1 (rancea.alexandru99@gmail.com)",
          },
          body: "data=" + encodeURIComponent(query),
          // kumi can hang with no response at all; without this the run
          // stalls for minutes on an endpoint that is simply gone.
          signal: AbortSignal.timeout(90000),
        });
        if (res.status === 429 || res.status === 504 || res.status === 502) {
          lastErr = `HTTP ${res.status}`;
          await sleep(3000 * (attempt + 1));
          continue;
        }
        if (!res.ok) { lastErr = `HTTP ${res.status}`; break; }
        return (await res.json()).elements || [];
      } catch (e) { lastErr = e.message; await sleep(2000); }
    }
  }
  throw new Error("Overpass failed: " + lastErr);
}

function rebuildIndex() {
  const ids = fs.readdirSync(OUT_DIR)
    .filter((f) => /^Q\d+\.json$/.test(f))
    .map((f) => f.replace(".json", ""));
  fs.writeFileSync(path.join(OUT_DIR, "index.json"), JSON.stringify(ids));
  return ids.length;
}

// Cities that came back with too little to build an itinerary. Without this
// ledger every restart re-queries all of them — and across 5000 cities most of
// the long tail is exactly that, so a resumed run would spend its hours asking
// Overpass the same losing questions again.
const BARREN_FILE = path.join(OUT_DIR, "_barren.json");
const barren = new Set(
  fs.existsSync(BARREN_FILE) ? JSON.parse(fs.readFileSync(BARREN_FILE, "utf8")) : [],
);
const rememberBarren = (id) => {
  barren.add(id);
  fs.writeFileSync(BARREN_FILE, JSON.stringify([...barren]));
};

const all = JSON.parse(fs.readFileSync(DEST_FILE, "utf8"));
const cities = [...all].sort((a, b) => b.r - a.r).slice(0, TARGET);
fs.mkdirSync(OUT_DIR, { recursive: true });
console.log(`[batch] target ${cities.length} cities (top ${TARGET} by rank), ${barren.size} known barren`);

let done = 0, skipped = 0, failed = 0;
for (const city of cities) {
  const outFile = path.join(OUT_DIR, `${city.id}.json`);
  if (fs.existsSync(outFile)) { skipped++; continue; }
  if (barren.has(city.id)) { skipped++; continue; }
  // Wikidata rows with no English label surface the bare Qid as a name — junk.
  if (/^Q\d+$/.test(city.n)) { failed++; continue; }
  try {
    // Dense megacities time out at the full radius and come back empty —
    // step the radius down before giving up.
    // Quality gate: a city needs enough SIGHTSEEING stops for a real
    // itinerary — restaurants alone don't make a trip (Yamoussoukro passed
    // the old total-POI bar with 2 sights + 21 restaurants).
    const sights = (list) => list.filter((p) => STOP_CATEGORIES.has(p.category)).length;
    let pois = [];
    for (const radius of [RADIUS, 3000, 2000]) {
      const elements = await overpass(buildOverpassQuery(city.ll, radius, 60, city.t));
      pois = curateElements(elements, city.t, city.ll);
      if (sights(pois) >= 8) break;
      await sleep(1500);
    }
    if (sights(pois) < 8) {
      console.log(`[batch] SKIP ${city.n} (only ${sights(pois)} sightseeing stops)`);
      // Genuinely thin, not a transient failure — record it so a resumed run
      // doesn't pay for the same answer twice.
      rememberBarren(city.id);
      failed++;
      await sleep(DELAY_MS);
      continue;
    }
    fs.writeFileSync(outFile, JSON.stringify({
      city: city.n,
      qid: city.id,
      source: "osm",
      attribution: "© OpenStreetMap contributors",
      generatedAt: new Date().toISOString().slice(0, 10),
      pois,
    }));
    done++;
    // Rebuilding the index re-reads the whole directory, which is cheap at 500
    // files and quadratic across 5000. Periodically is enough — the final
    // rebuild after the loop is what actually matters.
    const total = done % 25 === 0 ? rebuildIndex() : null;
    console.log(`[batch] ${done} ${city.n} (${city.c}) -> ${pois.length} POIs${total ? ` [index: ${total}]` : ""}`);
  } catch (e) {
    console.log(`[batch] FAIL ${city.n}: ${e.message}`);
    failed++;
  }
  await sleep(DELAY_MS);
}

const total = rebuildIndex();
console.log(`[batch] DONE. new=${done} already=${skipped} failed=${failed} indexTotal=${total}`);
