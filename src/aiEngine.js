// Real AI route generation via the Claude API.
//
// This replaces the mock POI database with a live call to Claude, so the app
// can plan ANY destination in the world (not just the 5 hardcoded cities) and
// honour free-text requests. Claude returns destination data in the exact same
// shape as the local DB entries, which we then feed through assembleRoute() —
// so the rest of the app is unchanged.
//
// ⚠️ PROTOTYPE ONLY: this calls the Claude API directly from the browser with
// `dangerouslyAllowBrowser`, which exposes the API key to anyone using the app.
// In production, proxy this through a small backend (e.g. a serverless function)
// that holds the key server-side. The request/response shape stays the same.
//
// Set VITE_ANTHROPIC_API_KEY in a .env file to enable. Without it, the app
// transparently falls back to the mock engine.

import { assembleRoute, generateRoute, resolveDestination } from "./mockEngine.js";
import { getLang, LANG_NAME } from "./i18n.js";
import { searchDestinations, nameMatchesCity } from "./destinations.js";
import { loadCityPois, buildDest } from "./poiDb.js";
import { fetchCityPoisLive } from "./osmLive.js";

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

export const hasAI = () => Boolean(API_KEY);

// Lazy-load the SDK only when a key is configured, so the heavy dependency is
// never fetched (and the initial bundle stays small) when running on the mock.
let _client = null;
async function client() {
  if (!_client) {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    // 45s cap (SDK default is 10 MINUTES — a hung connection would trap the
    // user on the loading screen); no retry, the mock fallback is instant.
    _client = new Anthropic({ apiKey: API_KEY, dangerouslyAllowBrowser: true, timeout: 45000, maxRetries: 0 });
  }
  return _client;
}

// JSON schema for the destination Claude must return — mirrors a DESTINATIONS
// entry in mockEngine.js. Structured outputs guarantee it parses cleanly.
const DEST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    country: { type: "string" },
    emoji: { type: "string" },
    blurb: { type: "string" },
    center: { type: "array", items: { type: "number" } },
    pois: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          emoji: { type: "string" },
          tags: { type: "array", items: { type: "string", enum: ["culture", "food", "nature", "nightlife", "shopping", "family"] } },
          dur: { type: "number" },
          hours: { type: "string" },
          cost: { type: "number" },
          tip: { type: "string" },
          ll: { type: "array", items: { type: "number" } },
        },
        required: ["name", "emoji", "tags", "dur", "hours", "cost", "tip", "ll"],
      },
    },
    food: { type: "array", items: { type: "string" } },
    transport: { type: "string" },
  },
  required: ["name", "country", "emoji", "blurb", "center", "pois", "food", "transport"],
};

const INTEREST_LABELS = {
  culture: "cultură/istorie", food: "gastronomie", nature: "natură",
  nightlife: "viață de noapte", shopping: "shopping", family: "activități de familie",
};

function buildPrompt(prefs) {
  const interests = (prefs.interests || []).map((i) => INTEREST_LABELS[i] || i).join(", ") || "variat";
  const flex = prefs.days === "flex";
  const days = flex ? 4 : Math.max(1, Math.min(7, Number(prefs.days) || 2));
  const nPois = flex ? 16 : Math.min(32, Math.max(8, days * 4));
  const lines = [
    `Destinație cerută de utilizator: "${prefs.destination}".`,
    `Număr de zile: ${flex ? "flexibil" : days}.`,
    `Interese principale: ${interests}.`,
    `Ritm preferat: ${prefs.pace || "balanced"}.`,
  ];
  if (prefs.instruction) lines.push(`Cerere suplimentară de la utilizator: "${prefs.instruction}".`);
  const langName = LANG_NAME[getLang()] || "English";
  lines.push(
    "",
    `Generează datele pentru această destinație: ${nPois} obiective turistice reale,`,
    "cu coordonate GPS corecte [lat, lng], durată recomandată în minute,",
    "program de vizitare, cost bilet în EUR (0 dacă e gratuit) și un sfat local util.",
    "Pune accent pe obiectivele care se potrivesc cu interesele de mai sus.",
    "Include 4 recomandări de mâncare locală și o notă scurtă despre transport.",
    `Write ALL text fields (name, blurb, tip, hours, food, transport, country) in ${langName}. Tips should sound like advice from a local.`,
  );
  return lines.join("\n");
}

// Cache the AI-generated destination data so we don't re-call Claude for the
// same place. Keyed by destination + interests + free-text request (the things
// that change which POIs come back); days/pace/dates/budget only affect local
// assembly, so changing them reuses the cache instantly.
function cacheKey(prefs) {
  const dest = (prefs.destination || "").trim().toLowerCase();
  const ints = [...(prefs.interests || [])].sort().join(",");
  const instr = (prefs.instruction || "").trim().toLowerCase();
  return `vai_ai_dest_${dest}|${ints}|${instr}`;
}
function readCache(prefs) {
  try { const r = localStorage.getItem(cacheKey(prefs)); return r ? JSON.parse(r) : null; } catch { return null; }
}
function writeCache(prefs, dest) {
  try { localStorage.setItem(cacheKey(prefs), JSON.stringify(dest)); } catch {}
}

// Calls Claude and returns a full route (same shape as generateRoute).
export async function generateRouteAI(prefs) {
  const cached = readCache(prefs);
  if (cached) return assembleRoute(cached, prefs);

  const c = await client();
  // Stream the response (recommended pattern — avoids HTTP timeouts) and take
  // the final assembled message.
  const stream = c.messages.stream({
    model: "claude-opus-4-8",
    // Up to 32 POIs, each with name/tags/hours/tip/coords, plus food and
    // transport — 4000 tokens truncated the JSON on richer cities, and a
    // truncated payload only surfaced later as a JSON.parse error.
    max_tokens: 8000,
    system:
      "Ești un expert în turism care creează itinerarii personalizate. " +
      "Răspunzi DOAR cu datele structurate cerute, în limba română, cu informații reale și precise.",
    output_config: { format: { type: "json_schema", schema: DEST_SCHEMA }, effort: "low" },
    messages: [{ role: "user", content: buildPrompt(prefs) }],
  });
  const message = await stream.finalMessage();

  // Hitting the token ceiling yields syntactically broken JSON; say so plainly
  // instead of letting JSON.parse throw a confusing SyntaxError.
  if (message.stop_reason === "max_tokens") throw new Error("Răspuns AI trunchiat (max_tokens)");
  const text = message.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("Răspuns AI gol");
  // key "ai" (not "custom") so the map renders; ll present on every POI.
  const dest = { key: "ai", ...JSON.parse(text) };

  writeCache(prefs, dest);
  return assembleRoute(dest, prefs);
}

// Tries the AI path when a key is configured; falls back to the mock engine on
// any error so the app always produces a route. The result is tagged so the UI
// can tell the user transparently when the AI call failed and we used the fast
// local engine instead:
//   _ai: true            → generated by Claude
//   _aiFailed: true      → a key is configured but the call failed (offer retry)
// (no flags when no key is configured — the mock is the intended path, no nag.)
export async function generateRouteSmart(prefs) {
  // Tier 0 — a hand-curated city in mockEngine's DB. Highest quality, use as-is.
  if (resolveDestination(prefs.destination).key !== "custom") {
    return generateRoute(prefs);
  }

  // Tier 1 — a pre-generated OpenStreetMap POI file for this city. Real places,
  // real coords, real opening hours — no AI, no hallucination.
  try {
    const osm = await tryOsmRoute(prefs);
    if (osm) return osm;
  } catch (e) {
    console.warn("[Turism] OSM tier failed, falling through:", e);
  }

  // Tier 2 — AI generation, or the generic custom fallback when no key is set.
  if (hasAI()) {
    try {
      const route = await generateRouteAI(prefs);
      return { ...route, _ai: true };
    } catch (e) {
      console.warn("[Turism] AI generation failed, using the local engine:", e);
      return { ...generateRoute(prefs), _aiFailed: true };
    }
  }
  return generateRoute(prefs);
}

// Resolve the typed destination to a curated OSM city file and assemble a
// route from it. Returns null if there's no matching city or no POI file.
async function tryOsmRoute(prefs) {
  const head = (prefs.destination || "").split(",")[0].trim();
  if (head.length < 2) return null;
  // Try the whole head, then the first 1-2 words (the destination may carry
  // trailing modifiers like "Timișoara 2 zile").
  const words = head.split(/\s+/);
  const candidates = [head, words.slice(0, 2).join(" "), words[0]].filter((c, i, a) => c && a.indexOf(c) === i);

  let city = null;
  for (const cand of candidates) {
    const matches = await searchDestinations(cand, 1);
    const m = matches[0];
    // nameMatchesCity is alias-aware: "București"/"Londra"/"Wien" accept the
    // English-named record (Bucharest/London/Vienna) instead of falling to
    // the generic route.
    if (m && nameMatchesCity(cand, m)) { city = m; break; }
  }
  if (!city) return null;

  // Tier 1: pre-generated file. Tier 1.5: live Overpass fetch for any other
  // city in the index — real places on first request, cached locally after.
  let payload = await loadCityPois(city.id);
  if (!payload?.pois?.length) payload = await fetchCityPoisLive(city);
  if (!payload || !payload.pois?.length) return null;

  // Country ISO → name in the user's language (no per-language table).
  let country = city.c;
  try { country = new Intl.DisplayNames([getLang(), "en"], { type: "region" }).of(city.c) || city.c; } catch {}

  const dest = buildDest(
    { name: city.n, country, ll: city.ll, emoji: "📍", blurb: "" },
    payload,
  );
  // A payload can pass the ≥6-POI bar while being all cafés and restaurants —
  // buildDest then yields zero sightseeing stops, and assembleRoute would
  // happily produce an empty itinerary with a full budget attached. Fall
  // through to the next tier instead of shipping an empty trip.
  if (dest.pois.length < 3) return null;
  return { ...assembleRoute(dest, prefs), _osm: true };
}
