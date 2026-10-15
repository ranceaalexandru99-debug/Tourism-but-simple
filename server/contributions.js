// Validating a POI contribution before it reaches the shared database.
//
// /api/contribute-pois takes objectives from any client, with no account and no
// token, because that is what makes it useful: the first person to open a city
// the crawler never reached hands the result to everyone after them. It is also
// the only unauthenticated write in the app, so what it accepts is the whole of
// its security.
//
// This lived inline in the endpoint, below `if (!admin) return 503`. Since the
// tests run with no Supabase credentials, every request in them stopped at that
// line and not one of these rules was ever exercised. That is the reason it is
// a module.
//
// Two rules were missing from the inline version:
//
//   PROXIMITY. The endpoint checked that cityId named a real city and never
//   that the objectives were anywhere near it. Six entries with valid
//   coordinates in the middle of the Pacific, or at one chosen street address,
//   were a legitimate contribution for Paris. A contribution comes from
//   osmLive.js, which asks within 4.5 km of the centre, so anything beyond
//   30 km did not come from the app.
//
//   URL SCHEME. `website` was stored as any string up to 300 characters and is
//   shown to users as "Site: …". It is rendered as plain text on both
//   platforms, so a javascript: URL is not clickable and this is not a hole —
//   but attacker-controlled text presented beside a real place is a phishing
//   line, and http(s) is the only thing a website field means.

// Great-circle distance in metres. Same formula as src/osmCurate.js.
export function metres(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad, dLon = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Beyond this, it did not come from this app. osmLive.js queries at most 4.5 km
// from the city centre; the batch crawler goes to 5 km and its barren-retry to
// 20 km. Thirty is generous enough never to reject a real contribution.
export const MAX_DISTANCE_M = 30000;

export const MIN_POIS = 6;
export const MAX_POIS = 200;

// The categories the app can actually do something with. Matches
// STOP_CATEGORIES in src/shared/poiDest.js plus the two food ones — including
// the nightlife three, which the inline version left out, so a contributed city
// silently arrived with no bars, no clubs and no live music while "nightlife"
// stayed a selectable interest.
export const CATEGORIES = new Set([
  "museum", "landmark", "attraction", "viewpoint", "park", "shopping",
  "bar", "nightclub", "livemusic", "casino",
  "restaurant", "cafe",
]);

const httpUrl = (v) => {
  if (typeof v !== "string") return undefined;
  const s = v.trim().slice(0, 300);
  return /^https?:\/\/[^\s]+$/i.test(s) ? s : undefined;
};

const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : undefined);

/**
 * Keep only fields the app reads, with the shapes it expects, for objectives
 * that are plausibly in the city named.
 *
 * `centre` is [lat, lon] from the cities row, or null to skip the proximity
 * rule — which no caller should do, and which exists so a city row without
 * coordinates fails open rather than rejecting everything.
 *
 * Returns { pois, dropped } where `dropped` counts what was thrown away, so the
 * caller can tell a thin contribution from a suspicious one.
 */
export function sanitizePois(pois, centre) {
  const clean = [];
  const reasons = { shape: 0, category: 0, coords: 0, distance: 0 };

  for (const p of Array.isArray(pois) ? pois : []) {
    if (!p || typeof p.name !== "string") { reasons.shape++; continue; }
    const name = p.name.trim().slice(0, 120);
    if (name.length < 2) { reasons.shape++; continue; }
    if (!CATEGORIES.has(p.category)) { reasons.category++; continue; }

    const [lat, lon] = Array.isArray(p.ll) ? p.ll : [];
    if (typeof lat !== "number" || typeof lon !== "number"
      || !Number.isFinite(lat) || !Number.isFinite(lon)
      || Math.abs(lat) > 90 || Math.abs(lon) > 180) { reasons.coords++; continue; }

    if (centre && metres(centre, [lat, lon]) > MAX_DISTANCE_M) { reasons.distance++; continue; }

    clean.push({
      name,
      category: p.category,
      tags: Array.isArray(p.tags) ? p.tags.slice(0, 4).filter((t) => typeof t === "string") : [],
      ll: [lat, lon],
      wiki: str(p.wiki, 200),
      hours: str(p.hours, 200),
      website: httpUrl(p.website),
      img: str(p.img, 300),
    });
  }

  return { pois: clean, dropped: reasons };
}

export const isCityId = (v) => typeof v === "string" && /^Q\d+$/.test(v);
