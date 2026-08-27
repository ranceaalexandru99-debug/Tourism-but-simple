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

import { supabase } from "./lib/supabaseClient.js";

// Must match migrate-cities-to-supabase.mjs, which writes cities.name_norm with
// this exact transform. If the two drift, searches stop matching.
const normalize = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Row → the compact shape the rest of the app already speaks.
const toCity = (r) => ({
  id: r.id, n: r.name, c: r.country, ll: [r.lat, r.lon],
  p: r.population ?? undefined, r: r.rank, co: r.continent, t: r.tier,
  img: r.img ?? undefined,
});

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
async function cached(key, run) {
  const hit = cacheGet(key);
  if (hit) return hit;
  if (!supabase) return [];
  try {
    const rows = await run();
    const value = (rows || []).map(toCity);
    if (value.length) cachePut(key, value);
    return value;
  } catch {
    return cacheGet(key) || [];
  }
}

// ---- aliases ---------------------------------------------------------------
// Endonyms and common exonyms → the English names Wikidata uses. Kept on the
// client (it is a couple of hundred bytes) so a typed "București" is translated
// to "Bucharest" BEFORE the query goes out — the database only stores the
// canonical name.
const ALIASES = {
  bucuresti: "Bucharest", londra: "London", viena: "Vienna", praga: "Prague",
  varsovia: "Warsaw", moscova: "Moscow", atena: "Athens", lisabona: "Lisbon",
  copenhaga: "Copenhagen", venetia: "Venice", florenta: "Florence",
  neapole: "Naples", cracovia: "Kraków", budapesta: "Budapest", belgrad: "Belgrade",
  kiev: "Kyiv", "sankt petersburg": "Saint Petersburg", ierusalim: "Jerusalem",
  tokio: "Tokyo", seul: "Seoul", marsilia: "Marseille", nisa: "Nice",
  colonia: "Cologne", geneva: "Geneva", haga: "The Hague", anvers: "Antwerp",
  damasc: "Damascus", bagdad: "Baghdad", teheran: "Tehran", alger: "Algiers",
  salonic: "Thessaloniki", sevilia: "Seville", torino: "Turin", milano: "Milan",
  genova: "Genoa", zurich: "Zurich", munchen: "Munich", edinburg: "Edinburgh",
  wien: "Vienna", praha: "Prague", warszawa: "Warsaw", moskva: "Moscow",
  athina: "Athens", lisboa: "Lisbon", kobenhavn: "Copenhagen", venezia: "Venice",
  firenze: "Florence", napoli: "Naples", krakau: "Kraków", beograd: "Belgrade",
  muenchen: "Munich", koln: "Cologne", "den haag": "The Hague", antwerpen: "Antwerp",
  gent: "Ghent", sevilla: "Seville", roma: "Rome",
  londres: "London", vienne: "Vienna", varsovie: "Warsaw", moscou: "Moscow",
  athenes: "Athens", lisbonne: "Lisbon", venise: "Venice", napoles: "Naples",
  edimburgo: "Edinburgh", mailand: "Milan", genf: "Geneva", ginevra: "Geneva",
};

// Either the user is still typing the alias ("bucu" → "bucuresti"), or it
// appears as a whole word at the start ("roma 2 zile"). The trailing boundary
// matters: a bare prefix test made "românia" match "roma" and return Rome.
function queryHitsAlias(query, key) {
  if (key.startsWith(query)) return true;
  return query === key || query.startsWith(key + " ");
}
function aliasTargets(query) {
  const out = [];
  for (const key in ALIASES) if (queryHitsAlias(query, key)) out.push(normalize(ALIASES[key]));
  return out;
}

// ---- public API ------------------------------------------------------------

// PostgREST `or=` takes a comma-separated filter list, and a comma inside a
// value would be read as a separator. City names can contain commas, so escape
// the pattern by quoting it.
const likePattern = (p) => `name_norm.like."${p.replace(/"/g, '\\"')}"`;

export async function searchDestinations(q, n = 8) {
  const query = normalize(q).trim();
  if (query.length < 2) return [];
  if (!supabase) return [];

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
  });
}

// Does this typed name refer to this city? Strict, synchronous, and pure — the
// route tiers call it to decide whether a search hit is really what the user
// asked for.
export function nameMatchesCity(query, city) {
  const q = normalize(query);
  const name = normalize(city.n);
  const startsWithWord = (w) => q === w || q.startsWith(w + " ");
  if (startsWithWord(name)) return true;
  for (const key in ALIASES) {
    if (normalize(ALIASES[key]) === name && startsWithWord(key)) return true;
  }
  return false;
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
  });
  return shuffle(pool).slice(0, n);
}

export async function getHiddenGems(n = 6) {
  const pool = await cached("rail:hidden", async () => {
    const { data, error } = await supabase.from("cities").select(railSelect)
      .eq("tier", "notable").lt("population", 60000)
      .order("rank", { ascending: false }).limit(RAIL_POOL);
    if (error) throw error;
    return data;
  });
  return shuffle(pool).slice(0, n);
}

export async function getEuropeWeekend(n = 6) {
  const pool = await cached("rail:europe", async () => {
    const { data, error } = await supabase.from("cities").select(railSelect)
      .eq("continent", "EU").in("tier", ["mega", "major"])
      .order("rank", { ascending: false }).limit(RAIL_POOL);
    if (error) throw error;
    return data;
  });
  return shuffle(pool).slice(0, n);
}

// ---- map exploration -------------------------------------------------------

// Which tiers are worth drawing at a given zoom. Rendering all 5000 cities at
// world zoom would be both unreadable and slow, so the map shows only the
// recognisable ones when zoomed out and fills in the smaller places as the user
// closes in — the same way paper atlases label by scale.
function tiersForZoom(zoom) {
  if (zoom < 5) return ["mega"];
  if (zoom < 7) return ["mega", "major"];
  if (zoom < 9) return ["mega", "major", "notable"];
  return ["mega", "major", "notable", "hidden"];
}

// Longitude is stored in [-180, 180], but a map viewport is not. Panning west
// of the antimeridian gives Leaflet bounds like west=174.8, east=184.2 — a
// perfectly ordered pair whose eastern half simply doesn't exist in that range,
// so a plain BETWEEN silently drops every city past the date line. Turn the
// viewport into the one or two real ranges it actually covers.
export function lonRanges(west, east) {
  if (east - west >= 360) return [[-180, 180]];         // whole world in view
  // Left exact when it is already valid: the modulo round-trip is lossy in
  // binary floating point (21.3 comes back as 21.299999999999955), and there is
  // no reason to perturb the overwhelmingly common in-range case.
  const wrap = (l) => (l >= -180 && l <= 180 ? l : ((((l + 180) % 360) + 360) % 360) - 180);
  const w = wrap(west);
  const e = wrap(east);
  return w > e ? [[w, 180], [-180, e]] : [[w, e]];
}

// Cities inside the visible rectangle, most recognisable first.
// `bounds` is { south, west, north, east } in degrees.
//
// Deliberately NOT cached: the viewport changes constantly, so caching every
// rectangle would fill localStorage with near-duplicates. The queries are small
// and indexed; panning stays cheap.
export async function getCitiesInBounds(bounds, { zoom = 6, limit = 120 } = {}) {
  if (!supabase || !bounds) return [];
  const { south, west, north, east } = bounds;
  if ([south, west, north, east].some((v) => typeof v !== "number" || Number.isNaN(v))) return [];

  const query = (w, e) => supabase
    .from("cities")
    .select(railSelect)
    .gte("lat", south).lte("lat", north)
    .gte("lon", w).lte("lon", e)
    .in("tier", tiersForZoom(zoom))
    .order("rank", { ascending: false })
    .limit(limit);

  try {
    const results = await Promise.all(lonRanges(west, east).map(([w, e]) => query(w, e)));
    const rows = results.flatMap((r) => (r.error ? [] : r.data || []));
    return rows
      .sort((a, b) => b.rank - a.rank)
      .slice(0, limit)
      .map(toCity);
  } catch {
    return [];
  }
}

// Continent slice — kept for parity with the previous module.
export async function getByContinent(code, n = 10) {
  const pool = await cached(`rail:co:${code}`, async () => {
    const { data, error } = await supabase.from("cities").select(railSelect)
      .eq("continent", code).neq("tier", "hidden")
      .order("rank", { ascending: false }).limit(RAIL_POOL);
    if (error) throw error;
    return data;
  });
  return shuffle(pool).slice(0, n);
}
