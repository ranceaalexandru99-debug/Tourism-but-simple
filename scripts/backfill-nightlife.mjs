// Adds the nightlife venue kinds that the original crawl never asked for —
// nightclubs, live-music venues, casinos and dance halls — to the POI files
// that already exist.
//
//   node scripts/backfill-nightlife.mjs [--limit N] [--dry]
//
// Why not just re-run batch-pois.mjs: it skips any city that already has a
// file, so re-running does nothing here. Deleting the files first WOULD refetch
// — and would also throw away the ~9,600 enriched-and-validated Commons photos
// baked into them, which took far longer to produce than the POIs did.
//
// So this asks Overpass for the missing kinds only, merges them into each
// existing file, and leaves every other field untouched. That is also far
// lighter on the free Overpass endpoints than a full re-crawl.
//
// Resumable: a city whose file already has one of these kinds is skipped, so an
// interrupted run just restarts. Note the flip side — a city that genuinely has
// none gets re-queried on every run.
//
// Data © OpenStreetMap contributors (ODbL).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { categorize, CATEGORY_TAGS, CATEGORY_CAP } from "../src/osmCurate.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const POI_DIR = path.join(ROOT, "data", "pois");
const DEST_FILE = path.join(ROOT, "src", "destinations.json");

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const LIMIT = (() => {
  const i = args.indexOf("--limit");
  return i !== -1 ? Number(args[i + 1]) || Infinity : Infinity;
})();

const RADIUS = 5000;
// Overpass started answering HTTP 500 to two thirds of requests at 2.5s; the
// free endpoints throttle by asking you to go away rather than by saying so.
const DELAY_MS = 6000;

// The venue kinds added after the original crawl. Bars and pubs are NOT here —
// those the existing files already have.
//
// Casinos are opt-in for a reason found in the data, not assumed: all fifteen
// that Overpass returned for Timișoara were slot-machine halls and betting
// shops (MaxBet, Super Bet, Las Vegas Games), and the first bulk city checked
// after that offered "Play Land", an amusement arcade. `amenity=casino` is
// simply not a reliable signal for "somewhere worth an evening".
const WITH_CASINOS = args.includes("--with-casinos");
const KINDS = ["nightclub", "livemusic", ...(WITH_CASINOS ? ["casino"] : [])];

// Ordered by what actually answered when this was measured: kumi timed out
// entirely (no response in 40s) while the mail.ru mirror returned 200 in 16s.
// Running on effectively one endpoint was producing a third of all failures.
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const query = ([lat, lon]) => {
  const a = `(around:${RADIUS},${lat},${lon})`;
  return `
[out:json][timeout:60];
(
  node[amenity~"^(nightclub|music_venue${WITH_CASINOS ? "|casino" : ""})$"][name]${a};
  node[leisure="dance"][name]${a};
);
out center tags;`.trim();
};

async function overpass(q) {
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
          body: "data=" + encodeURIComponent(q),
          // kumi can hang with no response at all; without this the run
          // stalls for minutes on an endpoint that is simply gone.
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
  throw new Error("Overpass failed: " + lastErr);
}

// Same shape curateElements produces, so merged entries are indistinguishable
// from the ones already in the file.
function toPoi(el) {
  const t = el.tags || {};
  const name = t["name:ro"] || t["name:en"] || t.int_name || t.name;
  if (!name || name.length < 2) return null;
  const cat = categorize(t);
  if (!KINDS.includes(cat)) return null;
  // Same readability rule the main crawl applies: a venue whose name is in a
  // script the traveller can't read is not somewhere they can go looking for.
  if (!/[A-Za-z]/.test(name)) return null;
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (typeof lat !== "number" || typeof lon !== "number") return null;
  return {
    name,
    category: cat,
    tags: CATEGORY_TAGS[cat],
    ll: [+(+lat).toFixed(5), +(+lon).toFixed(5)],
    hours: t.opening_hours || undefined,
    website: t.website || t["contact:website"] || undefined,
  };
}

const meta = new Map(
  JSON.parse(fs.readFileSync(DEST_FILE, "utf8")).map((d) => [d.id, d]),
);

const files = fs.readdirSync(POI_DIR).filter((f) => /^Q\d+\.json$/.test(f));
console.log(`[night] ${files.length} fișiere pe disc${DRY ? " (DRY RUN)" : ""}`);

let added = 0, cities = 0, skipped = 0, noCoords = 0, failed = 0, empty = 0;

for (const f of files) {
  if (cities >= LIMIT) break;
  const file = path.join(POI_DIR, f);
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));

  if ((doc.pois || []).some((p) => KINDS.includes(p.category))) { skipped++; continue; }

  const city = meta.get(doc.qid);
  if (!city?.ll) { noCoords++; continue; }

  cities++;
  try {
    const elements = await overpass(query(city.ll));
    const seen = new Set((doc.pois || []).map((p) => p.name.toLowerCase()));
    const found = [];
    const perCat = {};
    for (const el of elements) {
      const p = toPoi(el);
      // A venue tagged both bar and nightclub is already in the file as a bar.
      if (!p || seen.has(p.name.toLowerCase())) continue;
      // Cap BEFORE keeping it — the same per-category limits curateElements
      // applies, so a city with forty clubs doesn't swamp its own file.
      const cap = CATEGORY_CAP[p.category] || 3;
      if ((perCat[p.category] || 0) >= cap) continue;
      perCat[p.category] = (perCat[p.category] || 0) + 1;
      seen.add(p.name.toLowerCase());
      found.push(p);
    }

    if (!found.length) { empty++; console.log(`[night] — ${doc.city}: nimic`); }
    else {
      added += found.length;
      if (!DRY) {
        doc.pois = [...(doc.pois || []), ...found];
        fs.writeFileSync(file, JSON.stringify(doc));
      }
      const summary = Object.entries(perCat).map(([k, v]) => `${v} ${k}`).join(", ");
      console.log(`[night] + ${doc.city}: ${summary} (${found.map((c) => c.name).join(", ").slice(0, 60)})`);
    }
  } catch (e) {
    failed++;
    console.log(`[night] ! ${doc.city}: ${e.message}`);
  }
  await sleep(DELAY_MS);
}

console.log(`\n[night] GATA. orașe interogate=${cities} localuri adăugate=${added} fără rezultate=${empty} deja aveau=${skipped} fără coordonate=${noCoords} erori=${failed}`);
