// Tier-1 destinations: POIs sourced from OpenStreetMap, read from the
// `city_pois` table in Supabase and cached per city. This module bridges the
// OSM schema to the `dest` shape assembleRoute() consumes, so an OSM-backed
// city yields an itinerary structurally identical to the hand-curated ones —
// the rest of the app can't tell the difference.
//
// It used to read one JSON per city from public/pois/{qid}.json. Those files
// now live in data/pois/ (4,612 cities, 47 MB, gitignored as derived data) and
// are UPLOADED to Supabase by scripts/migrate-cities-to-supabase.mjs. There is
// deliberately no file fallback: shipping 47 MB of JSON to every visitor to
// cover cities most of them will never open is worse than a database query.
//
// The consequence is worth stating plainly: until that migration has run, this
// returns null for every city, and trips fall through to the live Overpass
// fetch — real results, but 5-25 seconds instead of instant.
//
// Data © OpenStreetMap contributors (ODbL).

import { tStatic } from "./i18n.js";

import { supabase } from "./lib/supabaseClient.js";

const _cache = {};

// Cities whose POIs were fetched in this session survive a reload here, so a
// trip you already opened still assembles with no connection.
const LS_PREFIX = "vai_pois_";
const LS_INDEX = "vai_pois_index";
const LS_MAX = 30;

function persistedGet(qid) {
  try { const raw = localStorage.getItem(LS_PREFIX + qid); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
}
function persistedPut(qid, payload) {
  try {
    localStorage.setItem(LS_PREFIX + qid, JSON.stringify(payload));
    let idx;
    try { idx = JSON.parse(localStorage.getItem(LS_INDEX)) || []; } catch { idx = []; }
    const at = idx.indexOf(qid);
    if (at !== -1) idx.splice(at, 1);
    idx.push(qid);
    if (idx.length > LS_MAX) {
      for (const old of idx.splice(0, idx.length - LS_MAX)) {
        try { localStorage.removeItem(LS_PREFIX + old); } catch {}
      }
    }
    localStorage.setItem(LS_INDEX, JSON.stringify(idx));
  } catch { /* quota — the fetch still worked */ }
}

const CATEGORY_EMOJI = {
  museum: "🏛", landmark: "⛪", attraction: "🎭", viewpoint: "🌇",
  park: "🌳", shopping: "🛍", restaurant: "🍽", cafe: "☕", bar: "🍸", nightclub: "🪩",
  livemusic: "🎤", casino: "🎰",
};
// Sensible default visit durations (minutes) — OSM has no notion of this.
const CATEGORY_DUR = {
  museum: 90, landmark: 40, attraction: 60, viewpoint: 45, park: 60, shopping: 60,
  // Evening stops run long — a drink is not a 40-minute monument visit.
  bar: 75, nightclub: 150, livemusic: 120, casino: 90,
};
// Which categories can become itinerary stops vs. food/drink suggestions.
//
// Bars and clubs are here deliberately. They were being fetched and stored and
// then silently dropped at the branch below, because they matched neither this
// set nor the restaurant/cafe case — so "nightlife" was a selectable interest
// that no stop could ever satisfy. assembleRoute() admits them only when the
// traveller actually asked for nightlife, so other routes are unchanged.
const STOP_CATEGORIES = new Set([
  "museum", "landmark", "attraction", "viewpoint", "park", "shopping",
  "bar", "nightclub", "livemusic", "casino",
]);

// Typical entry price (EUR) per category, used ONLY when OSM has no price
// data. Previously every OSM stop got cost: 0, which the UI renders as
// "free" — telling users the Van Gogh Museum costs nothing and zeroing out
// the tickets line of the budget. A rough estimate is far closer to the
// truth; stops priced this way are flagged `costEstimated` so the UI can
// show "~€12" rather than a confident "€12".
const CATEGORY_COST = {
  museum: 12, attraction: 10, viewpoint: 5,
  landmark: 0, park: 0, shopping: 0, // outdoor/public: genuinely free to enter
  // A bar charges no entry — what you spend is the drink. Clubs usually do
  // charge at the door. Both are estimates and render with the "~" prefix.
  bar: 8, nightclub: 15, livemusic: 20, casino: 0,
};

// Typical opening hours per evening venue, used ONLY when OSM has none.
// Nightlife is the worst-mapped category for hours — all eight of Timișoara's
// clubs have none — and "—" is actively unhelpful next to a stop the itinerary
// schedules for 23:00. These are marked `hoursEstimated` so the UI can show
// them as typical rather than as fact.
const CATEGORY_HOURS = {
  bar: "18:00–02:00",
  nightclub: "23:00–05:00",
  livemusic: "20:00–02:00",
  casino: "non-stop",
};

// First clock time in an opening_hours string, in minutes past midnight.
// A deliberately shallow read of a deep syntax: enough to know that "Fr,Sa
// 21:00-05:00" cannot be visited at eight, which is the one thing the planner
// needs. Anything it can't parse returns null and is treated as "no idea",
// never as "closed".
function opensAt(hours) {
  const m = String(hours || "").match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const mins = +m[1] * 60 + +m[2];
  return mins >= 0 && mins < 24 * 60 ? mins : null;
}

// Resolve display hours: real OSM data if present, else a typical range for the
// kind of venue, else nothing to say. `opensMin` is carried alongside so the
// route planner doesn't schedule a place before it unlocks the door.
function resolveHours(p) {
  const real = cleanHours(p.hours);
  if (real) return { hours: real, hoursEstimated: false, opensMin: opensAt(real) };
  const typical = CATEGORY_HOURS[p.category];
  if (typical) return { hours: typical, hoursEstimated: true, opensMin: null };
  return { hours: "—", hoursEstimated: false, opensMin: null };
}

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

// Load a city's POIs. Returns the payload, or null when the database has no
// row for this city — the caller then falls through to the live-OSM tier.
//
// Order: in-memory → localStorage → Supabase. The two caches mean an already
// opened city costs nothing on a second visit and still works offline.
export async function loadCityPois(qid) {
  if (!qid) return null;
  if (qid in _cache) return _cache[qid];

  const stored = persistedGet(qid);
  if (stored) { _cache[qid] = stored; return stored; }

  if (!supabase) { _cache[qid] = null; return null; }
  try {
    const { data, error } = await supabase
      .from("city_pois")
      .select("city_id,source,pois,generated_at")
      .eq("city_id", qid)
      .maybeSingle();
    // maybeSingle() returns null (not an error) when the city simply has no
    // row, which is the common case for the long tail.
    if (error || !data?.pois?.length) { _cache[qid] = null; return null; }
    const payload = {
      qid: data.city_id,
      source: data.source,
      attribution: "© OpenStreetMap contributors",
      generatedAt: data.generated_at,
      pois: data.pois,
    };
    _cache[qid] = payload;
    persistedPut(qid, payload);
    return payload;
  } catch {
    // A transient failure must not be remembered as "this city has no data" —
    // leave the cache empty so the next attempt can succeed.
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
        // Carried through so the route planner can tell a bar from a club and
        // give them different hours — 19:30 is a drink, not a dancefloor.
        category: p.category,
        emoji: CATEGORY_EMOJI[p.category] || "📍",
        tags: p.tags || ["culture"],
        dur: CATEGORY_DUR[p.category] || 60,
        ...resolveHours(p),
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
