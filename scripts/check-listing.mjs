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

if (!results.length) {
  console.log("  niciun bloc găsit — s-a schimbat structura documentului?");
  process.exit(1);
}

console.log(bad ? `\n${bad} peste limită.` : "\nToate încap.");
process.exit(bad ? 1 : 0);
