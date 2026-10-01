// Shared OpenStreetMap → POI curation rules. Used by BOTH:
//   - scripts/batch-pois.mjs  (Node — pre-generates public/pois/{qid}.json)
//   - src/osmLive.js          (browser — live Tier-1.5 fetch for any city)
// One module so the two paths can never drift apart.
//
// Data © OpenStreetMap contributors (ODbL).

// OSM tag → our category. Order matters: first match wins.
export function categorize(t) {
  if (t.tourism === "museum" || t.tourism === "gallery") return "museum";
  if (t.tourism === "viewpoint") return "viewpoint";
  if (t.tourism === "attraction" || t.tourism === "artwork" || t.tourism === "theme_park" || t.tourism === "zoo") return "attraction";
  if (t.historic) return "landmark";
  if (t.amenity === "place_of_worship") return "landmark";
  if (t.leisure === "park" || t.leisure === "garden") return "park";
  if (t.amenity === "restaurant") return "restaurant";
  if (t.amenity === "cafe") return "cafe";
  if (t.amenity === "nightclub") return "nightclub";
  if (t.amenity === "music_venue") return "livemusic";
  // `amenity=casino` is deliberately NOT queried above, so this only ever fires
  // for data already on disk. The tag proved unreliable: all fifteen Overpass
  // returned for Timișoara were slot-machine halls and betting shops (MaxBet,
  // Super Bet), and Belfast's was an amusement arcade. The mapping stays so
  // existing rows still render; the collection stopped.
  if (t.amenity === "casino") return "casino";
  // leisure=dance covers both dance VENUES and dance SCHOOLS; the schools carry
  // dance:teaching=yes, and a Tuesday salsa class is not a night out.
  if (t.leisure === "dance" && t["dance:teaching"] !== "yes") return "nightclub";
  if (t.amenity === "bar" || t.amenity === "pub" || t.amenity === "biergarten") return "bar";
  if (t.shop === "mall" || t.shop === "department_store" || t.amenity === "marketplace") return "shopping";
  return null;
}

// SIGHTSEEING categories, used by batch-pois.mjs as the quality gate: a city
// needs enough of these to be worth an itinerary at all.
//
// Deliberately narrower than poiDb's set of the same name, which also admits
// bars and clubs as stops. Nightlife must not help a city pass this gate —
// somewhere with two monuments and thirty bars is not a destination.
export const STOP_CATEGORIES = new Set(["museum", "landmark", "attraction", "viewpoint", "park", "shopping"]);

// our category → the coarse `tags` the app filters on
export const CATEGORY_TAGS = {
  museum: ["culture"], landmark: ["culture"], attraction: ["culture", "family"],
  viewpoint: ["nature"], park: ["nature", "family"],
  restaurant: ["food"], cafe: ["food"], bar: ["nightlife"], nightclub: ["nightlife"],
  livemusic: ["nightlife"], casino: ["nightlife"],
  shopping: ["shopping"],
};

// Baseline for a small city — how many of each category survive.
export const CATEGORY_CAP = {
  museum: 8, landmark: 12, attraction: 8, viewpoint: 4, park: 6,
  restaurant: 12, cafe: 8, bar: 6, nightclub: 4, livemusic: 3, casino: 2, shopping: 4,
};

// Food is deliberately NOT scaled. Restaurants and cafés never become stops —
// buildDest turns them into `food`, of which only six are ever shown — so a
// bigger pool in Paris buys nothing but bytes.
const UNSCALED = new Set(["restaurant", "cafe"]);

// How much more a bigger city gets. Measured motivation: at the flat baseline,
// 78–96% of cities were hitting the cap in every major category, so the limit —
// not OpenStreetMap — was what routes were short of. Paris genuinely has more
// than eight museums worth seeing; a market town genuinely does not, and giving
// it a bigger allowance would only pad its file with whatever ranked ninth.
export const TIER_SCALE = { mega: 2.5, major: 1.8, notable: 1.3, hidden: 1 };

export function capsFor(tier) {
  const scale = TIER_SCALE[tier] || 1;
  const out = {};
  for (const k in CATEGORY_CAP) {
    out[k] = UNSCALED.has(k) ? CATEGORY_CAP[k] : Math.round(CATEGORY_CAP[k] * scale);
  }
  return out;
}

// How far out a place to eat or drink still counts as central. Used to RANK,
// not to exclude: a hard cutoff proved brittle, because a city's Wikidata point
// is not always its tourist centre — Amman's nearest restaurant sits 2,013 m
// out against a 2,000 m limit, and ten cities lost their entire food list to
// margins that small. Ranking by distance keeps the central ones when there are
// central ones, and still leaves something when there are not.
//
// Sightseeing is never distance-penalised: Versailles is not central and is
// still the reason you went.
export const CENTRE_RADIUS = { mega: 2500, major: 2000, notable: 1500, hidden: 1200 };

export function buildOverpassQuery([lat, lon], radius, timeout = 45) {
  const a = `(around:${radius},${lat},${lon})`;
  return `
[out:json][timeout:${timeout}];
(
  node[tourism~"^(museum|gallery|attraction|artwork|viewpoint|theme_park|zoo)$"]${a};
  way[tourism~"^(museum|gallery|attraction|theme_park|zoo)$"]${a};
  node[historic][name]${a};
  way[historic][name]${a};
  node[amenity="place_of_worship"][name][wikidata]${a};
  node[leisure~"^(park|garden)$"][name]${a};
  way[leisure~"^(park|garden)$"][name]${a};
  node[amenity~"^(restaurant|cafe|bar|pub|biergarten|nightclub|music_venue|marketplace)$"][name]${a};
  node[leisure="dance"][name]${a};
  node[shop~"^(mall|department_store)$"][name]${a};
);
out center tags;`.trim();
}

// Great-circle distance in metres.
export function metres(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad, dLon = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Places you go out to, as opposed to places you travel to see.
const VENUE = new Set(["bar", "nightclub", "livemusic", "restaurant", "cafe"]);

// Drop stops that sit nearer some other city in the index than to this one.
//
// Only asked at a wide radius (scripts/retry-barren.mjs goes out to 20 km for
// cities the 5 km question wrote off as barren), where a query stops being
// about one city: 20 km from Suez reaches other towns, and their sights would
// otherwise be listed as Suez's. `others` is the rest of the index; the caller
// may pre-filter it to a bounding box, this only decides ownership.
export function ownedByNearestCity(pois, city, others) {
  if (!others.length) return { kept: pois, annexed: [] };
  const kept = [];
  const annexed = [];
  for (const p of pois) {
    const mine = metres(city.ll, p.ll);
    // The NEAREST rival, not the first one the array happens to hold — the log
    // line names it, and naming an arbitrary one is a way to be wrong quietly.
    let thief = null;
    let best = mine;
    for (const o of others) {
      const d = metres(o.ll, p.ll);
      if (d < best) { best = d; thief = o; }
    }
    if (thief) annexed.push({ name: p.name, to: thief.n });
    else kept.push(p);
  }
  return { kept, annexed };
}

// Normalize + rank + cap raw Overpass elements into our POI list.
// `tier` ("mega" | "major" | "notable" | "hidden") sets how generous the caps
// are; omitting it falls back to the small-city baseline.
export function curateElements(elements, tier, centre) {
  const seen = new Set();
  const pois = [];
  for (const el of elements || []) {
    const t = el.tags || {};
    // Readability order: Romanian, then English, then international, then the
    // local default. Without this, Chinese/Arabic/Cyrillic cities produce
    // itineraries most users literally cannot read (Chongqing was 98%
    // Han-script names). name:en also matches Wikipedia photo lookups better.
    const name = t["name:ro"] || t["name:en"] || t.int_name || t.name;
    if (!name || name.length < 2) continue;
    const cat = categorize(t);
    if (!cat) continue;
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;
    const dkey = name.toLowerCase();
    if (seen.has(dkey)) continue; // OSM often has node + way for the same place
    seen.add(dkey);
    // Readability policy for names with no Latin script at all (no name:en in
    // OSM): food/drink picks are useless if the user can't read them — drop;
    // sights keep the local name (worth showing to a taxi driver / matching
    // signage) but rank below readable ones.
    const latin = /[A-Za-z]/.test(name);
    const UNREADABLE_IS_USELESS = new Set([
      "restaurant", "cafe", "shopping",
      "bar", "nightclub", "livemusic", "casino",
    ]);
    if (!latin && UNREADABLE_IS_USELESS.has(cat)) continue;
    const notable = (t.wikidata ? 3 : 0) + (t.wikipedia ? 2 : 0) + (t.website ? 1 : 0);
    pois.push({
      name,
      category: cat,
      tags: CATEGORY_TAGS[cat] || ["culture"],
      ll: [+(+lat).toFixed(5), +(+lon).toFixed(5)],
      wiki: t.wikipedia ? t.wikipedia.replace(/^[a-z]{2,3}:/, "") : undefined,
      wikidata: t.wikidata || undefined,
      hours: t.opening_hours || undefined,
      website: t.website || undefined,
      cuisine: t.cuisine || undefined,
      // Entry price signals, when mapped: fee=yes/no, charge="5 EUR".
      // Used by poiDb to show a real price instead of a category estimate.
      fee: t.fee === "yes" || t.fee === "no" ? t.fee : undefined,
      charge: t.charge || undefined,
      // Venues are ranked by how central they are, so the per-category cap
      // keeps the ones a visitor would actually walk to. Beyond the centre
      // radius the penalty grows with distance, which is enough to sink an
      // out-of-town bar below every central one without ever excluding it —
      // a city whose reference point is slightly off still gets a food list.
      _score: notable * 10 + Object.keys(t).length - (latin ? 0 : 15)
        - (VENUE.has(cat) && centre
          ? Math.max(0, metres(centre, [+lat, +lon]) - (CENTRE_RADIUS[tier] || 1500)) / 100
          : 0),
    });
  }
  pois.sort((a, b) => b._score - a._score);
  const caps = capsFor(tier);
  const perCat = {};
  const kept = [];
  for (const p of pois) {
    const cap = caps[p.category] || 5;
    perCat[p.category] = (perCat[p.category] || 0);
    if (perCat[p.category] >= cap) continue;
    perCat[p.category]++;
    delete p._score;
    kept.push(p);
  }
  return kept;
}
