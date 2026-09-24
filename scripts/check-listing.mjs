// Checks the store listing copy against Play's limits.
//
// Play counts characters, not bytes, and it counts what you paste — including
// the newlines. Eyeballing an 80-character line is how a listing gets rejected
// at submission, after everything else is ready.
//
//   node scripts/check-listing.mjs
//
// Reads docs/store-listing.md and measures every fenced block under a known
// heading. Exits non-zero if anything is over.

import { CAPTIONS } from "./store-screenshots.mjs";
import fs from "node:fs";

const FILE = "docs/store-listing.md";

// heading text → Play's limit
const LIMITS = new Map([
  ["Nume", 30],
  ["App name", 30],
  ["Descriere scurtă", 80],
  ["Short description", 80],
  ["Descriere lungă", 4000],
  ["Full description", 4000],
]);

const src = fs.readFileSync(FILE, "utf8");
const lines = src.split("\n");

let heading = null;
let inBlock = false;
let buffer = [];
const results = [];

for (const line of lines) {
  const h = line.match(/^###\s+(.+?)\s*$/);
  if (h && !inBlock) { heading = h[1]; continue; }

  if (line.trim() === "```") {
    if (!inBlock) { inBlock = true; buffer = []; continue; }
    inBlock = false;
    if (heading && LIMITS.has(heading)) {
      results.push({ heading, text: buffer.join("\n") });
      heading = null;
    }
    continue;
  }
  if (inBlock) buffer.push(line);
}

let bad = 0;
console.log(`${FILE}\n`);
for (const { heading: h, text } of results) {
  const limit = LIMITS.get(h);
  const n = [...text].length;          // code points, as Play counts them
  const over = n > limit;
  if (over) bad++;
  const bar = over ? "PESTE LIMITĂ" : "ok";
  console.log(`  ${h.padEnd(20)} ${String(n).padStart(5)} / ${limit}   ${bar}`);
  if (over) console.log(`      taie ${n - limit} caractere`);
}

// The screenshot captions live in store-screenshots.mjs, and the shot list that
// says what to photograph lives in the document. They drifted once: the list
// still described an app from before the explore map and the photo map, so the
// listing would have shown an older product than the one on the shelf.
const shotProblems = [];
{
  // Only the screenshot table: its first cell is a bare number. The feature
  // matrix elsewhere in the document has the same three-column shape but a
  // word there, and matching it too is how this first read 203 screenshots.
  const table = [...src.matchAll(/^\|\s*\d+\s*\|[^|]*\|\s*(.+?)\s*\|\s*$/gm)]
    .map((m) => m[1]);
  if (!table.length) {
    shotProblems.push("tabelul cu capturi nu a fost găsit în document");
  } else if (table.length !== CAPTIONS.length) {
    shotProblems.push(`documentul listează ${table.length} capturi, scriptul are ${CAPTIONS.length}`);
  } else {
    CAPTIONS.forEach((c, i) => {
      if (table[i] !== c) shotProblems.push(`captura ${i + 1}: documentul spune „${table[i]}", scriptul „${c}"`);
    });
  }
  // Play's own limit, worth failing on here rather than at upload.
  if (CAPTIONS.length < 2 || CAPTIONS.length > 8) {
    shotProblems.push(`${CAPTIONS.length} capturi — Play acceptă între 2 și 8`);
  }
}

console.log("");
if (shotProblems.length) {
  bad += shotProblems.length;
  for (const p of shotProblems) console.log(`  capturi: ${p}`);
} else {
  console.log(`  capturi            ${String(CAPTIONS.length).padStart(5)} / 8   ok, și legendele se potrivesc`);
}

if (!results.length) {
  console.log("  niciun bloc găsit — s-a schimbat structura documentului?");
  process.exit(1);
}

console.log(bad ? `\n${bad} peste limită.` : "\nToate încap.");
process.exit(bad ? 1 : 0);
