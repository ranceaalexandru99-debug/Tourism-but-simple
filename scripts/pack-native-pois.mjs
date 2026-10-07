// Pack the crawled objectives into the native app bundle.
//
//   node scripts/pack-native-pois.mjs [--shards 60] [--cities N]
//
// `--cities N` packs only the N highest-ranked cities. See SIZE below for why
// that lever exists.
//
// WHY. The native app had real objectives for 19 cities, written out by hand in
// mockEngine.js, and for the other 4,980 it generated "Centrul istoric",
// "Muzeul orașului", "Parcul orașului" — no real names, no coordinates.
// Meanwhile data/pois/ holds 265,819 real objectives for 4,770 cities, whose
// only reader is a Supabase table that does not exist yet.
//
// The web app can afford to query a database. The native app cannot: it is
// offline-first, and an itinerary that needs the network to name a single
// museum is worse than no itinerary. So the data ships inside the app.
//
// SIZE. Measured by bundling the Android app twice, once with this pack and
// once with an empty one — not by gzipping the JSON, which understates it,
// because Hermes bytecode for an object literal is bulkier than the text:
//
//                    Hermes bundle    compressed (what the user downloads)
//   without pack          6.4 MB            2.3 MB
//   all 4,769 cities     35.5 MB           13.3 MB
//
// So every city being real costs about 11 MB on the download, and takes Metro
// from 21 seconds to 156. That is the trade `--cities N` exists for: the
// highest-ranked few hundred cover nearly every trip anyone plans, at a
// fraction of the size. The default is everything, because the app is
// offline-first and a traveller in a city the pack skipped gets the generic
// itinerary with no way to tell it is generic.
//
// SHARDS. Metro puts every imported JSON into the JS bundle, so one 24.5 MB
// import would be parsed in full to open one city. Instead the cities are split
// into ~60 shards of ~400 KB and a tiny index maps a Wikidata id to its shard;
// mobile-native/src/lib/poiPack.js requires one shard, once, when a city is
// opened. The index is the only part loaded at startup.
//
// Shards are filled by rank so that the cities people actually open land in the
// low-numbered ones — not that it matters for correctness, only that a popular
// shard stays warm.
//
// Data © OpenStreetMap contributors (ODbL).

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { STOP_CATEGORIES } from "../src/shared/poiDest.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC_DIR = path.join(ROOT, "data", "pois");
const OUT_DIR = path.join(ROOT, "mobile-native", "src", "data", "pois");

const si = process.argv.indexOf("--shards");
const SHARDS = si > -1 ? Number(process.argv[si + 1]) : 60;
const ci = process.argv.indexOf("--cities");
const MAX_CITIES = ci > -1 ? Number(process.argv[ci + 1]) : Infinity;

// Exactly the fields buildDest reads, under their original names so the shared
// module needs no translation layer. `wikidata` and `cuisine` are dropped (22%
// and 16% of objectives carry them, and nothing reads either).
const FIELDS = ["name", "category", "tags", "ll", "wiki", "hours", "img", "website", "charge", "fee"];

// Coordinates to five decimals — about a metre, which is finer than a pin on a
// phone screen can show, and saves a tenth of the payload.
const round = (ll) => [Math.round(ll[0] * 1e5) / 1e5, Math.round(ll[1] * 1e5) / 1e5];

function trim(p) {
  const o = {};
  for (const k of FIELDS) if (p[k] !== undefined && p[k] !== null && p[k] !== "") o[k] = p[k];
  o.ll = round(p.ll);
  return o;
}

const cities = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "destinations.json"), "utf8"));
const ranked = [...cities].sort((a, b) => (b.r || 0) - (a.r || 0));

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const shards = Array.from({ length: SHARDS }, () => ({}));
const index = {};
let packed = 0, objectives = 0, skippedThin = 0, missing = 0;
let next = 0;

for (const city of ranked) {
  if (packed >= MAX_CITIES) break;
  const file = path.join(SRC_DIR, `${city.id}.json`);
  if (!fs.existsSync(file)) { missing++; continue; }

  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  // A coordinate is not optional — a stop with no `ll` cannot be drawn on the
  // map or ordered into a walking day, and the route planner would silently
  // place it anywhere.
  const pois = (j.pois || []).filter((p) => Array.isArray(p.ll) && p.ll.length === 2);

  // The same bar assembleRoute works to: fewer than three sightseeing stops is
  // not an itinerary, and shipping it would replace the generic fallback with
  // something worse — a one-stop day that claims to be real.
  const sights = pois.filter((p) => STOP_CATEGORIES.has(p.category)).length;
  if (sights < 3) { skippedThin++; continue; }

  const shard = next % SHARDS;
  next++;
  shards[shard][city.id] = pois.map(trim);
  index[city.id] = shard;
  packed++;
  objectives += pois.length;
}

let bytes = 0;
for (let i = 0; i < SHARDS; i++) {
  const json = JSON.stringify(shards[i]);
  bytes += json.length;
  fs.writeFileSync(path.join(OUT_DIR, `${i}.json`), json);
}
fs.writeFileSync(path.join(OUT_DIR, "index.json"), JSON.stringify(index));

// The shard list has to be a literal for Metro to resolve it: a require() with
// a computed path is a runtime lookup the bundler cannot follow, and the shards
// would simply not be in the app.
const loader = `// GENERATED by scripts/pack-native-pois.mjs — do not edit.
//
// One require() per shard, written out because Metro cannot follow a computed
// path. Each is evaluated the first time a city in that shard is opened.
export const SHARD_COUNT = ${SHARDS};
export const shardLoaders = [
${Array.from({ length: SHARDS }, (_, i) => `  () => require("../data/pois/${i}.json"),`).join("\n")}
];
`;
fs.writeFileSync(path.join(ROOT, "mobile-native", "src", "lib", "poiShards.js"), loader);

// Read back everything just written and check that each city resolves through
// its index entry to a non-empty list.
//
// An index pointing at the wrong shard is the failure that costs nothing and
// shows nothing: loadPackedPois returns null and the city quietly drops to the
// generic itinerary, which is what it did before this pack existed. The check
// belongs here rather than in the test suite — one sequential pass over 34 MB
// is cheap, and the same pass inside a suite that runs files in parallel pushed
// six unrelated test files past their timeouts.
const readBack = Array.from({ length: SHARDS }, (_, i) =>
  JSON.parse(fs.readFileSync(path.join(OUT_DIR, `${i}.json`), "utf8")),
);
const unresolvable = [];
for (const [qid, shard] of Object.entries(JSON.parse(fs.readFileSync(path.join(OUT_DIR, "index.json"), "utf8")))) {
  if (!readBack[shard]?.[qid]?.length) unresolvable.push(qid);
}
if (unresolvable.length) {
  console.error(`\n${unresolvable.length} orașe nu se pot rezolva prin index: ${unresolvable.slice(0, 5).join(", ")}`);
  process.exit(1);
}

const idxBytes = JSON.stringify(index).length;
const gz = zlib.gzipSync(
  Buffer.concat(Array.from({ length: SHARDS }, (_, i) => Buffer.from(JSON.stringify(shards[i])))),
  { level: 9 },
).length;
const mb = (b) => `${(b / 1048576).toFixed(1)} MB`;

console.log(`${packed} orașe împachetate, ${objectives} obiective`);
console.log(`  ${SHARDS} felii, ${mb(bytes)} în total, ${mb(gz)} comprimat`);
console.log(`  cea mai mare felie: ${mb(Math.max(...shards.map((s) => JSON.stringify(s).length)))}`);
console.log(`  index: ${(idxBytes / 1024).toFixed(0)} KB (singurul încărcat la pornire)`);
console.log(`  sărite: ${missing} fără fișier de crawl, ${skippedThin} cu sub 3 obiective turistice`);
