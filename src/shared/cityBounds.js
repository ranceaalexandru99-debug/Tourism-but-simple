// Which cities belong on the map right now.
//
// Shared byte-for-byte with mobile-native/src/shared/cityBounds.js. The two
// platforms fetch differently — the web asks Supabase for a bounding box, the
// phone filters the 5000-city index that ships inside the bundle — but the
// RULES about what a viewport contains and what is worth drawing at a given
// zoom have to be the same, or the same pan shows two different worlds.

// Which tiers are worth drawing at a given zoom. Rendering all 5000 cities at
// world zoom would be both unreadable and slow, so the map shows only the
// recognisable ones when zoomed out and fills in the smaller places as the user
// closes in — the same way paper atlases label by scale.
export function tiersForZoom(zoom) {
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

// True when `bounds` looks like a viewport we can actually use. A NaN here
// would otherwise sail through every comparison as false and quietly empty the
// map, which reads exactly like "there is nothing here".
export function usableBounds(bounds) {
  if (!bounds) return false;
  const { south, west, north, east } = bounds;
  return [south, west, north, east].every((v) => typeof v === "number" && !Number.isNaN(v));
}

/**
 * Pick the cities inside a viewport from a list already in memory.
 *
 * This is the phone's half of the job: the index is bundled, so there is no
 * query to make and no failure mode beyond "nothing is there". The web half
 * pushes the same rules down into SQL.
 *
 * @param cities  the full index; each entry needs `ll` ([lat, lon]), `t`, `r`
 * @param bounds  { south, west, north, east } in degrees
 */
export function selectCitiesInBounds(cities, bounds, { zoom = 6, limit = 120 } = {}) {
  if (!Array.isArray(cities) || !usableBounds(bounds)) return [];
  const { south, west, north, east } = bounds;

  const tiers = tiersForZoom(zoom);
  const ranges = lonRanges(west, east);
  const inLon = (lon) => ranges.some(([w, e]) => lon >= w && lon <= e);

  const hits = [];
  for (const city of cities) {
    const ll = city && city.ll;
    if (!Array.isArray(ll) || ll.length !== 2) continue;
    const [lat, lon] = ll;
    if (lat < south || lat > north) continue;
    if (!inLon(lon)) continue;
    if (!tiers.includes(city.t)) continue;
    hits.push(city);
  }

  // Most recognisable first, so the 120-item cut keeps Paris and drops the
  // village next to it rather than the other way round.
  hits.sort((a, b) => (b.r || 0) - (a.r || 0));
  return hits.slice(0, limit);
}
