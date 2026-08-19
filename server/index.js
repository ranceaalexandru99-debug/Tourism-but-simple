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

import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import {
  DEST_SCHEMA, MODEL, MAX_TOKENS, SYSTEM_PROMPT, buildPrompt, validatePrefs,
} from "../src/shared/routeSchema.js";

const PORT = Number(process.env.PORT) || 8787;
const API_KEY = process.env.ANTHROPIC_API_KEY;
// Comma-separated list of allowed browser origins for production. In dev the
// Vite proxy makes requests same-origin, so nothing is needed there.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",").map((s) => s.trim()).filter(Boolean);

const app = express();
app.disable("x-powered-by");
// Route payloads are small (a few hundred bytes); cap the body so a hostile
// client can't make us buffer megabytes.
app.use(express.json({ limit: "16kb" }));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Crude per-IP rate limit. Without it, a public endpoint backed by a paid API
// is an open tap on someone else's bill — the exact risk that moving the key
// server-side was meant to close.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = Number(process.env.RATE_LIMIT_PER_MIN) || 10;
const hits = new Map(); // ip → [timestamp, ...]
function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  // Keep the map from growing without bound on a long-lived process.
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  }
  return recent.length > MAX_PER_WINDOW;
}

// One client for the process. 45s cap because the caller is a user staring at a
// loading screen (the SDK default is 10 minutes); no retries, because the app
// falls back to its local engine instantly.
const client = API_KEY
  ? new Anthropic({ apiKey: API_KEY, timeout: 45_000, maxRetries: 0 })
  : null;

app.get("/api/health", (_req, res) => res.json({ ok: true, ai: Boolean(client) }));

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

  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.ip;
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

app.listen(PORT, () => {
  console.log(`[api] listening on http://localhost:${PORT}`);
  console.log(`[api] AI ${client ? "enabled" : "DISABLED — set ANTHROPIC_API_KEY to enable"}`);
  if (ALLOWED_ORIGINS.length) console.log(`[api] CORS allowed: ${ALLOWED_ORIGINS.join(", ")}`);
});
