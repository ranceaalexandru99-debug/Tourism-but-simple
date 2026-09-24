// Where the explore map was left, and what crosses into it.
//
// Extracted from the screen so it can be tested: the stored viewport comes off
// the device and can be anything, and the projection decides how much data
// crosses the React Native bridge on every single pan.

export const VIEW_KEY = "vai_explore_view";
export const DEFAULT_VIEW = { center: [46.5, 14.0], zoom: 4 };

const finite = (n) => typeof n === "number" && Number.isFinite(n);

// A viewport worth restoring. `[45]` passes an Array.isArray check and then
// opens the map on grey nothing, so the length and the contents both count.
export function isView(v) {
  return !!v
    && Array.isArray(v.center) && v.center.length === 2 && v.center.every(finite)
    && finite(v.zoom);
}

// Reopening Explore continues the same journey instead of snapping back to a
// default view of Europe. Anything unreadable falls back rather than throwing:
// storage can hold a half-written value, or one from an older version.
export function loadView(storage) {
  try {
    const v = JSON.parse(storage.getItem(VIEW_KEY));
    if (isView(v)) return { center: [v.center[0], v.center[1]], zoom: v.zoom };
  } catch { /* corrupt or absent — fall through */ }
  return DEFAULT_VIEW;
}

// Returns whether it stuck. A full device is not worth interrupting anyone
// over — the map still works, it just won't be remembered — but the caller
// should be able to tell.
export function saveView(storage, view) {
  if (!isView(view)) return false;
  try {
    storage.setItem(VIEW_KEY, JSON.stringify({ center: view.center, zoom: view.zoom }));
    return true;
  } catch { return false; }
}

// What the map page actually needs to draw a dot. The full record also carries
// a name, a country, a population and a photo filename, none of which the page
// uses — and this crosses the bridge on every pan, up to 120 at a time.
export function forMap(city) {
  return { id: city.id, ll: city.ll, t: city.t, r: city.r };
}
