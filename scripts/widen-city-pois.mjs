// Re-fetches cities that already have a POI file and adds whatever the OLD,
// flat caps had thrown away — without touching what is already there.
//
//   node scripts/widen-city-pois.mjs [--limit N] [--dry] [--tier mega,major]
//
// Why this exists: caps used to be one flat set for every city, and 78–96% of
// cities were hitting them, so the limit rather than OpenStreetMap was what
// itineraries were short of. Caps are now scaled by city size (see capsFor in
// src/osmCurate.js) — but batch-pois.mjs skips any city that already has a file,
// so the 487 already-crawled cities, which are precisely the big ones that
// benefit most, would never see the new allowance.
//
// Merging rather than overwriting is the whole point: those files carry ~9,600
// Commons photos that were enriched and then validated one by one, and a plain
// re-crawl would discard every one of them.
//
// Data © OpenStreetMap contributors (ODbL).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildOverpassQuery, curateElements, capsFor } from "../src/osmCurate.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const POI_DIR = path.join(ROOT, "data", "pois");
const DEST_FILE = path.join(ROOT, "src", "destinations.json");

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const argVal = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const LIMIT = Number(argVal("--limit", 0)) || Infinity;
// Biggest cities first by default: they are both the most searched and the ones
// the old flat cap short-changed hardest.
const TIERS = argVal("--tier", "mega,major,notable,hidden").split(",");

const RADIUS = 5000;
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
          signal: AbortSignal.timeout(120000),
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
  throw new Error("Overpass failed: " + lastErr);
}

const meta = new Map(
  JSON.parse(fs.readFileSync(DEST_FILE, "utf8")).map((d) => [d.id, d]),
);

// A city is worth re-fetching only if its file is short of the new allowance in
// some category. Cities already at the new caps are skipped without a request.
function roomLeft(doc, tier) {
  const caps = capsFor(tier);
  const have = {};
  for (const p of doc.pois || []) have[p.category] = (have[p.category] || 0) + 1;
  return Object.keys(caps).some((k) => (have[k] || 0) < caps[k]);
}

const TIER_ORDER = { mega: 0, major: 1, notable: 2, hidden: 3 };
const files = fs.readdirSync(POI_DIR)
  .filter((f) => /^Q\d+\.json$/.test(f))
  .map((f) => ({ f, city: meta.get(f.replace(".json", "")) }))
  .filter((x) => x.city && TIERS.includes(x.city.t))
  .sort((a, b) => (TIER_ORDER[a.city.t] ?? 9) - (TIER_ORDER[b.city.t] ?? 9) || b.city.r - a.city.r);

console.log(`[widen] ${files.length} orașe de verificat${DRY ? " (DRY RUN)" : ""}`);

let touched = 0, addedTotal = 0, queried = 0, skipped = 0, failed = 0;

for (const { f, city } of files) {
  if (queried >= LIMIT) break;
  const file = path.join(POI_DIR, f);
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));

  if (!roomLeft(doc, city.t)) { skipped++; continue; }

  queried++;
  try {
    const elements = await overpass(buildOverpassQuery(city.ll, RADIUS, 60, city.t));
    const fresh = curateElements(elements, city.t, city.ll);

    // Everything already in the file stays, photos and all. Only genuinely new
    // names are appended, and only while the category has room.
    const seen = new Set((doc.pois || []).map((p) => p.name.toLowerCase()));
    const have = {};
    for (const p of doc.pois || []) have[p.category] = (have[p.category] || 0) + 1;
    const caps = capsFor(city.t);

    const added = [];
    for (const p of fresh) {
      if (seen.has(p.name.toLowerCase())) continue;
      const cap = caps[p.category] || 5;
      if ((have[p.category] || 0) >= cap) continue;
      have[p.category] = (have[p.category] || 0) + 1;
      seen.add(p.name.toLowerCase());
      added.push(p);
    }

    if (!added.length) {
      console.log(`[widen] — ${city.n} (${city.t}): nimic nou`);
    } else {
      touched++;
      addedTotal += added.length;
      if (!DRY) {
        doc.pois = [...(doc.pois || []), ...added];
        fs.writeFileSync(file, JSON.stringify(doc));
      }
      const byCat = {};
      for (const p of added) byCat[p.category] = (byCat[p.category] || 0) + 1;
      const summary = Object.entries(byCat).map(([k, v]) => `+${v} ${k}`).join(" ");
      console.log(`[widen] + ${city.n} (${city.t}): ${doc.pois.length} total  ${summary}`);
    }
  } catch (e) {
    failed++;
    console.log(`[widen] ! ${city.n}: ${e.message}`);
  }
  await sleep(DELAY_MS);
}

console.log(`\n[widen] GATA. interogate=${queried} lărgite=${touched} obiective noi=${addedTotal} deja pline=${skipped} erori=${failed}`);
