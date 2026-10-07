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
import { buildDest as buildDestShared } from "./shared/poiDest.js";

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

// The POI → `dest` bridge and its category tables now live in
// src/shared/poiDest.js, so the native app can use the same ones. See the
// re-export at the bottom of this file.

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

// The bridge itself is in src/shared/poiDest.js. This wrapper keeps the
// existing call signature and supplies the two localized strings, which the
// shared module cannot look up — web and native have different i18n modules.
export function buildDest(cityMeta, payload) {
  return buildDestShared(cityMeta, payload, {
    foodFallback: tStatic("osmFoodFallback"),
    transport: tStatic("osmTransport"),
  });
}
