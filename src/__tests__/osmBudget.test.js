import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { fetchCityPoisLive, OSM_BUDGET_MS, MIN_ATTEMPT_MS } from "../osmLive.js";

// How long the OpenStreetMap tier is allowed to keep someone on the loading
// screen.
//
// Measured in a browser, with all three mirrors failing: 20s, then 30s, then
// 15s, tried in series — 65 seconds, every one of them returning zero bytes,
// before the local engine (which needs no network and produces a good route)
// was allowed to run. Per-mirror limits could never bound that: adding a fourth
// mirror would have made it worse again.
//
// So the limit is a budget for the whole ladder. This tier is an enhancement —
// real opening hours and coordinates when it answers, a perfectly good trip
// when it does not — so the budget is what someone will sit through.
//
// The ladder is exercised ONCE here and the recording asserted on repeatedly:
// each run waits out the whole budget, and four of them made this the slowest
// file in the suite by a wide margin.

const city = { id: "Q1735", n: "Vienna", ll: [48.2, 16.37], p: 1900000, t: "mega" };

function storageStub() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    key: (i) => [...map.keys()][i] ?? null,
    get length() { return map.size; },
  };
}

const attempts = [];
let result;
let elapsed;

beforeAll(async () => {
  vi.stubGlobal("localStorage", storageStub());
  // A fetch that never answers, recording what each attempt was granted.
  vi.stubGlobal("fetch", (url, opts) => new Promise((_, reject) => {
    const started = Date.now();
    const body = String(opts?.body || "");
    opts?.signal?.addEventListener("abort", () => {
      attempts.push({ url: String(url), ms: Date.now() - started, body });
      reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
    }, { once: true });
  }));

  const t0 = Date.now();
  result = await fetchCityPoisLive(city);
  elapsed = Date.now() - t0;
}, 90_000);   // generous on purpose: the OLD ladder took 65s, and this hook
     // timing out would SKIP every assertion below instead of failing it.

afterAll(() => { vi.unstubAllGlobals(); });

describe("the OpenStreetMap tier", () => {
  it("gives up on the whole ladder inside the budget", () => {
    expect(result).toBeNull();
    // Allowance for the loop itself; the point is that it is nowhere near the
    // 65 seconds this used to take.
    expect(elapsed).toBeLessThan(OSM_BUDGET_MS + 2000);
  });

  it("tries more than one mirror, and gives none of them the lot", () => {
    expect(attempts.length).toBeGreaterThan(1);
    for (const a of attempts) expect(a.ms).toBeLessThan(OSM_BUDGET_MS);
  });

  it("stops rather than starting an attempt it cannot finish", () => {
    // A mirror handed a second would be abandoned mid-query, having cost it the
    // work regardless.
    const granted = attempts.reduce((a, r) => a + r.ms, 0);
    expect(granted).toBeLessThanOrEqual(OSM_BUDGET_MS + 1500);
    expect(MIN_ATTEMPT_MS).toBeGreaterThan(0);
  });

  it("asks the server for no more work than it will wait for", () => {
    // The timeout goes into the Overpass query as its own server-side limit. If
    // the two disagree, the mirror spends effort on a result nobody is still
    // waiting for. Sent as "data=" + encodeURIComponent(query).
    for (const a of attempts) {
      const m = decodeURIComponent(a.body.replace(/^data=/, "")).match(/\[timeout:(\d+)\]/);
      expect(m).not.toBeNull();
      expect(Number(m[1]) * 1000).toBeLessThanOrEqual(OSM_BUDGET_MS);
    }
  });

  it("is a budget someone would actually sit through", () => {
    expect(OSM_BUDGET_MS).toBeGreaterThanOrEqual(5000);
    expect(OSM_BUDGET_MS).toBeLessThanOrEqual(20000);
  });
});
