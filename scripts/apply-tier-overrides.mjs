// Apply data/tier-overrides.json to both copies of the city index.
//
// Re-run this after regenerating destinations.json — the overrides correct a
// signal the generator inherits from Wikidata, so a regeneration brings the
// problem back. The file itself explains which problem and why only six entries
// are in it.
//
//   node scripts/apply-tier-overrides.mjs [--dry]
//
// Edits in place rather than regenerating the native copy from the web one:
// the two hold the same data with different `img` encoding, so a re-sync would
// produce a 4,261-entry diff of nothing.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry");

const { overrides } = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "tier-overrides.json"), "utf8"));
const wanted = new Map(overrides.map((o) => [o.id, o]));

const FILES = [
  path.join(ROOT, "src", "destinations.json"),
  path.join(ROOT, "mobile-native", "src", "data", "destinations.json"),
];

let problems = 0;

for (const file of FILES) {
  const cities = JSON.parse(fs.readFileSync(file, "utf8"));
  const byId = new Map(cities.map((c) => [c.id, c]));
  let changed = 0;
  let already = 0;

  for (const o of overrides) {
    const city = byId.get(o.id);
    if (!city) {
      console.error(`  ${o.id} (${o.name}) nu există în ${path.basename(file)}`);
      problems++;
      continue;
    }
    // The name is checked, not just the id: an override that silently retargets
    // a different city after a regeneration is worse than one that fails.
    if (city.n !== o.name) {
      console.error(`  ${o.id}: fișierul spune "${city.n}", suprascrierea spune "${o.name}"`);
      problems++;
      continue;
    }
    if (city.t === o.to) { already++; continue; }
    if (city.t !== o.from) {
      console.error(`  ${o.name}: aștept "${o.from}", găsesc "${city.t}"`);
      problems++;
      continue;
    }
    city.t = o.to;
    changed++;
  }

  if (!DRY && changed) fs.writeFileSync(file, JSON.stringify(cities));
  console.log(`${path.relative(ROOT, file)}: ${changed} schimbate, ${already} deja corecte`);
}

if (problems) {
  console.error(`\n${problems} nepotriviri — nimic nu a fost scris pentru ele.`);
  process.exit(1);
}
if (DRY) console.log("\n--dry: nimic nu a fost scris.");
console.log(`\n${wanted.size} suprascrieri, ${FILES.length} fișiere.`);
