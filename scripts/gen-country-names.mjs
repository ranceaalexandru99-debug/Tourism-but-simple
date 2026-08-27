// Generates mobile-native/src/lib/countryNames.js — country names in all 16
// app languages, for every country the native app can display.
//
// Why generated rather than hand-written: this is ~1000 strings across 16
// languages, where a wrong translation would sit unnoticed forever. Node ships
// full ICU (CLDR), which is the authority browsers and phones use themselves,
// so the names come from there and are simply frozen into a static table.
//
// Why frozen rather than looked up at runtime: Hermes, the JS engine in the
// native app, does not implement Intl.DisplayNames. The web app calls it live;
// the native app cannot, so it carries the answers instead.
//
// Run:  node scripts/gen-country-names.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NATIVE = path.join(ROOT, "mobile-native");
const OUT = path.join(NATIVE, "src", "lib", "countryNames.js");

const LANGS = ["en", "ro", "fr", "es", "it", "de", "pl", "ru", "zh", "ja", "pt", "nl", "tr", "el", "uk", "ko"];

// ---- 1. which countries does the app actually mention? ----------------------

const engine = fs.readFileSync(path.join(NATIVE, "src", "lib", "mockEngine.js"), "utf8");
const locale = fs.readFileSync(path.join(NATIVE, "src", "lib", "locale.js"), "utf8");

// Home tiles carry ISO codes (copied from the web app's POPULAR list).
const popular = engine.match(/export const POPULAR = \[([\s\S]*?)\n\];/)[1];
const isoFromPopular = [...new Set([...popular.matchAll(/country: "([A-Z]{2})"/g)].map((m) => m[1]))];

// Routes and trips carry Romanian country NAMES — the shape the curated
// destination data has always used, and the key COUNTRY_INFO is indexed by.
const roNamesFromInfo = [...locale.matchAll(/^ {2}"([^"]+)":\s*\{ emergency/gm)].map((m) => m[1]);
const roNamesFromDests = [...new Set([...engine.matchAll(/country: "([^"]*[^A-Z"][^"]*)"/g)].map((m) => m[1]).filter(Boolean))];
const roNames = [...new Set([...roNamesFromInfo, ...roNamesFromDests])];

// ---- 2. Romanian name → ISO, resolved against ICU rather than by hand -------

const roDisplay = new Intl.DisplayNames(["ro"], { type: "region" });

// CLDR answers for more than current countries: exceptional reservations and
// historic entities share names with live codes. Left in, "Franța" resolved to
// FX (France, Metropolitan) and "Rusia" to SU (the Soviet Union), because a
// later code silently overwrote the right one in the reverse map.
// ISO 3166-3 (withdrawn) plus non-country entries. The list is explicit rather
// than heuristic: three of these — VD (North Vietnam), NH (New Hebrides), RH
// (Rhodesia) — sort BEFORE their modern successors VN, VU and ZW, so "keep the
// first" chose the historic state until they were named here.
const NOT_A_COUNTRY = new Set([
  "FX", "SU", "CS", "YU", "DD", "AN", "BU", "ZR", "TP", "YD",  // historic / withdrawn
  "DY", "HV", "VD", "NH", "RH", "CT", "FQ", "JT", "MI", "NQ",
  "NT", "PC", "PU", "PZ", "WK",
  "EU", "EZ", "UN", "QO", "ZZ", "XA", "XB",                    // groupings & placeholders
  "AC", "TA", "IC", "EA", "CP", "DG", "UK",                    // exceptional reservations
]);

// Every current ISO 3166-1 alpha-2 code, so the reverse lookup can be exhaustive.
const ALL_ISO = [];
for (let a = 65; a <= 90; a++) {
  for (let b = 65; b <= 90; b++) {
    const cc = String.fromCharCode(a) + String.fromCharCode(b);
    if (NOT_A_COUNTRY.has(cc)) continue;
    const name = roDisplay.of(cc);
    if (name && name !== cc) ALL_ISO.push(cc);
  }
}

const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");

// First code wins, and any remaining collision is reported rather than silently
// resolved — that silence is exactly what hid the FX and SU mix-ups.
const byRoName = new Map();
for (const cc of ALL_ISO) {
  const key = norm(roDisplay.of(cc));
  if (byRoName.has(key)) {
    console.warn(`Nume ambiguu "${roDisplay.of(cc)}": păstrez ${byRoName.get(key)}, ignor ${cc}`);
    continue;
  }
  byRoName.set(key, cc);
}

// The app's data uses short, colloquial forms where CLDR uses the formal name.
// These are the only ones ICU cannot resolve on its own — each is stated
// explicitly so a reader can check it, rather than guessed by fuzzy matching.
const RO_ALIASES = {
  "Marea Britanie": "GB",      // CLDR: "Regatul Unit"
  "SUA": "US",                 // CLDR: "Statele Unite ale Americii"
  "Emiratele Arabe": "AE",     // CLDR: "Emiratele Arabe Unite"
  "Olanda": "NL",              // CLDR: "Țările de Jos"
  "Coreea de Sud": "KR",       // CLDR: "Coreea de Sud" (matches, kept for clarity)
};

const roToIso = {};
const unresolved = [];
for (const name of roNames) {
  const cc = RO_ALIASES[name] || byRoName.get(norm(name));
  if (cc) roToIso[name] = cc;
  else unresolved.push(name);
}

if (unresolved.length) {
  console.error("Nu am putut rezolva la cod ISO:", unresolved.join(", "));
  console.error("Adaugă-le în RO_ALIASES și rulează din nou.");
  process.exit(1);
}

// ---- 3. build the table ----------------------------------------------------

const codes = [...new Set([...isoFromPopular, ...Object.values(roToIso)])].sort();
const display = Object.fromEntries(LANGS.map((l) => [l, new Intl.DisplayNames([l], { type: "region" })]));

const names = {};
for (const cc of codes) {
  names[cc] = {};
  for (const l of LANGS) {
    const v = display[l].of(cc);
    if (!v || v === cc) { console.error(`Lipsă nume ${l}/${cc}`); process.exit(1); }
    names[cc][l] = v;
  }
}

// English is by far the most repeated value across languages that share it; the
// file stays readable as one line per country.
const rows = codes.map((cc) => {
  const inner = LANGS.map((l) => `${l}: ${JSON.stringify(names[cc][l])}`).join(", ");
  return `  ${cc}: { ${inner} },`;
}).join("\n");

const roRows = Object.entries(roToIso)
  .sort(([a], [b]) => a.localeCompare(b, "ro"))
  .map(([ro, cc]) => `  ${JSON.stringify(ro)}: ${JSON.stringify(cc)},`)
  .join("\n");

const file = `// Country names in all 16 app languages. GENERATED — do not edit by hand.
// Regenerate with:  node scripts/gen-country-names.mjs
//
// Source: Node's full-ICU CLDR data, the same dataset browsers and phones use.
// Frozen into a table because Hermes (the native JS engine) ships no
// Intl.DisplayNames — the web app looks these up live, the native app cannot.
//
// ${codes.length} countries × ${LANGS.length} languages.

const NAMES = {
${rows}
};

// The curated destination data stores Romanian country names, and COUNTRY_INFO
// in locale.js is keyed by them. This bridges those keys to ISO codes so both
// the Home tiles (which carry ISO) and routes/trips (which carry names) can use
// one lookup. Resolved against CLDR's Romanian names, not by hand.
const RO_TO_ISO = {
${roRows}
};

// ISO 3166-1 alpha-2 → flag, by mapping each letter to its regional indicator.
export const flagOf = (cc) =>
  (cc || "").toUpperCase().replace(/[A-Z]/g, (ch) =>
    String.fromCodePoint(0x1f1e6 + ch.charCodeAt(0) - 65));

// Accepts either an ISO code ("FR") or the Romanian name the trip data stores
// ("Franța"), and returns the name in \`lang\`. Falls back to English, then to
// whatever was passed in — an unknown country should still print something.
export function countryName(country, lang = "en") {
  if (!country) return "";
  const cc = /^[A-Za-z]{2}$/.test(country) ? country.toUpperCase() : RO_TO_ISO[country];
  const row = NAMES[cc];
  if (!row) return country;
  return row[lang] || row.en || country;
}

// The flag for either key shape, for callers that render both together.
export function countryFlagOf(country) {
  if (!country) return "";
  const cc = /^[A-Za-z]{2}$/.test(country) ? country.toUpperCase() : RO_TO_ISO[country];
  return cc ? flagOf(cc) : "";
}
`;

fs.writeFileSync(OUT, file);
console.log(`Scris ${path.relative(ROOT, OUT)}`);
console.log(`  ${codes.length} țări × ${LANGS.length} limbi = ${codes.length * LANGS.length} nume`);
console.log(`  ${Object.keys(roToIso).length} nume românești mapate la ISO`);
