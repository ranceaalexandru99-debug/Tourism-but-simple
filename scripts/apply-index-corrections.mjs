// Apply data/index-corrections.json to both copies of the city index: tier
// overrides, and entries removed for not being places.
//
// Re-run this after regenerating destinations.json — the corrections answer
// things the generator inherits from Wikidata, so a regeneration brings the
// problems back. The file itself explains which problems and why so few entries
// are in it.
//
//   node scripts/apply-index-corrections.mjs [--dry]
//
// Edits in place rather than regenerating the native copy from the web one:
// the two hold the same data with different `img` encoding, so a re-sync would
// produce a 4,261-entry diff of nothing.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry");

const { overrides, removals = [] } = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data", "index-corrections.json"), "utf8"),
);

const FILES = [
  path.join(ROOT, "src", "destinations.json"),
  path.join(ROOT, "mobile-native", "src", "data", "destinations.json"),
];

let problems = 0;

for (const file of FILES) {
  let cities = JSON.parse(fs.readFileSync(file, "utf8"));
  const byId = new Map(cities.map((c) => [c.id, c]));
  let changed = 0;
  let already = 0;
  let removed = 0;

  for (const r of removals) {
    const city = byId.get(r.id);
    if (!city) { already++; continue; }
    // Same name check as the tier overrides: a removal that silently deletes a
    // different city after a regeneration is the worst outcome here.
    if (city.n !== r.name) {
      console.error(`  ${r.id}: fișierul spune "${city.n}", ștergerea spune "${r.name}"`);
      problems++;
      continue;
    }
    cities = cities.filter((c) => c.id !== r.id);
    byId.delete(r.id);
    removed++;
  }

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

  if (!DRY && (changed || removed)) fs.writeFileSync(file, JSON.stringify(cities));
  console.log(
    `${path.relative(ROOT, file)}: ${changed} schimbate, ${removed} șterse, ${already} deja corecte`,
  );
}

if (problems) {
  console.error(`\n${problems} nepotriviri — nimic nu a fost scris pentru ele.`);
  process.exit(1);
}
if (DRY) console.log("\n--dry: nimic nu a fost scris.");
console.log(`\n${overrides.length} suprascrieri, ${removals.length} ștergeri, ${FILES.length} fișiere.`);
