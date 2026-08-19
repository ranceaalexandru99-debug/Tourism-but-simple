// Tier-1 destinations: pre-generated POI files sourced from OpenStreetMap, one
// JSON per city at public/pois/{qid}.json. Lazy-loaded + cached. This module
// bridges the OSM schema to the `dest` shape assembleRoute() consumes, so an
// OSM-backed city yields an itinerary structurally identical to the hand-
// curated ones — the rest of the app can't tell the difference.
//
// Data © OpenStreetMap contributors (ODbL).

import { tStatic } from "./i18n.js";

const _cache = {};

// A small index (public/pois/index.json) lists every city Qid that has a POI
// file. We check it before fetching so the ~4900 cities WITHOUT a file don't
// each cost a failed 404 round-trip — the lookup is a single in-memory Set.
let _index = null;
async function loadIndex() {
  if (_index) return _index;
  try {
    const res = await fetch("/pois/index.json");
    _index = new Set(res.ok ? await res.json() : []);
  } catch {
    _index = new Set();
  }
  return _index;
}

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

// Typical entry price (EUR) per category, used ONLY when OSM has no price
// data. Previously every OSM stop got cost: 0, which the UI renders as
// "free" — telling users the Van Gogh Museum costs nothing and zeroing out
// the tickets line of the budget. A rough estimate is far closer to the
// truth; stops priced this way are flagged `costEstimated` so the UI can
// show "~€12" rather than a confident "€12".
const CATEGORY_COST = {
  museum: 12, attraction: 10, viewpoint: 5,
  landmark: 0, park: 0, shopping: 0, // outdoor/public: genuinely free to enter
};

// Resolve a stop's entry price from OSM tags, falling back to the estimate.
// `charge` looks like "5 EUR" / "€7.50" / "12"; `fee=no` means free.
function resolveCost(p) {
  const m = String(p.charge || "").match(/(\d+(?:[.,]\d+)?)/);
  if (m) return { cost: Math.round(parseFloat(m[1].replace(",", "."))), costEstimated: false };
  if (p.fee === "no") return { cost: 0, costEstimated: false };
  const est = CATEGORY_COST[p.category] ?? 0;
  return { cost: est, costEstimated: est > 0 };
}

// OSM opening_hours uses machine shorthand that confuses humans — "PH off"
// (public holidays closed), "SH" (school holidays). Strip those clauses and
// tidy separators; keep the readable day/time parts as-is.
function cleanHours(h) {
  if (!h) return null;
  const cleaned = h
    .replace(/;?\s*(PH|SH)\s*(off|closed|open)?/gi, "")
    .replace(/\s*;\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned.length > 1 ? cleaned : null;
}

// Fetch + cache a city's POI file. Returns the payload, or null if there's no
// curated file for this city (so the caller falls through to the AI tier).
export async function loadCityPois(qid) {
  if (!qid) return null;
  if (qid in _cache) return _cache[qid];
  const idx = await loadIndex();
  if (!idx.has(qid)) { _cache[qid] = null; return null; } // no file — skip the fetch
  try {
    const res = await fetch(`/pois/${qid}.json`);
    if (!res.ok) { _cache[qid] = null; return null; }
    _cache[qid] = await res.json();
    return _cache[qid];
  } catch {
    _cache[qid] = null;
    return null;
  }
}

// Convert an OSM POI payload + city metadata into the `dest` object that
// assembleRoute() expects. Sightseeing POIs become itinerary stops;
// restaurants and cafés become the food/lunch suggestions (never sightseeing
// stops, so the route doesn't fill up with cafés).
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
        // Photo resolved at build time (Commons filename) — PoiImage renders it
        // straight away instead of running the runtime lookup chain.
        img: p.img,
        // Empty string renders an blank "local tip" card, so leave it undefined
        // when OSM gave us nothing worth saying.
        tip: p.website ? `Site: ${p.website}` : undefined,
        ll: p.ll,
      });
    } else if (p.category === "restaurant" || p.category === "cafe") {
      food.push(`${CATEGORY_EMOJI[p.category]} ${p.name}`);
    }
  }
  return {
    key: "osm", // NOT "ai"/"custom" → stops aren't flagged unverified (they're real places)
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
