// Tier 2.5 — live OpenStreetMap objectives, native edition.
//
// The logic is in shared/osmLive.js, byte-for-byte with the web app's copy.
// What is here is what a phone answers differently.
//
// THE USER AGENT. React Native's networking on Android identifies itself as
// okhttp. Overpass runs on donated capacity and its usage policy asks clients
// to identify themselves; a browser cannot comply, because it sends its own
// agent and forbids overriding it, so the web app sends nothing. A phone can,
// and should. Deliberately no email address, for the reason userAgent.js gives:
// a request header is not the place for one.
//
// THE CONTRIBUTION ENDPOINT. The web app offers a freshly fetched city back to
// the shared database at a relative URL, which resolves against the page's own
// origin. A phone has no origin, so a relative URL goes nowhere — this passes
// the configured absolute base, or nothing at all, which skips contributing.
// `extra.apiBase` in app.json, the same shape monitor.js uses for its error
// endpoint, and empty until there is a server to point it at.
//
// Data © OpenStreetMap contributors (ODbL).

import Constants from "expo-constants";
import { fetchCityPoisLive as fetchShared } from "../shared/osmLive.js";
import { USER_AGENT } from "./userAgent.js";

export { OSM_BUDGET_MS, MIN_ATTEMPT_MS } from "../shared/osmLive.js";

const API_BASE = Constants.expoConfig?.extra?.apiBase || undefined;

export function fetchCityPoisLive(city) {
  return fetchShared(city, {
    headers: { "User-Agent": USER_AGENT },
    apiBase: API_BASE,
  });
}
