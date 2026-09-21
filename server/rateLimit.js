// Per-IP rate limiting.
//
// Without it, a public endpoint backed by a paid API is an open tap on someone
// else's bill — the exact risk that moving the Anthropic key server-side was
// meant to close. It also bounds how much crowd-sourced data one stranger can
// write into everybody's itineraries through /api/contribute-pois.
//
// It lived inside server/index.js, which calls app.listen() at module scope, so
// importing it started a server and none of this could be tested. The fix that
// made the limit work at all — no longer trusting an IP the client supplies —
// went in verified only by hand.

export const WINDOW_MS = 60_000;
export const DEFAULT_MAX = 10;

// Beyond this many distinct IPs we sweep out the expired ones. A long-lived
// process would otherwise keep a row per address it has ever seen.
const SWEEP_AT = 5000;

/**
 * @param {object} [opts]
 * @param {number} [opts.max]       requests allowed per window
 * @param {number} [opts.windowMs]
 * @param {()=>number} [opts.now]   injectable clock, for tests
 */
export function createRateLimiter({ max = DEFAULT_MAX, windowMs = WINDOW_MS, now = Date.now } = {}) {
  const hits = new Map();   // ip → [timestamp, ...]

  return {
    /** True when this request is over the limit and should be refused. */
    limited(ip) {
      const t = now();
      const recent = (hits.get(ip) || []).filter((x) => t - x < windowMs);
      recent.push(t);
      hits.set(ip, recent);

      if (hits.size > SWEEP_AT) {
        for (const [k, v] of hits) if (!v.some((x) => t - x < windowMs)) hits.delete(k);
      }
      return recent.length > max;
    },

    /** Distinct addresses currently held. Exposed so the sweep is observable. */
    get size() { return hits.size; },

    reset() { hits.clear(); },
  };
}
