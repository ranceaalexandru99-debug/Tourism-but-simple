// Encoding/decoding of shared trips carried in the URL hash. Pure functions
// (no window access) so they can be unit-tested and reused.
//
// `#tripz=<lz-string>` is the compact format (default); `#trip=<base64>` is the
// older uncompressed format still accepted for backwards-compat.

import LZString from "lz-string";

// How much decompressed JSON is worth looking at, and how big a trip can be.
//
// Measured: a 139 KB link decompresses to a 17 MB object — LZString reaches
// about 128x on repetitive content — and the old check accepted it, itinerary
// of 200,000 stops and all, which the route screen would then try to render.
// A link is something a stranger sends you, so the ceiling has to come BEFORE
// the parse, not after.
//
// The real thing for scale: the generator plans 3–5 stops a day, so these are
// several times any genuine trip.
export const MAX_PAYLOAD_CHARS = 256 * 1024;
export const MAX_DAYS = 31;
export const MAX_STOPS_PER_DAY = 40;
export const MAX_STOPS_TOTAL = 400;
const MAX_TEXT = 200;

// A string that is present, non-empty and not absurd.
const text = (v, max = MAX_TEXT) => typeof v === "string" && v.length > 0 && v.length <= max;
// A field that may be absent, but must be sane when it is there.
const optionalText = (v, max = MAX_TEXT) => v === undefined || v === null || (typeof v === "string" && v.length <= max);

// Every field the route screen actually reads. `name` is the one that matters
// most: React throws outright on an object where it expects a child, so a stop
// whose name is `{}` took the whole app to the error boundary — the same way a
// missing budget once did.
function isStopValid(s) {
  if (!s || typeof s !== "object" || Array.isArray(s)) return false;
  if (!text(s.name, 120)) return false;
  for (const f of ["emoji", "time", "durLabel", "hours", "tip", "wiki"]) {
    if (!optionalText(s[f])) return false;
  }
  if (s.cost !== undefined && s.cost !== null && !Number.isFinite(s.cost)) return false;
  if (s.ll !== undefined && s.ll !== null) {
    if (!Array.isArray(s.ll) || s.ll.length !== 2) return false;
    if (!s.ll.every((n) => typeof n === "number" && Number.isFinite(n))) return false;
  }
  if (s.tags !== undefined && s.tags !== null && !Array.isArray(s.tags)) return false;
  return true;
}

// A shared trip arrives as untrusted data in the URL. Before we trust it enough
// to render, check its shape AND its size: it must look like a real route
// object, with an itinerary small enough to belong to a holiday rather than to
// somebody having fun with a link.
export function isSharedRouteValid(r) {
  if (!r || typeof r !== "object" || Array.isArray(r)) return false;
  if (!text(r.destName, 80) || !r.destName.trim()) return false;
  if (!Number.isFinite(r.days) || r.days < 1 || r.days > MAX_DAYS) return false;
  if (!Array.isArray(r.itinerary) || r.itinerary.length === 0) return false;
  if (r.itinerary.length > MAX_DAYS) return false;
  // BudgetCard reads budget.tickets/food/transport/total unconditionally, so a
  // payload without a numeric budget threw right through to the root
  // ErrorBoundary — a truncated share link took down the whole app.
  if (!r.budget || typeof r.budget !== "object" || !Number.isFinite(r.budget.total)) return false;

  let total = 0;
  for (const day of r.itinerary) {
    if (!day || typeof day !== "object" || Array.isArray(day)) return false;
    if (!Array.isArray(day.stops)) return false;
    if (day.stops.length > MAX_STOPS_PER_DAY) return false;
    total += day.stops.length;
    if (total > MAX_STOPS_TOTAL) return false;
    if (!day.stops.every(isStopValid)) return false;
  }
  return true;
}

// Decode a location.hash string into a validated route, or null.
export function decodeSharedRouteFromHash(hash) {
  let parsed = null;
  try {
    let json = null;
    const z = (hash || "").match(/^#tripz=(.+)$/);
    if (z) json = LZString.decompressFromEncodedURIComponent(z[1]);
    else {
      const b = (hash || "").match(/^#trip=(.+)$/);
      if (b) {
        const b64 = b[1].replace(/-/g, "+").replace(/_/g, "/");
        json = decodeURIComponent(escape(atob(b64)));
      }
    }
    if (typeof json !== "string") return null;
    // The ceiling goes here, before JSON.parse: parsing is where a compressed
    // 139 KB link becomes 17 MB of live objects, and no amount of checking
    // afterwards gives that memory back.
    if (json.length > MAX_PAYLOAD_CHARS) return null;
    parsed = JSON.parse(json);
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
