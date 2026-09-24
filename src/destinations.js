// Destination index, served from Supabase.
//
// This used to be a 748 KB JSON bundled into the app. Moving it to the database
// takes 220 KB (gzipped) out of the download and lets the data be corrected
// without a redeploy — at the cost of search now needing a network round-trip.
//
// Two things soften that cost:
//   • every query result is cached in localStorage, so repeating a search (and
//     the Home rails) works offline after the first time;
//   • saved trips are stored complete, so an already-planned trip stays fully
//     usable with no connection at all.
//
// The public API is unchanged — searchDestinations / getTrending /
// getHiddenGems / getEuropeWeekend were already async, and nameMatchesCity
// stays a synchronous pure function.

import { lonRanges, tiersForZoom, usableBounds, selectCitiesInBounds } from "./shared/cityBounds.js";
import { normalize, aliasTargets, searchLocal } from "./shared/citySearch.js";
import { supabase } from "./lib/supabaseClient.js";

// Re-exported: every caller has always imported it from here, and it is the
// same pure function on both platforms now.
export { nameMatchesCity } from "./shared/citySearch.js";

// Row → the compact shape the rest of the app already speaks.
const toCity = (r) => ({
  id: r.id, n: r.name, c: r.country, ll: [r.lat, r.lon],
  p: r.population ?? undefined, r: r.rank, co: r.continent, t: r.tier,
  img: r.img ?? undefined,
});

// ---- fallback --------------------------------------------------------------
// When the database cannot be reached, three features return nothing and say
// nothing: city suggestions, the Home rails and the explore map. The user sees
// an app that appears to know no cities at all — which is what happens today,
// because the configured project does not resolve.
//
// So: the best-known 576 cities, built by scripts/build-fallback-index.mjs.
// Imported LAZILY and only after a query has actually failed, so nothing is
// added to the initial download and the happy path is untouched.
//
// Not the whole index — that would put back most of the 216 KB the move to
// Supabase removed. The promise here is "the cities everyone has heard of",
// which is the right promise for a degraded mode.
let fallbackPromise = null;
function loadFallback() {
  if (!fallbackPromise) {
    fallbackPromise = import("./data/fallbackCities.json")
      .then((m) => m.default)
      // A fallback that fails to load must not become a second error the
      // caller has to handle. An empty list degrades to today's behaviour.
      .catch(() => []);
  }
  return fallbackPromise;
}

// Whether the last attempt to reach the database failed. Only used to decide
// whether it is worth telling the user the list is a short one.
let degraded = !supabase;
export const isDegraded = () => degraded;

// ---- cache -----------------------------------------------------------------
// Small, bounded, and explicitly best-effort: a cache miss costs a round-trip,
// never correctness.
const CACHE_PREFIX = "vai_dest_q_";
const CACHE_INDEX = "vai_dest_q_index";
const CACHE_MAX = 60;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function cacheGet(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { t, v } = JSON.parse(raw);
    if (!t || Date.now() - t > CACHE_TTL_MS) return null;
    return v;
  } catch { return null; }
}
function cachePut(key, value) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ t: Date.now(), v: value }));
    let idx;
    try { idx = JSON.parse(localStorage.getItem(CACHE_INDEX)) || []; } catch { idx = []; }
    const at = idx.indexOf(key);
    if (at !== -1) idx.splice(at, 1);
    idx.push(key);
    if (idx.length > CACHE_MAX) {
      for (const old of idx.splice(0, idx.length - CACHE_MAX)) {
        try { localStorage.removeItem(CACHE_PREFIX + old); } catch {}
      }
    }
    localStorage.setItem(CACHE_INDEX, JSON.stringify(idx));
  } catch { /* quota / private mode — the query still worked */ }
}

// Run a query, serving (and refreshing) the cache around it. On a network
// failure a stale-but-usable cached answer beats an empty screen.
async function cached(key, run, fallback) {
  const hit = cacheGet(key);
  if (hit) return hit;
  // An empty result here is indistinguishable from "we know no cities", so
  // every path that cannot reach the database goes through the fallback.
  if (!supabase) { degraded = true; return fallback ? fallback(await loadFallback()) : []; }
  try {
    const rows = await run();
    const value = (rows || []).map(toCity);
    if (value.length) cachePut(key, value);
    degraded = false;
    return value;
  } catch {
    degraded = true;
    const stale = cacheGet(key);
    if (stale) return stale;
    return fallback ? fallback(await loadFallback()) : [];
  }
}

// ---- public API ------------------------------------------------------------

// PostgREST `or=` takes a comma-separated filter list, and a comma inside a
// value would be read as a separator. City names can contain commas, so escape
// the pattern by quoting it.
const likePattern = (p) => `name_norm.like."${p.replace(/"/g, '\\"')}"`;

export async function searchDestinations(q, n = 8) {
  const query = normalize(q).trim();
  if (query.length < 2) return [];

  const targets = [query, ...aliasTargets(query)];
  const key = `s:${targets.join("|")}:${n}`;

  return cached(key, async () => {
    // One round-trip for both prefix and substring matches across the query and
    // any alias it resolves to. Ordering by rank puts the recognizable city
    // first — "par" should surface Paris, not Paramaribo.
    const filters = targets.flatMap((t) => [likePattern(`${t}%`), likePattern(`%${t}%`)]);
    const { data, error } = await supabase
      .from("cities")
      .select("id,name,country,lat,lon,population,rank,continent,tier,img")
      .or(filters.join(","))
      .order("rank", { ascending: false })
      .limit(n * 4);
    if (error) throw error;

    // Re-rank client-side so a prefix match always beats a mere substring —
    // SQL returned both in one pass, but only rank order.
    const scored = (data || []).map((row) => {
      const name = normalize(row.name);
      const best = Math.max(...targets.map((t) =>
        name.startsWith(t) ? row.rank + 1000 : name.includes(t) ? row.rank : 0));
      return { row, best };
    }).filter((x) => x.best > 0);
    scored.sort((a, b) => b.best - a.best);
    return scored.slice(0, n).map((x) => x.row);
  // The fallback is already in the compact shape, so it skips toCity — hence
  // searchLocal rather than a second copy of the ranking above. It is the same
  // ranking: the shared module is where that rule now lives.
  }, (cities) => searchLocal(cities, q, n));
}

// ---- Home rails ------------------------------------------------------------
// Each rail asks for a wider slice than it shows and shuffles client-side, so
// the feed varies between visits without a query per refresh. `random_seed`
// would need a Postgres function; this keeps it to plain selects.
function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const RAIL_POOL = 120;
const railSelect = "id,name,country,lat,lon,population,rank,continent,tier,img";

export async function getTrending(n = 6) {
  const pool = await cached("rail:trending", async () => {
    const { data, error } = await supabase.from("cities").select(railSelect)
      .in("tier", ["mega", "major"]).order("rank", { ascending: false }).limit(RAIL_POOL);
    if (error) throw error;
    return data;
  }, (cities) => cities.filter((c) => c.t === "mega" || c.t === "major").slice(0, RAIL_POOL));
  return shuffle(pool).slice(0, n);
}

export async function getHiddenGems(n = 6) {
  const pool = await cached("rail:hidden", async () => {
    const { data, error } = await supabase.from("cities").select(railSelect)
      .eq("tier", "notable").lt("population", 60000)
      .order("rank", { ascending: false }).limit(RAIL_POOL);
    if (error) throw error;
    return data;
  // The fallback carries no "notable" cities at all — it is mega and major
  // only. An empty rail is correct here: inventing hidden gems out of the most
  // famous cities in the world would be the opposite of what the rail promises.
  }, () => []);
  return shuffle(pool).slice(0, n);
}

export async function getEuropeWeekend(n = 6) {
  const pool = await cached("rail:europe", async () => {
    const { data, error } = await supabase.from("cities").select(railSelect)
      .eq("continent", "EU").in("tier", ["mega", "major"])
      .order("rank", { ascending: false }).limit(RAIL_POOL);
    if (error) throw error;
    return data;
  }, (cities) => cities.filter((c) => c.co === "EU").slice(0, RAIL_POOL));
  return shuffle(pool).slice(0, n);
}

// ---- map exploration -------------------------------------------------------

// The viewport rules live in a module shared byte-for-byte with the native app,
// so a pan shows the same cities on both. lonRanges is re-exported because it
// was public here first and has its own tests.
export { lonRanges, tiersForZoom, usableBounds } from "./shared/cityBounds.js";



// Cities inside the visible rectangle, most recognisable first.
// `bounds` is { south, west, north, east } in degrees.
//
// Deliberately NOT cached: the viewport changes constantly, so caching every
// rectangle would fill localStorage with near-duplicates. The queries are small
// and indexed; panning stays cheap.
export async function getCitiesInBounds(bounds, { zoom = 6, limit = 120 } = {}) {
  if (!usableBounds(bounds)) return [];
  if (!supabase) {
    degraded = true;
    return selectCitiesInBounds(await loadFallback(), bounds, { zoom, limit });
  }
  const { south, west, north, east } = bounds;

  const query = (w, e) => supabase
    .from("cities")
    .select(railSelect)
    .gte("lat", south).lte("lat", north)
    .gte("lon", w).lte("lon", e)
    .in("tier", tiersForZoom(zoom))
    .order("rank", { ascending: false })
    .limit(limit);

  // Failures are NOT swallowed into an empty list. "The server is unreachable"
  // and "there are no cities here" are different facts, and returning [] for
  // both left the map telling people to move it — advice that could never work,
  // forever, with nothing saying why. The caller decides what to show.
  const results = await Promise.all(lonRanges(west, east).map(([w, e]) => query(w, e)));
  const failed = results.find((r) => r.error);
  if (failed) {
    // Showing the best-known cities beats showing a map that says the world is
    // empty. The screen still learns it is degraded, via isDegraded().
    degraded = true;
    const fb = selectCitiesInBounds(await loadFallback(), bounds, { zoom, limit });
    if (fb.length) return fb;
    throw new Error(failed.error.message || "query_failed");
  }
  degraded = false;

  return results
    .flatMap((r) => r.data || [])
    .sort((a, b) => b.rank - a.rank)
    .slice(0, limit)
    .map(toCity);
}

// Continent slice — kept for parity with the previous module.
export async function getByContinent(code, n = 10) {
  const pool = await cached(`rail:co:${code}`, async () => {
    const { data, error } = await supabase.from("cities").select(railSelect)
      .eq("continent", code).neq("tier", "hidden")
      .order("rank", { ascending: false }).limit(RAIL_POOL);
    if (error) throw error;
    return data;
  }, (cities) => cities.filter((c) => c.co === code).slice(0, RAIL_POOL));
  return shuffle(pool).slice(0, n);
}
