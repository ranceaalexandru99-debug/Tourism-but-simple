// Pre-generate POI files for the top cities in src/destinations.json.
//
//   node scripts/batch-pois.mjs [count]     (default 500)
//
// Resumable: cities that already have public/pois/{qid}.json are skipped, so
// re-running only processes what's missing. Dense megacities that time out at
// the full radius are retried at 3000m then 2000m before giving up. At the
// end the index (public/pois/index.json) is rebuilt from the files on disk.
//
// Data © OpenStreetMap contributors (ODbL). Be polite to the free Overpass
// endpoints: one city at a time + a delay between requests.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildOverpassQuery, curateElements, STOP_CATEGORIES } from "../src/osmCurate.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = path.join(ROOT, "public", "pois");
const DEST_FILE = path.join(ROOT, "src", "destinations.json");

const TARGET = Number(process.argv[2]) || 500;
const RADIUS = 5000;
const DELAY_MS = 2500;

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
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

const all = JSON.parse(fs.readFileSync(DEST_FILE, "utf8"));
const cities = [...all].sort((a, b) => b.r - a.r).slice(0, TARGET);
fs.mkdirSync(OUT_DIR, { recursive: true });
console.log(`[batch] target ${cities.length} cities (top ${TARGET} by rank)`);

let done = 0, skipped = 0, failed = 0;
for (const city of cities) {
  const outFile = path.join(OUT_DIR, `${city.id}.json`);
  if (fs.existsSync(outFile)) { skipped++; continue; }
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
      const elements = await overpass(buildOverpassQuery(city.ll, radius, 60));
      pois = curateElements(elements);
      if (sights(pois) >= 8) break;
      await sleep(1500);
    }
    if (sights(pois) < 8) {
      console.log(`[batch] SKIP ${city.n} (only ${sights(pois)} sightseeing stops)`);
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
    const total = rebuildIndex();
    console.log(`[batch] ${done} ${city.n} (${city.c}) -> ${pois.length} POIs [index: ${total}]`);
  } catch (e) {
    console.log(`[batch] FAIL ${city.n}: ${e.message}`);
    failed++;
  }
  await sleep(DELAY_MS);
}

const total = rebuildIndex();
console.log(`[batch] DONE. new=${done} already=${skipped} failed=${failed} indexTotal=${total}`);
