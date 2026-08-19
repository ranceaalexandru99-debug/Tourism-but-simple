// Encoding/decoding of shared trips carried in the URL hash. Pure functions
// (no window access) so they can be unit-tested and reused.
//
// `#tripz=<lz-string>` is the compact format (default); `#trip=<base64>` is the
// older uncompressed format still accepted for backwards-compat.

import LZString from "lz-string";

// A shared trip arrives as untrusted data in the URL. Before we trust it enough
// to render, sanity-check its shape: it must look like a real route object with
// a non-empty itinerary of days that each hold a stops array. This rejects
// malformed, truncated, or hand-crafted payloads instead of letting them crash
// the route screen (or smuggle in unexpected fields).
export function isSharedRouteValid(r) {
  if (!r || typeof r !== "object" || Array.isArray(r)) return false;
  if (typeof r.destName !== "string" || !r.destName.trim()) return false;
  if (!Number.isFinite(r.days) || r.days < 1 || r.days > 31) return false;
  if (!Array.isArray(r.itinerary) || r.itinerary.length === 0) return false;
  // BudgetCard reads budget.tickets/food/transport/total unconditionally, so a
  // payload without a numeric budget threw right through to the root
  // ErrorBoundary — a truncated share link took down the whole app.
  if (!r.budget || typeof r.budget !== "object" || !Number.isFinite(r.budget.total)) return false;
  return r.itinerary.every(
    (day) => day && typeof day === "object" && Array.isArray(day.stops)
  );
}

// Decode a location.hash string into a validated route, or null.
export function decodeSharedRouteFromHash(hash) {
  let parsed = null;
  try {
    const z = (hash || "").match(/^#tripz=(.+)$/);
    if (z) parsed = JSON.parse(LZString.decompressFromEncodedURIComponent(z[1]));
    else {
      const b = (hash || "").match(/^#trip=(.+)$/);
      if (b) {
        const b64 = b[1].replace(/-/g, "+").replace(/_/g, "/");
        parsed = JSON.parse(decodeURIComponent(escape(atob(b64))));
      }
    }
  } catch { return null; }
  return isSharedRouteValid(parsed) ? parsed : null;
}

// Strip personal state before a trip leaves the device: private notes, visited
// checkmarks and star ratings are yours, not part of the itinerary a recipient
// should receive. Also drops transient AI-engine flags. Bonus: smaller QR codes.
export function sanitizeRouteForShare(route) {
  const { _ai, _aiFailed, ...r } = route || {};
  return {
    ...r,
    itinerary: (r.itinerary || []).map((day) => ({
      ...day,
      stops: (day.stops || []).map(({ note, done, rating, ...stop }) => stop),
    })),
  };
}

// Compress a route into the `#tripz=` hash payload (no origin — callers prefix
// their own URL). Mirrors ShareSheet's buildShareUrl encoding.
export function encodeTripHash(route) {
  return "#tripz=" + LZString.compressToEncodedURIComponent(JSON.stringify(route));
}
