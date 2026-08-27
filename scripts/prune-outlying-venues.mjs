// Drops places to eat and drink that sit too far from the city centre.
//
//   node scripts/prune-outlying-venues.mjs [--dry]
//
// Sightseeing is left alone: Versailles is not central and is still the reason
// you went. But nobody crosses a city for a neighbourhood bar, and the outskirts
// is also where the generically-named ones live — the Timișoara data holds bars
// called Barcelona, Copacabana and Piramida, which are both far out and the ones
// most likely to be confused with somewhere famous.
//
// Purely local: distances are computed from coordinates already on disk, so this
// costs no Overpass requests and can run while a crawl is in progress. Newer
// crawls ask for venues within the centre radius directly (see buildOverpassQuery),
// so this only has to clean up what earlier, wider runs collected.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CENTRE_RADIUS } from "../src/osmCurate.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const POI_DIR = path.join(ROOT, "data", "pois");
const DEST_FILE = path.join(ROOT, "src", "destinations.json");
const DRY = process.argv.includes("--dry");

const VENUE = new Set(["bar", "nightclub", "livemusic", "restaurant", "cafe"]);

// Great-circle distance in metres.
function metres(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad, dLon = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const meta = new Map(
  JSON.parse(fs.readFileSync(DEST_FILE, "utf8")).map((d) => [d.id, d]),
);

let cities = 0, dropped = 0, kept = 0, emptied = 0;
const byCat = {};

for (const f of fs.readdirSync(POI_DIR).filter((x) => /^Q\d+\.json$/.test(x))) {
  const file = path.join(POI_DIR, f);
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  const city = meta.get(doc.qid);
  if (!city?.ll) continue;

  const limit = CENTRE_RADIUS[city.t] || 1500;
  const before = (doc.pois || []).length;

  // Never empty a category. Amman's nearest restaurant is 2,013 m out against a
  // 2,000 m limit — the city's reference point is simply off, not its
  // restaurants — and a hard cutoff left ten cities with no food list at all,
  // which puts the generic "local restaurants in the centre" line back on
  // screen. Keep the nearest few regardless of the limit.
  const MIN_KEEP = { restaurant: 4, cafe: 3, bar: 3, nightclub: 2, livemusic: 1 };

  const survivors = new Set();
  for (const cat of VENUE) {
    const list = (doc.pois || [])
      .filter((p) => p.category === cat && p.ll)
      .map((p) => ({ p, d: metres(city.ll, p.ll) }))
      .sort((a, b) => a.d - b.d);
    const min = MIN_KEEP[cat] || 1;
    list.forEach(({ p, d }, i) => { if (d <= limit || i < min) survivors.add(p); });
  }

  const out = (doc.pois || []).filter((p) => {
    if (!VENUE.has(p.category)) return true;
    // A venue with no coordinates cannot be placed, so it stays: removing it
    // would be a guess, and keeping it costs one line in a file.
    if (!p.ll) return true;
    if (survivors.has(p)) { kept++; return true; }
    dropped++;
    byCat[p.category] = (byCat[p.category] || 0) + 1;
    return false;
  });

  if (out.length !== before) {
    cities++;
    // A city whose entire food list was out of town now has none. buildDest
    // already falls back to a generic line for that, so it degrades cleanly.
    if (!out.some((p) => p.category === "restaurant" || p.category === "cafe")) emptied++;
    if (!DRY) { doc.pois = out; fs.writeFileSync(file, JSON.stringify(doc)); }
  }
}

console.log(`${DRY ? "[DRY RUN] " : ""}orașe atinse: ${cities}`);
console.log(`localuri păstrate (în centru): ${kept}`);
console.log(`localuri scoase (periferice) : ${dropped}`);
console.log(`  pe categorie: ${Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join("  ")}`);
console.log(`orașe rămase fără nicio sugestie de mâncare: ${emptied}`);
