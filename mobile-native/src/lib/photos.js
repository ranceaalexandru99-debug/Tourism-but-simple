// Resolves a representative photo for a point of interest. Free, key-less,
// CORS-enabled sources, tried in order until one yields a real photo:
//
//   1. Wikipedia REST summary (ro → en) over progressively simplified name
//      candidates — display names are Romanian ("Colosseumul", "Trastevere la
//      apus") and rarely match article titles exactly.
//   2. Wikipedia full-text SEARCH (ro → en) for "<name> <city>" — finds the
//      right article even when the title differs completely (e.g. "Bunkers
//      del Carmel" → "Turó de la Rovira"), then reads its thumbnail.
//   3. Wikimedia Commons file search — finds an actual photo even when no
//      article exists at all (e.g. a small-town street or market).
//
// Caching: in-memory + localStorage, BUT only definitive outcomes persist
// ("" = genuinely nothing found anywhere). Transient failures — 429 rate
// limits, 5xx, offline — are NOT cached, so photos can appear on a later
// visit. A small concurrency gate keeps a route screen (≈8 tiles at once)
// from tripping Wikimedia's rate limiting in the first place.

import { WIKI_HEADERS } from "./userAgent.js";

const mem = {};
// v3: bumped for the search+commons fallback chain so old cached misses retry.
const LS = (n) => `vai_photo3_${n}`;
// Bounded LRU: keeps the ~150 most recently used photo cache entries in
// localStorage so heavy users don't fill the ~5-10MB origin quota after a
// year of use. The recency index itself is a single localStorage key.
const LRU_INDEX = "vai_photo3_index";
const LRU_MAX = 150;

function bumpLru(key) {
  try {
    let idx;
    try { idx = JSON.parse(localStorage.getItem(LRU_INDEX)) || []; } catch { idx = []; }
    if (!Array.isArray(idx)) idx = [];
    // Move-to-end, then evict overflow from the front.
    const at = idx.indexOf(key);
    if (at !== -1) idx.splice(at, 1);
    idx.push(key);
    if (idx.length > LRU_MAX) {
      const dropped = idx.splice(0, idx.length - LRU_MAX);
      for (const k of dropped) { try { localStorage.removeItem(LS(k)); } catch {} }
    }
    localStorage.setItem(LRU_INDEX, JSON.stringify(idx));
  } catch {}
}

// Names whose plain Wikipedia page is a disambiguation (or the wrong thing).
const ALIASES = {
  "New York": "New York City",
};

// Locator maps, flags, coats of arms, logos and SVGs aren't destination photos.
const JUNK_IMAGE = /location_map|locator|_map\.|Flag_of|Coat_of_arms|logo|\.svg|\.png$/i;

const TRANSIENT = Symbol("transient");

async function getJson(url) {
  let res;
  // The headers are not optional here. Wikimedia answers 403 to React Native
  // default user agent, so without them every stage of this chain fails and no
  // photo ever appears — which is exactly what happened on the phone.
  try { res = await fetch(url, { headers: WIKI_HEADERS }); } catch { return TRANSIENT; }
  if (res.status === 404) return null;
  if (!res.ok) return TRANSIENT;
  try { return await res.json(); } catch { return null; }
}

// --- stage 1: REST summary ---------------------------------------------------
async function summaryThumb(lang, title) {
  const d = await getJson(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
  if (d === TRANSIENT || d === null) return d;
  if (d.type === "disambiguation") return null;
  const img = d.thumbnail?.source || d.originalimage?.source || null;
  return img && !JUNK_IMAGE.test(img) ? img : null;
}

// --- stage 2: full-text article search → summary ------------------------------
async function searchArticleThumb(lang, query) {
  const d = await getJson(
    `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=1&format=json&origin=*`
  );
  if (d === TRANSIENT) return TRANSIENT;
  const title = d?.query?.search?.[0]?.title;
  if (!title) return null;
  return summaryThumb(lang, title);
}

// --- stage 3: Commons file search ---------------------------------------------
async function commonsThumb(query) {
  const d = await getJson(
    "https://commons.wikimedia.org/w/api.php?action=query&generator=search" +
    `&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=6` +
    "&prop=imageinfo&iiprop=url&iiurlwidth=640&format=json&origin=*"
  );
  if (d === TRANSIENT) return TRANSIENT;
  const pages = Object.values(d?.query?.pages || {});
  pages.sort((a, b) => (a.index || 0) - (b.index || 0));
  for (const p of pages) {
    const info = p.imageinfo?.[0];
    const url = info?.thumburl || info?.url;
    if (url && /\.(jpe?g|webp)$/i.test(url.split("?")[0]) && !JUNK_IMAGE.test(url)) return url;
  }
  return null;
}

// Build progressively simplified lookup candidates for a display name.
function candidatesFor(name, wikiTitle) {
  const out = [];
  const push = (s) => { s = (s || "").trim(); if (s.length > 2 && !out.includes(s)) out.push(s); };
  push(wikiTitle);
  push(ALIASES[name] || name);
  const noParen = name.replace(/\s*\([^)]*\)\s*/g, " ");
  push(noParen);
  for (const part of name.split(/\s*&\s*/)) push(part.replace(/\s*\([^)]*\)\s*/g, " "));
  for (const sep of [" la ", " cu ", " în ", " pe "]) {
    const i = name.indexOf(sep);
    if (i > 3) push(name.slice(0, i));
  }
  if (/ul$/.test(name)) push(name.slice(0, -2)); // Colosseumul → Colosseum
  return out;
}

// Tiny semaphore: at most 3 POIs resolving over the network at once.
let active = 0;
const waiters = [];
const acquire = () => new Promise((res) => (active < 8 ? (active++, res()) : waiters.push(res)));
const release = () => { active--; const next = waiters.shift(); if (next) { active++; next(); } };

// `wikiTitle`: optional explicit article title. `context`: optional city name,
// used to disambiguate the search stages ("Piața Sfatului Brașov").
export async function fetchPhoto(name, wikiTitle, context) {
  if (!name) return null;
  const key = (wikiTitle || name) + (context ? `|${context}` : "");
  if (key in mem) return mem[key];
  try {
    const ls = localStorage.getItem(LS(key));
    if (ls !== null) { mem[key] = ls || null; bumpLru(key); return mem[key]; }
  } catch {}

  await acquire();
  let img = null;
  let sawTransient = false;
  const note = (r) => { if (r === TRANSIENT) { sawTransient = true; return null; } return r; };
  try {
    // 0) explicit "lang:Title" wiki override (e.g. "ca:La Barceloneta" — some
    //    places only have a good photo on their local-language Wikipedia)
    const langWiki = wikiTitle && wikiTitle.match(/^([a-z]{2,3}):(.+)$/);
    if (langWiki) img = note(await summaryThumb(langWiki[1], langWiki[2]));
    // 1) direct summaries over candidates
    if (!img)
    outer: for (const candidate of candidatesFor(name, wikiTitle)) {
      for (const lang of ["ro", "en"]) {
        img = note(await summaryThumb(lang, candidate));
        if (img) break outer;
      }
    }
    // 2) article search with city context
    if (!img) {
      const q = context ? `${name} ${context}` : name;
      for (const lang of ["ro", "en"]) {
        img = note(await searchArticleThumb(lang, q));
        if (img) break;
      }
    }
    // 3) Commons file search
    if (!img) {
      img = note(await commonsThumb(context ? `${name} ${context}` : name));
    }
  } finally {
    release();
  }

  mem[key] = img;
  // Persist hits always; persist a miss only when every lookup answered
  // definitively — a rate-limited session must not brand the POI photo-less.
  if (img || !sawTransient) {
    try { localStorage.setItem(LS(key), img || ""); } catch {}
    bumpLru(key);
  } else if (!img) {
    delete mem[key]; // allow a retry within this session too
  }
  return img;
}
