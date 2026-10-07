// Copy the data and pure-logic modules the native app shares with the web one,
// so the two can't drift. Run after regenerating destinations or POI files:
//
//   node scripts/sync-native-data.mjs
//
// Copied:
//   src/destinations.json → mobile-native/src/data/destinations.json
//       The 5000-city index. Bundled because search-as-you-type must work
//       offline and instantly; ~750 KB of JSON is acceptable in an app bundle.
//   src/osmCurate.js      → mobile-native/src/lib/osmCurate.js
//       Pure functions (Overpass query + curation rules), no DOM, no web APIs.
//   src/shared/poiDest.js → mobile-native/src/shared/poiDest.js
//       The OSM-objectives → itinerary bridge and its category tables. Lived
//       in src/poiDb.js next to the Supabase query until the native app needed
//       it, which is why native invented its objectives for so long.
//
// NOT copied: data/pois/*.json (38 MB of crawl output). The native app gets a
// trimmed, sharded copy from scripts/pack-native-pois.mjs instead — run that
// after a crawl, not this.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const NATIVE = path.join(ROOT, "mobile-native");

const jobs = [
  { from: "src/destinations.json", to: "mobile-native/src/data/destinations.json" },
  { from: "src/osmCurate.js", to: "mobile-native/src/lib/osmCurate.js" },
  { from: "src/shared/poiDest.js", to: "mobile-native/src/shared/poiDest.js" },
];

const BANNER = "// SYNCED from ../../../src/ by scripts/sync-native-data.mjs — do not edit here.\n";

fs.mkdirSync(path.join(NATIVE, "src", "data"), { recursive: true });
fs.mkdirSync(path.join(NATIVE, "src", "shared"), { recursive: true });
for (const { from, to } of jobs) {
  const src = fs.readFileSync(path.join(ROOT, from), "utf8");
  const body = to.endsWith(".js") ? BANNER + src : src;
  fs.writeFileSync(path.join(ROOT, to), body);
  console.log(`  ✓ ${to}  (${(body.length / 1024).toFixed(0)} KB)`);
}
console.log("\nDate native sincronizate.");
