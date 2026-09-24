// Build the web app's fallback city index.
//
// The full 5000-city index was deliberately moved out of the web bundle and
// into Supabase — 216 KB gzipped off the download. That trade is fine while the
// database answers. When it does not, three features return nothing and say
// nothing: city suggestions, the Home rails, and the explore map. The user sees
// an app that appears to know no cities at all.
//
// So: the best-known 576 (mega + major), about 25 KB gzipped, LAZILY imported
// and only ever touched after a query has actually failed. Nothing is added to
// the initial download; the app simply stops being empty when the database is
// unreachable.
//
// Not the whole index — that would put back most of what was removed. The
// promise this makes is "the cities everyone has heard of", which is the right
// promise for a degraded mode.
//
// Run: node scripts/build-fallback-index.mjs

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "mobile-native", "src", "data", "destinations.json");
const OUT = path.join(ROOT, "src", "data", "fallbackCities.json");

const TIERS = ["mega", "major"];

const all = JSON.parse(fs.readFileSync(SRC, "utf8"));
const rows = all
  .filter((c) => TIERS.includes(c.t))
  // Same field names the rest of the app already speaks, so a fallback city and
  // a database city are indistinguishable to every caller.
  .map(({ id, n, c, ll, r, t, img }) => (img ? { id, n, c, ll, r, t, img } : { id, n, c, ll, r, t }))
  .sort((a, b) => b.r - a.r);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(rows));

const raw = fs.statSync(OUT).size;
const gz = zlib.gzipSync(fs.readFileSync(OUT)).length;
console.log(
  `${path.relative(ROOT, OUT)}: ${rows.length} orașe, ` +
  `${(raw / 1024).toFixed(0)} KB brut, ${(gz / 1024).toFixed(0)} KB gzip`,
);

// A fallback with no photos would make the Home rails render grey boxes, which
// looks more broken than the empty state it replaces.
const withImg = rows.filter((c) => c.img).length;
console.log(`${withImg} au poză (${Math.round((withImg / rows.length) * 100)}%)`);
if (withImg / rows.length < 0.9) {
  console.log("ATENȚIE: prea puține poze — rafturile ar arăta goale.");
  process.exit(1);
}
