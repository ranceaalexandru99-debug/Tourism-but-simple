// Bake a real photo into every POI we can identify, so attractions show a
// picture instantly instead of relying on a 3-step lookup chain at render time
// (which is slow, rate-limited, and silently misses a lot).
//
//   node scripts/enrich-poi-photos.mjs
//
// Two sources, both ending in a Wikimedia Commons filename stored as `img`
// (the client builds the URL — see PoiImage):
//   1. Wikidata P18 for POIs tagged with a Q-id — language-independent and
//      authoritative. Fetched over SPARQL in batches.
//   2. Wikipedia `pageimages` for POIs that only carry an article title.
//      OSM stores those as "de:Kölner Dom" but our curation stripped the
//      prefix, so the title is tried on the country's language wiki first,
//      then English.
//
// Resumable: POIs that already have `img` are skipped, so a re-run only fills
// gaps. Data © OpenStreetMap contributors; images © their respective authors
// under the licences shown on Commons.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const POI_DIR = path.join(ROOT, "public", "pois");
const UA = "TurismDarSimplu/0.1 (rancea.alexandru99@gmail.com)";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Country ISO → main Wikipedia language, for titles that aren't English.
const LANG_BY_COUNTRY = {
  RO: "ro", IT: "it", FR: "fr", ES: "es", DE: "de", AT: "de", CH: "de", PT: "pt",
  BR: "pt", NL: "nl", BE: "nl", PL: "pl", RU: "ru", UA: "uk", BY: "be", CZ: "cs",
  SK: "sk", HU: "hu", GR: "el", TR: "tr", SE: "sv", NO: "no", DK: "da", FI: "fi",
  IS: "is", EE: "et", LV: "lv", LT: "lt", BG: "bg", RS: "sr", HR: "hr", SI: "sl",
  BA: "bs", MK: "mk", AL: "sq", JP: "ja", CN: "zh", TW: "zh", HK: "zh", KR: "ko",
  TH: "th", VN: "vi", ID: "id", MY: "ms", IN: "hi", IL: "he", IR: "fa", GE: "ka",
  AM: "hy", AZ: "az", KZ: "kk", UZ: "uz", MX: "es", AR: "es", CL: "es", CO: "es",
  PE: "es", VE: "es", UY: "es", EC: "es", CU: "es", MA: "ar", EG: "ar", TN: "ar",
  DZ: "ar", SA: "ar", AE: "ar", QA: "ar", JO: "ar", LB: "ar", SY: "ar", IQ: "ar",
};

async function getJson(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
      if (res.status === 429 || res.status >= 500) { await sleep(2000 * (attempt + 1)); continue; }
      if (!res.ok) return null;
      return await res.json();
    } catch { await sleep(1500); }
  }
  return null;
}

// --- 1. Wikidata P18 in bulk -------------------------------------------------
async function imagesForQids(qids) {
  const values = qids.map((q) => `wd:${q}`).join(" ");
  const query = `SELECT ?item ?img WHERE { VALUES ?item { ${values} } ?item wdt:P18 ?img. }`;
  const data = await getJson("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(query));
  const out = new Map();
  for (const b of data?.results?.bindings || []) {
    const qid = b.item.value.split("/").pop();
    // The value is a Special:FilePath URL — keep just the filename.
    const file = decodeURIComponent(b.img.value.split("/").pop());
    out.set(qid, file);
  }
  return out;
}

// --- 2. Wikipedia pageimages -------------------------------------------------
async function imagesForTitles(lang, titles) {
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*` +
    `&prop=pageimages&piprop=name&redirects=1&titles=${encodeURIComponent(titles.join("|"))}`;
  const data = await getJson(url);
  const out = new Map();
  const pages = data?.query?.pages || {};
  // `normalized` + `redirects` let us map the answer back to what we asked for.
  const alias = new Map();
  for (const n of data?.query?.normalized || []) alias.set(n.to, n.from);
  for (const r of data?.query?.redirects || []) alias.set(r.to, alias.get(r.from) || r.from);
  for (const p of Object.values(pages)) {
    if (!p.pageimage) continue;
    out.set(alias.get(p.title) || p.title, p.pageimage);
  }
  return out;
}

// Locator maps, flags, coats of arms and logos are not destination photos.
const JUNK = /location_map|locator|_map\.|Flag[_ ]of|Coat[_ ]of[_ ]arms|logo|\.svg$/i;
const usable = (file) => file && !JUNK.test(file);

// --- gather work -------------------------------------------------------------
const files = fs.readdirSync(POI_DIR).filter((f) => /^Q\d+\.json$/.test(f));
// POI files don't carry the country, so map qid → ISO code via the city index.
const COUNTRY_BY_QID = new Map(
  JSON.parse(fs.readFileSync(path.join(ROOT, "src", "destinations.json"), "utf8")).map((d) => [d.id, d.c]),
);
const cities = files.map((f) => {
  const data = JSON.parse(fs.readFileSync(path.join(POI_DIR, f), "utf8"));
  data.country = COUNTRY_BY_QID.get(data.qid) || null;
  return { file: f, data };
});

const byQid = new Map();   // qid → [poi, ...]
const byTitle = new Map(); // `${lang}\n${title}` → [poi, ...]
let already = 0, noHint = 0;

for (const { data } of cities) {
  const lang = LANG_BY_COUNTRY[data.country] || null;
  for (const p of data.pois) {
    if (p.img) { already++; continue; }
    if (p.wikidata) {
      if (!byQid.has(p.wikidata)) byQid.set(p.wikidata, []);
      byQid.get(p.wikidata).push(p);
    } else if (p.wiki) {
      // Try the local-language wiki first when we know it, else English.
      const key = `${lang || "en"}\n${p.wiki}`;
      if (!byTitle.has(key)) byTitle.set(key, []);
      byTitle.get(key).push(p);
    } else noHint++;
  }
}

console.log(`[foto] ${cities.length} orașe · deja cu poză: ${already} · prin Wikidata: ${byQid.size} · prin titlu: ${byTitle.size} · fără indiciu: ${noHint}`);

let filled = 0;

// --- pass 1: Wikidata --------------------------------------------------------
const qids = [...byQid.keys()];
const QCHUNK = 400;
for (let i = 0; i < qids.length; i += QCHUNK) {
  const chunk = qids.slice(i, i + QCHUNK);
  const map = await imagesForQids(chunk);
  for (const [qid, file] of map) {
    if (!usable(file)) continue;
    for (const p of byQid.get(qid) || []) { p.img = file; filled++; }
  }
  console.log(`[foto] wikidata ${Math.min(i + QCHUNK, qids.length)}/${qids.length} → ${filled} poze`);
  await sleep(1200);
}

// --- pass 2: Wikipedia titles -----------------------------------------------
const byLang = new Map();
for (const key of byTitle.keys()) {
  const [lang, title] = key.split("\n");
  if (!byLang.has(lang)) byLang.set(lang, []);
  byLang.get(lang).push(title);
}
const TCHUNK = 50;
for (const [lang, titles] of byLang) {
  for (let i = 0; i < titles.length; i += TCHUNK) {
    const chunk = titles.slice(i, i + TCHUNK);
    const map = await imagesForTitles(lang, chunk);
    let hit = 0;
    for (const [title, file] of map) {
      if (!usable(file)) continue;
      for (const p of byTitle.get(`${lang}\n${title}`) || []) { p.img = file; filled++; hit++; }
    }
    // Anything the local wiki didn't know, ask English about.
    if (lang !== "en") {
      const missing = chunk.filter((t) => !map.has(t));
      if (missing.length) {
        const en = await imagesForTitles("en", missing);
        for (const [title, file] of en) {
          if (!usable(file)) continue;
          for (const p of byTitle.get(`${lang}\n${title}`) || []) { p.img = file; filled++; hit++; }
        }
        await sleep(600);
      }
    }
    console.log(`[foto] ${lang} ${Math.min(i + TCHUNK, titles.length)}/${titles.length} (+${hit}) → ${filled} poze`);
    await sleep(600);
  }
}

// --- write back --------------------------------------------------------------
let changed = 0;
for (const { file, data } of cities) {
  const withImg = data.pois.filter((p) => p.img).length;
  if (!withImg) continue;
  fs.writeFileSync(path.join(POI_DIR, file), JSON.stringify(data));
  changed++;
}
console.log(`\n[foto] GATA. ${filled} poze noi, ${changed} fișiere actualizate.`);
