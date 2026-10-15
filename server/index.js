// Minimal API server for AI route generation.
//
// Its whole reason to exist: the Anthropic key must never reach the browser.
// The client used to call Claude directly with `dangerouslyAllowBrowser`, which
// shipped VITE_ANTHROPIC_API_KEY to everyone who opened DevTools. Here the key
// is read from ANTHROPIC_API_KEY — deliberately WITHOUT the VITE_ prefix, so
// Vite can never inline it into the client bundle.
//
//   npm run server           # http://localhost:8787
//   POST /api/generate-route  { prefs, lang } → the destination JSON
//   GET  /api/health          { ok, ai }
//
// The prompt and schema come from src/shared/routeSchema.js, the same module
// the client imports, so the two sides cannot drift.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import {
  DEST_SCHEMA, MODEL, MAX_TOKENS, SYSTEM_PROMPT, buildPrompt, validatePrefs,
} from "../src/shared/routeSchema.js";
import { createRateLimiter, DEFAULT_MAX } from "./rateLimit.js";
import { appendCapped } from "./errorLog.js";
import { sanitizePois, isCityId, MIN_POIS, MAX_POIS } from "./contributions.js";

// Read .env by hand. This is a plain Node process, not a Vite one, so nothing
// loads it automatically — without this the server started perfectly happily
// and reported "AI DISABLED", with account deletion and POI contributions
// silently unauthenticated, even though the keys were sitting in the file.
//
// Real environment variables always win, so a hosting platform's own config
// (Vercel, Render, Fly) overrides the file rather than fighting it, and a
// missing .env in production is not an error.
function loadEnv() {
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  try {
    for (const line of fs.readFileSync(path.join(root, ".env"), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch { /* no .env — rely on the real environment */ }
}
loadEnv();

const PORT = Number(process.env.PORT) || 8787;
const API_KEY = process.env.ANTHROPIC_API_KEY;

// Supabase admin credentials. SUPABASE_SERVICE_ROLE_KEY bypasses Row Level
// Security completely — it must never be given a VITE_ prefix, never be sent to
// a browser, and never be logged. It exists here for exactly one operation:
// deleting the account of a caller who has proven who they are.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = SUPABASE_URL && SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;
// Comma-separated list of allowed browser origins for production. In dev the
// Vite proxy makes requests same-origin, so nothing is needed there.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",").map((s) => s.trim()).filter(Boolean);

const app = express();
app.disable("x-powered-by");

// Who is allowed to tell us the client's IP.
//
// The rate limiter used to read X-Forwarded-For straight off the request. That
// header is written by the CLIENT unless a proxy overwrites it, so anyone could
// send a different value on every request and never be limited at all — on the
// endpoint that calls the paid Claude API, and on the one that writes
// crowd-sourced POIs into everybody's itineraries, where the rate limit is the
// main thing standing between a stranger and 2,500 cities of fabricated data.
//
// Express only derives req.ip from the header when explicitly told to trust a
// proxy, so that decision is now deployment configuration: set TRUST_PROXY to
// the number of proxies in front of this server (1 behind a single load
// balancer), or leave it unset and req.ip is the real socket address, which
// cannot be forged.
const TRUST_PROXY = process.env.TRUST_PROXY;
if (TRUST_PROXY) app.set("trust proxy", /^\d+$/.test(TRUST_PROXY) ? Number(TRUST_PROXY) : TRUST_PROXY);
// Route payloads are small (a few hundred bytes); cap the body so a hostile
// client can't make us buffer megabytes.
app.use(express.json({ limit: "16kb" }));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    // Authorization matters: /api/delete-account is driven entirely by the
    // bearer token, so without it here the browser's preflight refuses the
    // header and the store-mandated "delete my account" button fails — but only
    // once the API is deployed on a different origin than the app, never in dev
    // where the Vite proxy makes everything same-origin.
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Per-IP rate limit — see server/rateLimit.js for why it exists and why it
// lives in its own module.
const limiter = createRateLimiter({ max: Number(process.env.RATE_LIMIT_PER_MIN) || DEFAULT_MAX });
const rateLimited = (ip) => limiter.limited(ip);

// One client for the process. 45s cap because the caller is a user staring at a
// loading screen (the SDK default is 10 minutes); no retries, because the app
// falls back to its local engine instantly.
const client = API_KEY
  ? new Anthropic({ apiKey: API_KEY, timeout: 45_000, maxRetries: 0 })
  : null;

// Somewhere for a crashed app to report to.
//
// Without this, an error in a published build is invisible: the phone keeps a
// ring buffer nobody can read, and the author learns about the bug from a
// one-star review weeks later. The alternative is Sentry (see
// mobile-native/SENTRY.md), which needs no server but hands the reports to a
// third party; this keeps them here.
//
// Reports arrive from an app that has just failed, so nothing in them is
// trusted: the shape is checked, every field is size-capped, and the whole
// thing is rate-limited like any other public endpoint.
const ERROR_LOG = process.env.ERROR_LOG || path.join(
  path.dirname(path.dirname(fileURLToPath(import.meta.url))), "data", "errors.jsonl",
);

app.post("/api/errors", (req, res) => {
  if (rateLimited(req.ip)) {
    return res.status(429).json({ error: "rate_limited", message: "Too many reports." });
  }

  const b = req.body || {};
  if (typeof b !== "object" || Array.isArray(b)) return res.status(400).json({ error: "bad_request" });
  const str = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");
  const entry = {
    kind: str(b.kind, 40) || "error",
    message: str(b.message, 500),
    stack: str(b.stack, 2000),
    platform: str(b.platform, 60),
    appVersion: str(b.appVersion, 40),
    ts: str(b.ts, 40) || new Date().toISOString(),
    receivedAt: new Date().toISOString(),
  };
  if (!entry.message && !entry.stack) return res.status(400).json({ error: "bad_request" });

  // One JSON object per line: appendable without reading, greppable, and it
  // cannot be corrupted by two writes racing the way a JSON array would be.
  // Capped and rotated: this endpoint is unauthenticated, and an unbounded
  // file that anyone can append to eventually fills the disk — which would
  // take trip generation and account deletion down with it.
  if (appendCapped(ERROR_LOG, JSON.stringify(entry)) === "failed") {
    console.error("[api] could not write the error log");
  }
  console.error(`[app-error] ${entry.kind} ${entry.platform} ${entry.appVersion}: ${entry.message}`);

  // 204: the app is already in trouble and has nothing to do with a body.
  return res.sendStatus(204);
});

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, ai: Boolean(client), accountDeletion: Boolean(admin) }));

// Share a city's freshly fetched OpenStreetMap POIs with everyone else.
//
// This is the point of putting cities in a database. Today the first person to
// plan a trip to an uncovered city waits 5-25s for Overpass, and that work is
// thrown away — the next person waits again. Storing the result turns per-user
// effort into shared coverage, which grows on its own from ~490 cities toward
// the full 5000 as people explore.
//
// It runs on the SERVER, not from the browser, on purpose: the publishable key
// has no write access, and if it did, anyone who read the bundle could inject
// fabricated attractions into every user's itinerary. Here the payload is
// validated, size-capped, rate-limited, and can never overwrite the curated
// rows.
app.post("/api/contribute-pois", async (req, res) => {
  if (!admin) {
    return res.status(503).json({ error: "not_configured", message: "Supabase admin credentials are not set." });
  }
  const ip = req.ip;
  if (rateLimited(ip)) {
    return res.status(429).json({ error: "rate_limited", message: "Too many requests, try again shortly." });
  }

  const { cityId, pois } = req.body || {};
  if (!isCityId(cityId)) {
    return res.status(400).json({ error: "bad_request", message: "cityId must be a Wikidata Q-id." });
  }
  if (!Array.isArray(pois) || pois.length < MIN_POIS || pois.length > MAX_POIS) {
    return res.status(400).json({ error: "bad_request", message: `pois must hold between ${MIN_POIS} and ${MAX_POIS} entries.` });
  }

  let clean;
  try {
    // The city must already exist in the index — this endpoint contributes
    // POIs, it does not invent cities. Its coordinates come back too, because
    // objectives have to be near the city they claim to be in: the check used
    // to be absent, so six entries anywhere on Earth were a valid contribution
    // for Paris.
    const { data: city } = await admin.from("cities").select("id,lat,lon").eq("id", cityId).maybeSingle();
    if (!city) return res.status(404).json({ error: "unknown_city", message: "No such city in the index." });

    const centre = Number.isFinite(city.lat) && Number.isFinite(city.lon) ? [city.lat, city.lon] : null;
    const result = sanitizePois(pois, centre);
    clean = result.pois;
    if (clean.length < MIN_POIS) {
      return res.status(400).json({
        error: "bad_request",
        message: "Too few usable POIs after validation.",
        dropped: result.dropped,
      });
    }

    // Never overwrite curated data with a crowd-sourced fetch: only insert when
    // the city has no row, or when the existing row is itself 'osm-live'.
    const { data: existing } = await admin.from("city_pois").select("source").eq("city_id", cityId).maybeSingle();
    if (existing && existing.source !== "osm-live") {
      return res.json({ ok: true, stored: false, reason: "curated_data_present" });
    }

    const { error } = await admin.from("city_pois").upsert({
      city_id: cityId,
      source: "osm-live",
      pois: clean,
      generated_at: new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    }, { onConflict: "city_id" });
    if (error) {
      console.error("[api] POI contribution failed:", error.message);
      return res.status(502).json({ error: "store_failed", message: "Could not store POIs." });
    }
    return res.json({ ok: true, stored: true, count: clean.length });
  } catch (err) {
    console.error("[api] POI contribution error:", err);
    return res.status(500).json({ error: "server_error", message: "Contribution failed." });
  }
});

// Permanently delete the caller's own account.
//
// Both stores require an in-app way to delete an account, and Supabase only
// allows it through the admin API, which needs the service_role key — so it
// cannot happen in the browser.
//
// The security rule here: the user id comes from VERIFYING the caller's access
// token, never from the request body. Accepting an id from the client would let
// anyone with a valid session delete any other account.
app.post("/api/delete-account", async (req, res) => {
  if (!admin) {
    return res.status(503).json({ error: "not_configured", message: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set on the server." });
  }
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return res.status(401).json({ error: "unauthorized", message: "Missing bearer token." });

  const ip = req.ip;
  if (rateLimited(ip)) {
    return res.status(429).json({ error: "rate_limited", message: "Too many requests, try again shortly." });
  }

  try {
    // Ask Supabase who this token belongs to. An expired, forged or revoked
    // token yields no user, and nothing is deleted.
    const { data, error } = await admin.auth.getUser(token);
    const userId = data?.user?.id;
    if (error || !userId) {
      return res.status(401).json({ error: "unauthorized", message: "Invalid or expired session." });
    }

    const { error: delError } = await admin.auth.admin.deleteUser(userId);
    if (delError) {
      console.error("[api] account deletion failed:", delError.message);
      return res.status(502).json({ error: "delete_failed", message: "Could not delete the account." });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error("[api] account deletion error:", err);
    return res.status(500).json({ error: "server_error", message: "Account deletion failed." });
  }
});

app.post("/api/generate-route", async (req, res) => {
  // Signals the client to stop asking and stay on its local engine, instead of
  // paying a failed round-trip on every generation.
  if (!client) {
    return res.status(503).json({ error: "ai_disabled", message: "ANTHROPIC_API_KEY is not configured on the server." });
  }
  // Validate first: it costs nothing and never reaches Claude, so a malformed
  // request shouldn't burn the caller's quota. The rate limit exists to protect
  // the paid upstream call, and only requests that get that far consume it.
  const { prefs, lang } = req.body || {};
  const invalid = validatePrefs(prefs);
  if (invalid) return res.status(400).json({ error: "bad_request", message: invalid });

  const ip = req.ip;
  if (rateLimited(ip)) {
    return res.status(429).json({ error: "rate_limited", message: "Too many requests, try again shortly." });
  }

  try {
    // Streaming avoids HTTP timeouts on long generations; finalMessage() gives
    // us the assembled response without hand-rolling event handling.
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: "json_schema", schema: DEST_SCHEMA }, effort: "low" },
      messages: [{ role: "user", content: buildPrompt(prefs, lang) }],
    });
    const message = await stream.finalMessage();

    // Hitting the token ceiling yields syntactically broken JSON — say so
    // plainly rather than letting JSON.parse throw a confusing SyntaxError.
    if (message.stop_reason === "max_tokens") {
      return res.status(502).json({ error: "truncated", message: "Model response hit max_tokens." });
    }
    if (message.stop_reason === "refusal") {
      return res.status(422).json({ error: "refused", message: "The model declined this request." });
    }
    const text = message.content.find((b) => b.type === "text")?.text;
    if (!text) return res.status(502).json({ error: "empty", message: "Empty model response." });

    let dest;
    try { dest = JSON.parse(text); }
    catch { return res.status(502).json({ error: "unparsable", message: "Model response was not valid JSON." }); }

    return res.json({ dest });
  } catch (err) {
    // Typed SDK errors, most specific first — the status we return tells the
    // client whether retrying could ever help.
    if (err instanceof Anthropic.AuthenticationError) {
      console.error("[api] Anthropic rejected the key:", err.message);
      return res.status(503).json({ error: "ai_disabled", message: "Server credentials are not valid." });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: "upstream_rate_limited", message: "Claude is rate limiting; try again shortly." });
    }
    if (err instanceof Anthropic.APIError) {
      console.error(`[api] Anthropic error ${err.status}:`, err.message);
      return res.status(502).json({ error: "upstream_error", message: "Claude API error." });
    }
    console.error("[api] generation failed:", err);
    return res.status(500).json({ error: "server_error", message: "Route generation failed." });
  }
});

// Exported so a test can mount the routes without a socket. Importing this
// module used to start a server, which is why none of it had tests.
export { app };

// Started only when this file IS the program — `node server/index.js`. Under
// `import`, argv[1] is the test runner, so nothing listens.
const isEntrypoint = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  app.listen(PORT, () => {
    console.log(`[api] listening on http://localhost:${PORT}`);
    console.log(`[api] AI ${client ? "enabled" : "DISABLED — set ANTHROPIC_API_KEY to enable"}`);
    if (ALLOWED_ORIGINS.length) console.log(`[api] CORS allowed: ${ALLOWED_ORIGINS.join(", ")}`);
  });
}
