// Re-ask Overpass about the big cities the crawler wrote off as barren.
//
//   node scripts/retry-barren.mjs [--dry] [--min 100000]
//
// batch-pois.mjs asks within 5 km of the city centroid, and steps DOWN to 3 km
// and 2 km when that comes back thin. Stepping down is right for a megacity
// whose query times out — but it can only ever find less, so a city whose
// sights are simply spread out gets recorded in _barren.json and never asked
// again. That ledger currently holds Port Harcourt (3.3 M people), Huainan
// (3.0 M) and sixty more above 100 000, which is not a thing that is true.
//
// Measured before this script existed, sightseeing stops found:
//
//   Port Harcourt   5 km: 2    10 km:  9    20 km: 18
//   Huainan         5 km: 0    10 km:  5    20 km: 13
//   Elazığ          5 km: 7    10 km: 15    20 km: 15
//   Tanta           5 km: 2    10 km:  3    20 km:  6
//
// So: step up, 10 km then 20 km, and keep the first radius that clears the bar.
// Tanta and Akola stay barren at 20 km — the wider radius is a question, not an
// answer, and two of the eight cities probed answered no.
//
// The catch with a wide radius is annexation: at 20 km a city can claim sights
// that belong to its neighbour. Every stop is therefore checked against all
// 5000 city centroids, and one that sits nearer another city in the index is
// dropped. Data © OpenStreetMap contributors (ODbL).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildOverpassQuery, curateElements, ownedByNearestCity, STOP_CATEGORIES } from "../src/osmCurate.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = path.join(ROOT, "data", "pois");
const BARREN_FILE = path.join(OUT_DIR, "_barren.json");

const DRY = process.argv.includes("--dry");
const minIdx = process.argv.indexOf("--min");
const MIN_POP = minIdx > -1 ? Number(process.argv[minIdx + 1]) : 100000;

const RADII = [10000, 20000];
const MIN_SIGHTS = 8;
const DELAY_MS = 6000;

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
          signal: AbortSignal.timeout(90000),
        });
        if ([429, 502, 504].includes(res.status)) {
          lastErr = `HTTP ${res.status}`;
          await sleep(3000 * (attempt + 1));
          continue;
        }
        if (!res.ok) { lastErr = `HTTP ${res.status}`; break; }
        return (await res.json()).elements || [];
      } catch (e) { lastErr = e.message; await sleep(2000); }
    }
  }
  throw new Error(lastErr || "necunoscut");
}

const cities = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "destinations.json"), "utf8"));
const byId = new Map(cities.map((c) => [c.id, c]));

// Only cities within ~65 km can possibly steal a stop from a 20 km query, and
// comparing against all 5000 for every POI is work for nothing.
const neighbours = (city) => cities.filter(
  (o) => o.id !== city.id
    && Math.abs(o.ll[0] - city.ll[0]) < 0.6
    && Math.abs(o.ll[1] - city.ll[1]) < 0.6,
);

const barren = new Set(JSON.parse(fs.readFileSync(BARREN_FILE, "utf8")));
const targets = [...barren]
  .map((id) => byId.get(id))
  .filter((c) => c && (c.p || 0) >= MIN_POP && !fs.existsSync(path.join(OUT_DIR, `${c.id}.json`)))
  .sort((a, b) => (b.p || 0) - (a.p || 0));

console.log(`[retry] ${barren.size} în ledger, ${targets.length} peste ${MIN_POP.toLocaleString("ro")} locuitori${DRY ? " (--dry)" : ""}`);

const sights = (l) => l.filter((p) => STOP_CATEGORIES.has(p.category)).length;
let rescued = 0, stillThin = 0, failed = 0;

for (const city of targets) {
  if (DRY) { console.log(`  ${city.n} (${city.c}) ${city.p}`); continue; }
  try {
    let best = null;
    const near = neighbours(city);
    for (const radius of RADII) {
      const elements = await overpass(buildOverpassQuery(city.ll, radius, 90, city.t));
      const { kept, annexed } = ownedByNearestCity(curateElements(elements, city.t, city.ll), city, near);
      best = { pois: kept, radius, annexed };
      if (sights(kept) >= MIN_SIGHTS) break;
      await sleep(1500);
    }
    if (sights(best.pois) < MIN_SIGHTS) {
      console.log(`[retry] ÎNCĂ SUBȚIRE ${city.n}: ${sights(best.pois)} obiective la 20 km`);
      stillThin++;
    } else {
      fs.writeFileSync(path.join(OUT_DIR, `${city.id}.json`), JSON.stringify({
        city: city.n,
        qid: city.id,
        source: "osm",
        // Recorded because it is not the default: this city needed a wider
        // question than 5 km, and the next person should see that.
        radius: best.radius,
        attribution: "© OpenStreetMap contributors",
        generatedAt: new Date().toISOString().slice(0, 10),
        pois: best.pois,
      }));
      barren.delete(city.id);
      fs.writeFileSync(BARREN_FILE, JSON.stringify([...barren]));
      rescued++;
      const note = best.annexed.length
        ? `, ${best.annexed.length} lăsate vecinilor (${best.annexed.slice(0, 2).map((a) => `${a.name}→${a.to}`).join(", ")})`
        : "";
      console.log(`[retry] ${rescued} ${city.n} (${city.c}) -> ${best.pois.length} POI la ${best.radius / 1000} km${note}`);
    }
  } catch (e) {
    console.log(`[retry] EȘEC ${city.n}: ${e.message}`);
    failed++;
  }
  await sleep(DELAY_MS);
}

if (!DRY) {
  const ids = fs.readdirSync(OUT_DIR).filter((f) => /^Q\d+\.json$/.test(f)).map((f) => f.slice(0, -5));
  fs.writeFileSync(path.join(OUT_DIR, "index.json"), JSON.stringify(ids));
  console.log(`\n[retry] GATA. recuperate=${rescued} încă subțiri=${stillThin} eșecuri=${failed} index=${ids.length}`);
}
