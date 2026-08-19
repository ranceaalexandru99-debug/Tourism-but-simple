// SYNCED from ../../../src/ by scripts/sync-native-data.mjs — do not edit here.
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
  if (t.amenity === "bar" || t.amenity === "pub" || t.amenity === "biergarten") return "bar";
  if (t.shop === "mall" || t.shop === "department_store" || t.amenity === "marketplace") return "shopping";
  return null;
}

// Categories that become itinerary stops (vs. food/drink suggestions).
export const STOP_CATEGORIES = new Set(["museum", "landmark", "attraction", "viewpoint", "park", "shopping"]);

// our category → the coarse `tags` the app filters on
export const CATEGORY_TAGS = {
  museum: ["culture"], landmark: ["culture"], attraction: ["culture", "family"],
  viewpoint: ["nature"], park: ["nature", "family"],
  restaurant: ["food"], cafe: ["food"], bar: ["nightlife"],
  shopping: ["shopping"],
};

// balanced final set — how many of each category survive
export const CATEGORY_CAP = {
  museum: 8, landmark: 12, attraction: 8, viewpoint: 4, park: 6,
  restaurant: 12, cafe: 8, bar: 6, shopping: 4,
};

// The Overpass QL query for one city center.
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
  node[amenity~"^(restaurant|cafe|bar|pub|biergarten|marketplace)$"][name]${a};
  node[shop~"^(mall|department_store)$"][name]${a};
);
out center tags;`.trim();
}

// Normalize + rank + cap raw Overpass elements into our POI list.
export function curateElements(elements) {
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
    if (!latin && (cat === "restaurant" || cat === "cafe" || cat === "bar" || cat === "shopping")) continue;
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
      _score: notable * 10 + Object.keys(t).length - (latin ? 0 : 15),
    });
  }
  pois.sort((a, b) => b._score - a._score);
  const perCat = {};
  const kept = [];
  for (const p of pois) {
    const cap = CATEGORY_CAP[p.category] || 5;
    perCat[p.category] = (perCat[p.category] || 0);
    if (perCat[p.category] >= cap) continue;
    perCat[p.category]++;
    delete p._score;
    kept.push(p);
  }
  return kept;
}
