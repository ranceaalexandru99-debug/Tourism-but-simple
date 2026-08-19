// Tier 1.5 — live OpenStreetMap POIs for cities WITHOUT a pre-generated file.
//
// When a searched city exists in the 5000-city index but has no
// public/pois/{qid}.json, we query Overpass directly from the browser, curate
// with the exact same rules as the batch script (shared src/osmCurate.js), and
// cache the result in localStorage. Net effect: ANY of the 5000 cities gets
// real places on first request (~5-20s, behind the loading screen), instantly
// afterwards — no AI hallucination, no backend.
//
// Falls back cleanly: on timeout/failure the caller continues to the AI/mock
// tier, so the user always gets a route.
//
// Data © OpenStreetMap contributors (ODbL).

import { buildOverpassQuery, curateElements } from "./osmCurate.js";

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

// localStorage cache, LRU-capped: ~12 KB per city, 30 cities ≈ 360 KB max.
const CACHE_PREFIX = "vai_osm_city_";
const LRU_KEY = "vai_osm_city_index";
const LRU_MAX = 30;

function cacheGet(qid) {
  try { const raw = localStorage.getItem(CACHE_PREFIX + qid); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function cachePut(qid, payload) {
  try {
    localStorage.setItem(CACHE_PREFIX + qid, JSON.stringify(payload));
    let idx;
    try { idx = JSON.parse(localStorage.getItem(LRU_KEY)) || []; } catch { idx = []; }
    const at = idx.indexOf(qid);
    if (at !== -1) idx.splice(at, 1);
    idx.push(qid);
    if (idx.length > LRU_MAX) {
      for (const old of idx.splice(0, idx.length - LRU_MAX)) {
        try { localStorage.removeItem(CACHE_PREFIX + old); } catch {}
      }
    }
    localStorage.setItem(LRU_KEY, JSON.stringify(idx));
  } catch { /* quota — the fetch still worked, just uncached */ }
}

async function overpassOnce(endpoint, query, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "data=" + encodeURIComponent(query),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return (await res.json()).elements || [];
  } catch {
    return null; // abort / network / CORS — caller tries the next combination
  } finally {
    clearTimeout(timer);
  }
}

// Fetch + curate live POIs for a destinations.json record ({id, n, ll, p}).
// Returns the same payload shape as a pre-generated file, or null.
export async function fetchCityPoisLive(city) {
  if (!city?.id || !city?.ll) return null;
  const cached = cacheGet(city.id);
  if (cached) return cached;

  // Big cities choke the 5 km query — start tighter the denser the city is.
  // Ladder: the main instance first (fast for typical user IPs), then the
  // mail.ru mirror (slower ~25s but reliably answers the full-radius query),
  // then kumi as a last resort with a small radius.
  const first = (city.p || 0) > 2_000_000 ? 3000 : 4500;
  const attempts = [
    { endpoint: ENDPOINTS[0], radius: first, timeoutMs: 20000 },
    { endpoint: ENDPOINTS[1], radius: first, timeoutMs: 30000 },
    { endpoint: ENDPOINTS[2], radius: 2200, timeoutMs: 15000 },
  ];

  for (const { endpoint, radius, timeoutMs } of attempts) {
    const elements = await overpassOnce(endpoint, buildOverpassQuery(city.ll, radius, Math.floor(timeoutMs / 1000)), timeoutMs);
    if (!elements) continue;
    const pois = curateElements(elements);
    if (pois.length >= 6) {
      const payload = {
        city: city.n,
        qid: city.id,
        source: "osm-live",
        attribution: "© OpenStreetMap contributors",
        generatedAt: new Date().toISOString().slice(0, 10),
        pois,
      };
      cachePut(city.id, payload);
      return payload;
    }
  }
  return null;
}
