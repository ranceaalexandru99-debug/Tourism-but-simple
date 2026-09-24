// Reading what a WebView map sends back.
//
// Both map pages are ours, but what arrives here is a string from a browser
// engine, and it is untrusted input for the same reason every other message in
// this app is: the page renders user content, a future version of it may send
// something this build does not expect, and a handler that throws inside
// onMessage takes the screen with it.
//
// So this parses defensively and returns either a message this app understands,
// with its fields already checked, or null. There is no third outcome and
// nothing throws.

// Latitude/longitude that a map could actually be showing.
const isLat = (n) => typeof n === "number" && Number.isFinite(n) && n >= -90 && n <= 90;
const isLon = (n) => typeof n === "number" && Number.isFinite(n) && n >= -180 && n <= 180;

// Leaflet reports longitudes outside [-180, 180] once the user pans past the
// date line — that is normal and the bounds handling relies on it — so only the
// latitudes are range-checked here.
function readBounds(b) {
  if (!b || typeof b !== "object") return null;
  const { south, west, north, east } = b;
  if (!isLat(south) || !isLat(north)) return null;
  if (![west, east].every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  if (south > north) return null;
  return { south, west, north, east };
}

/**
 * @param   {string} raw  event.nativeEvent.data
 * @returns one of
 *          { type: "view",  bounds, center, zoom }
 *          { type: "pick",  id }
 *          { type: "ready", pins }
 *          { type: "error", reason }
 *          or null when the message is unusable
 */
export function readMapMessage(raw) {
  let msg;
  try { msg = JSON.parse(raw); } catch { return null; }
  if (!msg || typeof msg !== "object" || Array.isArray(msg)) return null;

  if (msg.type === "view") {
    const bounds = readBounds(msg.bounds);
    if (!bounds) return null;
    if (typeof msg.zoom !== "number" || !Number.isFinite(msg.zoom)) return null;
    // The centre is only used to remember where the user was, so a missing or
    // malformed one is not worth discarding the viewport over.
    const c = msg.center;
    const center = Array.isArray(c) && c.length === 2 && isLat(c[0]) && isLon(c[1]) ? [c[0], c[1]] : null;
    return { type: "view", bounds, center, zoom: msg.zoom };
  }

  if (msg.type === "pick") {
    // The id is looked up in a list we own, so an unknown one finds nothing —
    // but it has to be a string, or `find` could match on a surprising value.
    if (typeof msg.id !== "string" || !msg.id) return null;
    return { type: "pick", id: msg.id };
  }

  if (msg.type === "ready") {
    return { type: "ready", pins: typeof msg.pins === "number" ? msg.pins : null };
  }

  if (msg.type === "error") {
    return { type: "error", reason: typeof msg.reason === "string" ? msg.reason : "" };
  }

  return null;
}
