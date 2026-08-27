// Pulls EVERY nightlife venue OpenStreetMap knows for one city and merges it
// into that city's POI file — no per-category cap.
//
//   node scripts/enrich-city-nightlife.mjs <Qid> [--radius 4000] [--dry]
//   node scripts/enrich-city-nightlife.mjs Q83404          (Timișoara)
//
// The batch crawl caps each category (6 bars, 4 clubs) to keep a city's file
// balanced for sightseeing itineraries. That is the right default and the wrong
// one when someone actually wants the nightlife of a city they know — hence
// this deliberate, one-city-at-a-time escape hatch.
//
// Opening hours matter more here than anywhere else in the app: a club is shut
// when a museum is open, so the hours are carried through verbatim from OSM and
// the summary prints how many venues are missing them.
//
// Data © OpenStreetMap contributors (ODbL).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { categorize, CATEGORY_TAGS } from "../src/osmCurate.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const POI_DIR = path.join(ROOT, "data", "pois");
const DEST_FILE = path.join(ROOT, "src", "destinations.json");

const args = process.argv.slice(2);
const QID = args.find((a) => /^Q\d+$/.test(a));
const DRY = args.includes("--dry");
const RADIUS = (() => {
  const i = args.indexOf("--radius");
  return i !== -1 ? Number(args[i + 1]) || 4000 : 4000;
})();

if (!QID) {
  console.error("Folosire: node scripts/enrich-city-nightlife.mjs <Qid> [--radius N] [--dry]");
  process.exit(1);
}

// Casinos are opt-in. In Romania `amenity=casino` is overwhelmingly applied to
// slot-machine halls and betting shops — MaxBet, Super Bet, Las Vegas Games —
// which are not a night out and would crowd out the actual bars.
const WITH_CASINOS = args.includes("--with-casinos");
const NIGHT_KINDS = ["bar", "nightclub", "livemusic", ...(WITH_CASINOS ? ["casino"] : [])];

// Placeholder and debris names that OSM occasionally carries. A venue nobody
// can ask for by name is not a stop.
const JUNK_NAME = /^(database|test|unnamed|n\/a|xxx|\?+)$/i;

// kumi was timing out entirely while the other two answered; ordered by what
// actually responded when this was written.
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const query = ([lat, lon]) => {
  const a = `(around:${RADIUS},${lat},${lon})`;
  return `
[out:json][timeout:90];
(
  node[amenity~"^(bar|pub|biergarten|nightclub|music_venue|casino)$"][name]${a};
  way[amenity~"^(bar|pub|biergarten|nightclub|music_venue|casino)$"][name]${a};
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
          signal: AbortSignal.timeout(120000),
        });
        if (!res.ok) { lastErr = `HTTP ${res.status}`; await sleep(4000 * (attempt + 1)); continue; }
        return (await res.json()).elements || [];
      } catch (e) { lastErr = e.message; await sleep(3000); }
    }
    console.log(`  (${ep.replace(/https:\/\/|\/api.*/g, "")} nu a răspuns: ${lastErr})`);
  }
  throw new Error("Overpass a eșuat pe toate endpointurile: " + lastErr);
}

function toPoi(el) {
  const t = el.tags || {};
  const name = t["name:ro"] || t["name:en"] || t.int_name || t.name;
  if (!name || name.length < 2 || JUNK_NAME.test(name.trim())) return null;
  const cat = categorize(t);
  if (!NIGHT_KINDS.includes(cat)) return null;
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

const city = JSON.parse(fs.readFileSync(DEST_FILE, "utf8")).find((d) => d.id === QID);
if (!city) { console.error(`Orașul ${QID} nu e în index.`); process.exit(1); }

const file = path.join(POI_DIR, `${QID}.json`);
if (!fs.existsSync(file)) { console.error(`Nu există ${file}.`); process.exit(1); }
const doc = JSON.parse(fs.readFileSync(file, "utf8"));

console.log(`[${city.n}] rază ${RADIUS}m${DRY ? " (DRY RUN)" : ""}`);
const elements = await overpass(query(city.ll));
console.log(`[${city.n}] ${elements.length} elemente brute de la Overpass`);

// Keep what's already there; OSM often lists the same venue as both a node and
// a way, and the file may already hold it from the original crawl.
const existing = new Map((doc.pois || []).map((p) => [p.name.toLowerCase(), p]));
const added = [];
const updatedHours = [];

for (const el of elements) {
  const p = toPoi(el);
  if (!p) continue;
  const key = p.name.toLowerCase();
  const already = existing.get(key);
  if (already) {
    // Worth one pass: the original crawl stored some venues with no hours, and
    // for a club the hours are the whole point.
    if (!already.hours && p.hours) {
      already.hours = p.hours;
      updatedHours.push(p.name);
    }
    continue;
  }
  existing.set(key, p);
  added.push(p);
}

const all = [...(doc.pois || []).filter((p) => !NIGHT_KINDS.includes(p.category))];
const night = [...existing.values()].filter((p) => NIGHT_KINDS.includes(p.category));
// Venues with real opening hours first — those are the ones the itinerary can
// actually schedule with confidence.
night.sort((a, b) => (b.hours ? 1 : 0) - (a.hours ? 1 : 0) || a.name.localeCompare(b.name));

const byCat = {};
for (const p of night) byCat[p.category] = (byCat[p.category] || 0) + 1;
const noHours = night.filter((p) => !p.hours).length;

console.log(`\n[${city.n}] localuri de seară: ${night.length}`);
for (const [k, v] of Object.entries(byCat)) console.log(`   ${k.padEnd(10)} ${v}`);
console.log(`   fără program în OSM: ${noHours}`);
// Clubs get listed in full with their hours: they are the venues the itinerary
// schedules latest, and a club with no hours is the one most likely to send
// someone to a locked door.
const clubs = night.filter((p) => p.category === "nightclub" || p.category === "livemusic");
if (clubs.length) {
  console.log("\n   cluburi / muzică live:");
  for (const c of clubs) console.log(`     ${c.name.padEnd(26)} ${c.hours || "(fără program în OSM)"}`);
}

console.log(`\n   nou adăugate: ${added.length}${added.length ? " → " + added.map((p) => p.name).join(", ") : ""}`);
if (updatedHours.length) console.log(`   program completat pentru: ${updatedHours.join(", ")}`);

if (!DRY) {
  doc.pois = [...all, ...night];
  fs.writeFileSync(file, JSON.stringify(doc));
  console.log(`\n   scris ${path.relative(ROOT, file)} (${doc.pois.length} obiective în total)`);
} else {
  console.log("\n   DRY RUN — nimic nu s-a scris");
}
