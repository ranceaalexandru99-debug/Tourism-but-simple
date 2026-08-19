// Pre-generated OpenStreetMap POI files, native edition.
//
// The web app serves these from its own origin (/pois/{qid}.json). A native
// app has no origin, and bundling all 487 files would add ~6 MB to the binary
// for data that changes independently of releases — so they are fetched from
// the deployed website instead, and cached on the device after first use.
//
// POI_BASE_URL is the one thing to set after deploying the web app. Until then
// it stays empty and the tier is skipped: routeEngine falls through to the
// live Overpass lookup, which needs no server at all. Nothing breaks either
// way — the only difference is how quickly a popular city resolves.
//
// Data © OpenStreetMap contributors (ODbL).

import { tStatic } from "./i18n.js";

// e.g. "https://turism-dar-simplu.netlify.app" — no trailing slash.
export const POI_BASE_URL = "";

const _cache = {};
const CACHE_PREFIX = "vai_poi_file_";

const CATEGORY_EMOJI = {
  museum: "🏛", landmark: "⛪", attraction: "🎭", viewpoint: "🌇",
  park: "🌳", shopping: "🛍", restaurant: "🍽", cafe: "☕", bar: "🍸",
};
// Sensible default visit durations (minutes) — OSM has no notion of this.
const CATEGORY_DUR = {
  museum: 90, landmark: 40, attraction: 60, viewpoint: 45, park: 60, shopping: 60,
};
// Which categories are sightseeing stops vs. food/drink suggestions.
const STOP_CATEGORIES = new Set(["museum", "landmark", "attraction", "viewpoint", "park", "shopping"]);

// Typical entry price (EUR) when OSM carries no price. A flat 0 would render
// as "free" and tell travellers the Van Gogh Museum costs nothing; stops
// priced this way are flagged so the UI can show "~€12" rather than "€12".
const CATEGORY_COST = {
  museum: 12, attraction: 10, viewpoint: 5,
  landmark: 0, park: 0, shopping: 0, // outdoor/public: genuinely free to enter
};
function resolveCost(p) {
  const m = String(p.charge || "").match(/(\d+(?:[.,]\d+)?)/);
  if (m) return { cost: Math.round(parseFloat(m[1].replace(",", "."))), costEstimated: false };
  if (p.fee === "no") return { cost: 0, costEstimated: false };
  const est = CATEGORY_COST[p.category] ?? 0;
  return { cost: est, costEstimated: est > 0 };
}

// OSM opening_hours carries machine shorthand ("PH off" = closed on public
// holidays) that means nothing to a traveller. Strip those clauses.
function cleanHours(h) {
  if (!h) return null;
  const cleaned = h
    .replace(/;?\s*(PH|SH)\s*(off|closed|open)?/gi, "")
    .replace(/\s*;\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned.length > 1 ? cleaned : null;
}

// Fetch a city's POI file from the website, with an on-device cache. Returns
// null when there's no file (or no base URL configured), so the caller can
// fall through to the live tier.
export async function loadCityPois(qid) {
  if (!qid || !POI_BASE_URL) return null;
  if (qid in _cache) return _cache[qid];
  try {
    const stored = localStorage.getItem(CACHE_PREFIX + qid);
    if (stored) { _cache[qid] = JSON.parse(stored); return _cache[qid]; }
  } catch {}
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(`${POI_BASE_URL}/pois/${qid}.json`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) { _cache[qid] = null; return null; }
    const payload = await res.json();
    _cache[qid] = payload;
    try { localStorage.setItem(CACHE_PREFIX + qid, JSON.stringify(payload)); } catch {}
    return payload;
  } catch {
    _cache[qid] = null;
    return null;
  }
}

// Convert an OSM payload + city metadata into the `dest` object assembleRoute()
// expects. Sightseeing POIs become stops; restaurants and cafés become food
// suggestions, so a route never fills up with cafés.
export function buildDest(cityMeta, payload) {
  const stops = [];
  const food = [];
  for (const p of payload.pois) {
    if (STOP_CATEGORIES.has(p.category)) {
      stops.push({
        name: p.name,
        wiki: p.wiki,
        emoji: CATEGORY_EMOJI[p.category] || "📍",
        tags: p.tags || ["culture"],
        dur: CATEGORY_DUR[p.category] || 60,
        hours: cleanHours(p.hours) || "—",
        ...resolveCost(p),
        img: p.img, // Commons filename resolved at build time
        // An empty string renders a blank "local tip" card.
        tip: p.website ? `Site: ${p.website}` : undefined,
        ll: p.ll,
      });
    } else if (p.category === "restaurant" || p.category === "cafe") {
      food.push(`${CATEGORY_EMOJI[p.category]} ${p.name}`);
    }
  }
  return {
    key: "osm", // NOT "ai"/"custom" → stops aren't flagged unverified: they're real
    name: cityMeta.name,
    country: cityMeta.country,
    emoji: cityMeta.emoji || "📍",
    blurb: cityMeta.blurb || "",
    center: cityMeta.ll,
    pois: stops,
    food: food.length ? food.slice(0, 6) : [tStatic("osmFoodFallback")],
    transport: tStatic("osmTransport"),
  };
}
