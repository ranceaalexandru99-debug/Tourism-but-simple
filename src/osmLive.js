// Tier 1.5 — live OpenStreetMap POIs, web edition.
//
// The whole of it moved to src/shared/osmLive.js so the native app could use
// it: until then, the 230 cities with no packed objectives got real places in
// a browser and the generic "Centrul istoric" itinerary on a phone.
//
// What stays here is the one thing a browser answers differently. No headers:
// a browser sends its own User-Agent and forbids overriding it, so passing one
// would be a request Chrome drops on the floor. An empty apiBase: contributions
// go to this origin, which is exactly what the serverless function expects.
//
// Data © OpenStreetMap contributors (ODbL).

import { fetchCityPoisLive as fetchShared } from "./shared/osmLive.js";

export { OSM_BUDGET_MS, MIN_ATTEMPT_MS } from "./shared/osmLive.js";

export function fetchCityPoisLive(city) {
  return fetchShared(city, { apiBase: import.meta.env.VITE_API_BASE || "" });
}
