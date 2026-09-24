// The 5000-city index, native edition.
//
// Same behaviour as the web module (src/destinations.js) with one deliberate
// difference: the JSON is a static require instead of a dynamic import, because
// Metro resolves requires at build time and has no lazy module loading. The
// file ships inside the bundle, which is what we want — searching for a city
// must work with no network.

import DATA from "../data/destinations.json";
import { selectCitiesInBounds } from "../shared/cityBounds.js";
import { searchLocal } from "../shared/citySearch.js";

// Everything about matching a typed name to a city — the alias table included
// — lives in a module shared byte-for-byte with the web app. It existed twice
// before, which is how "Viena" could work on one platform and not the other.
export function searchDestinations(q, n = 8) {
  return searchLocal(DATA, q, n);
}

export { nameMatchesCity } from "../shared/citySearch.js";

// Rails for the Home screen. A fresh shuffle each call keeps the feed alive.
function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
export function getTrending(n = 6) {
  return shuffle(DATA.filter((d) => d.t === "mega" || d.t === "major")).slice(0, n);
}
export function getHiddenGems(n = 6) {
  return shuffle(DATA.filter((d) => d.t === "notable" && (d.p || 0) < 60000)).slice(0, n);
}
export function getEuropeWeekend(n = 6) {
  return shuffle(DATA.filter((d) => d.co === "EU" && (d.t === "mega" || d.t === "major"))).slice(0, n);
}

// ---- map exploration -------------------------------------------------------
// Cities inside the visible rectangle, most recognisable first.
//
// The web app asks Supabase for this. Here the whole index is already in
// memory, so it is a filter: no network, no latency, and — unlike the web —
// nothing that can be unreachable. The rules for what a viewport contains and
// what is worth drawing at a given zoom come from a module shared byte-for-byte
// with the web app, so the same pan shows the same cities on both.
//
// Async only for signature parity with the web module, so a screen written
// against one works against the other.
export async function getCitiesInBounds(bounds, opts) {
  return selectCitiesInBounds(DATA, bounds, opts);
}
