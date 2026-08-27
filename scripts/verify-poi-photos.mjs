// Validate every baked-in POI photo against the Commons API and drop the ones
// that would look broken or wrong in the app.
//
//   node scripts/verify-poi-photos.mjs            # report only
//   node scripts/verify-poi-photos.mjs --fix      # also rewrite the POI files
//
// Rejects, with reasons:
//   missing    — the file no longer exists on Commons (renders as a dead tile)
//   mime       — not a photo (SVG/PDF/TIFF: vector plans, scanned documents)
//   tiny       — under 500px on the long side; upscales into a blurry card
//   panorama   — aspect ratio beyond 3.2:1 or under 1:2.2; crops into a sliver
//   archival   — a century-old photograph of the place, not today's view
//
// Archival detection uses the capture date from Commons metadata when present,
// falling back to age-based licence categories. Two earlier attempts failed and
// are documented at isArchival() — pixel chroma fired backwards, and a blanket
// /^PD-/ test threw away hundreds of modern public-domain photos.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const POI_DIR = path.join(ROOT, "data", "pois");
const UA = "TurismDarSimplu/0.1 (rancea.alexandru99@gmail.com)";
const FIX = process.argv.includes("--fix");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(url) {
  for (let a = 0; a < 4; a++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.status === 429 || res.status >= 500) { await sleep(3000 * (a + 1)); continue; }
      if (!res.ok) return null;
      return await res.json();
    } catch { await sleep(2000); }
  }
  return null;
}

// Is this a century-old picture of the place rather than today's view?
//
// The capture date decides it whenever Commons has one — that is the fact we
// actually care about. Categories are only a fallback, and they must name an
// AGE-based public-domain tag (PD-old, PD-US: copyright lapsed with time).
// A blanket /^PD-/ test was tried and was wrong: PD-self and PD-user mark
// modern photos whose authors simply waived their rights, and it threw away
// 614 perfectly good 2005-2009 photographs before the mistake was caught.
const AGE_LICENCE = /PD[ -](old|US|1923|1996|Art|Italy|Russia|Poland|Ukraine)|expired copyright|PD[ -]因|Public domain.*(1[5-8]\d\d|19[0-2]\d)/i;
const HISTORICAL = /\b(1[5-8]\d\d|19[0-2]\d)s? (photograph|photo|image|postcard)|Black and white photograph|Historical images|Old photograph|Archival/i;

function yearOf(extmeta) {
  const raw = extmeta?.DateTimeOriginal?.value || extmeta?.DateTime?.value || "";
  const m = String(raw).match(/\b(1[5-9]\d\d|20[0-2]\d)\b/);
  return m ? Number(m[1]) : null;
}

function isArchival(cats, extmeta) {
  const year = yearOf(extmeta);
  if (year !== null) return year < 1960;          // the fact, when we have it
  if (cats.some((c) => /^Taken with /i.test(c))) return false; // modern camera
  return cats.some((c) => AGE_LICENCE.test(c)) || cats.some((c) => HISTORICAL.test(c));
}

// --- collect every referenced image -----------------------------------------
const files = fs.readdirSync(POI_DIR).filter((f) => /^Q\d+\.json$/.test(f));
const cities = files.map((f) => ({ file: f, data: JSON.parse(fs.readFileSync(path.join(POI_DIR, f), "utf8")) }));
const usage = new Map(); // filename → [poi, ...]
for (const { data } of cities) {
  for (const p of data.pois) {
    if (!p.img) continue;
    if (!usage.has(p.img)) usage.set(p.img, []);
    usage.get(p.img).push(p);
  }
}
const names = [...usage.keys()];
console.log(`[verif] ${names.length} fișiere distincte, ${[...usage.values()].reduce((s, a) => s + a.length, 0)} referințe`);

// MediaWiki normalises underscores to spaces in page titles, so the name that
// comes back rarely matches the stored filename byte for byte. Compare on a
// canonical form or every underscored file looks "missing".
const canon = (n) => n.replace(/_/g, " ").trim();
const byCanon = new Map(names.map((n) => [canon(n), n]));

// --- pass 1: existence, mime, size (batched) ---------------------------------
const verdict = new Map(); // filename → { ok } | { bad: reason }
const CHUNK = 50;
for (let i = 0; i < names.length; i += CHUNK) {
  const chunk = names.slice(i, i + CHUNK);
  const titles = chunk.map((n) => "File:" + n).join("|");
  const data = await api(
    "https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo|categories" +
    "&iiprop=size|mime|extmetadata&cllimit=max&titles=" + encodeURIComponent(titles),
  );
  const pages = Object.values(data?.query?.pages || {});
  for (const pg of pages) {
    // Map the returned (normalised) title back to the filename we store.
    const name = byCanon.get(canon((pg.title || "").replace(/^File:/, "")));
    if (!name) continue;
    if (pg.missing !== undefined || !pg.imageinfo?.length) { verdict.set(name, { bad: "missing" }); continue; }
    const info = pg.imageinfo[0];
    const { width: w, height: h, mime } = info;
    if (!/^image\/(jpeg|png|webp)$/.test(mime || "")) { verdict.set(name, { bad: "mime", mime }); continue; }
    if (Math.max(w, h) < 500) { verdict.set(name, { bad: "tiny", size: `${w}x${h}` }); continue; }
    const ar = w / h;
    if (ar > 3.2 || ar < 0.45) { verdict.set(name, { bad: "panorama", size: `${w}x${h}` }); continue; }
    const cats = (pg.categories || []).map((c) => c.title.replace(/^Category:/, ""));
    if (isArchival(cats, info.extmetadata)) { verdict.set(name, { bad: "archival" }); continue; }
    verdict.set(name, { ok: true, w, h });
  }
  // Titles Commons normalised away (or never answered) count as missing.
  for (const n of chunk) if (!verdict.has(n)) verdict.set(n, { bad: "missing" });
  if ((i / CHUNK) % 10 === 0) {
    const bad = [...verdict.values()].filter((v) => v.bad).length;
    console.log(`[verif] ${Math.min(i + CHUNK, names.length)}/${names.length} — respinse până acum: ${bad}`);
  }
  await sleep(400);
}

// --- report ------------------------------------------------------------------
const byReason = {};
let badRefs = 0;
for (const [name, v] of verdict) {
  if (!v.bad) continue;
  byReason[v.bad] = (byReason[v.bad] || 0) + 1;
  badRefs += usage.get(name).length;
}
console.log("\n[verif] REZULTAT");
console.log("  fișiere respinse:", Object.entries(byReason).map(([k, n]) => `${k}=${n}`).join("  ") || "niciunul");
console.log("  referințe POI afectate:", badRefs);

const examples = [...verdict].filter(([, v]) => v.bad).slice(0, 12);
for (const [name, v] of examples) console.log(`    ${v.bad.padEnd(10)} ${name.slice(0, 60)}`);

// --- fix ---------------------------------------------------------------------
if (FIX) {
  let removed = 0, touched = 0;
  for (const { file, data } of cities) {
    let changed = false;
    for (const p of data.pois) {
      if (p.img && verdict.get(p.img)?.bad) { delete p.img; removed++; changed = true; }
    }
    if (changed) { fs.writeFileSync(path.join(POI_DIR, file), JSON.stringify(data)); touched++; }
  }
  console.log(`\n[verif] CURĂȚAT: ${removed} poze eliminate din ${touched} fișiere.`);
  console.log("  POI-urile rămân cu lookup-ul la runtime, care poate găsi altceva.");
} else {
  console.log("\n[verif] doar raport — rulează cu --fix pentru a le elimina.");
}
