import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// What the app does while the database is unreachable.
//
// Measured against the configured Supabase project, which does not resolve:
// every request took 9000 ms to give up, and nothing capped it. Typing a
// destination did nothing for nine seconds per lookup, and generating a route
// — which makes a series of them — sat there for over thirty, with the fallback
// index already in memory the whole time.
//
// Two separate things fix that, and the second matters more: a timeout, so one
// query cannot hold the screen; and a backoff, so the next twenty do not each
// rediscover the same outage.

const bounds = { south: 44, west: 20, north: 48, east: 30 };

async function load({ failing = true, delayMs = 50 } = {}) {
  vi.resetModules();
  const calls = { n: 0 };
  const result = failing
    ? { data: null, error: { message: "network" } }
    : { data: [{ id: "Q90", name: "Paris", country: "FR", lat: 48.8, lon: 2.3, rank: 100, tier: "mega" }], error: null };

  const builder = () => {
    const chain = {};
    for (const m of ["select", "or", "gte", "lte", "in", "eq", "neq", "lt", "order"]) chain[m] = () => chain;
    chain.limit = () => {
      calls.n++;
      return new Promise((res) => setTimeout(() => res(result), delayMs));
    };
    return chain;
  };
  vi.doMock("../lib/supabaseClient.js", () => ({ supabase: { from: builder } }));
  const mod = await import("../destinations.js");
  return { mod, calls };
}

beforeEach(() => { vi.useRealTimers(); });
afterEach(() => { vi.doUnmock("../lib/supabaseClient.js"); });

describe("a query that will not answer", () => {
  it("gives up rather than holding the screen", async () => {
    // Longer than the timeout: the call must resolve from the fallback well
    // before the query would have.
    const { mod } = await load({ delayMs: 20_000 });
    const t0 = Date.now();
    const out = await mod.searchDestinations("Paris", 3);
    const elapsed = Date.now() - t0;

    expect(elapsed).toBeLessThan(mod.QUERY_TIMEOUT_MS + 1500);
    expect(out.map((c) => c.n)).toContain("Paris");   // from the bundled index
    expect(mod.isDegraded()).toBe(true);
  }, 30_000);

  it("waits a sensible amount, not a token amount", () => {
    // Short enough that a dead backend is barely noticed; long enough that a
    // live one on a slow connection still wins.
    return load().then(({ mod }) => {
      expect(mod.QUERY_TIMEOUT_MS).toBeGreaterThanOrEqual(1500);
      expect(mod.QUERY_TIMEOUT_MS).toBeLessThanOrEqual(5000);
    });
  });
});

describe("after the first failure", () => {
  it("stops asking, instead of rediscovering the outage every time", async () => {
    const { mod, calls } = await load({ delayMs: 30 });
    await mod.searchDestinations("Paris", 3);
    const afterFirst = calls.n;
    expect(afterFirst).toBeGreaterThan(0);

    // A route generation makes a run of these. None should reach the network.
    for (const q of ["Madrid", "Lisbon", "Berlin", "Vienna", "Rome"]) {
      await mod.searchDestinations(q, 3);
    }
    expect(calls.n).toBe(afterFirst);
  }, 20_000);

  it("still answers from what is on the device", async () => {
    const { mod } = await load({ delayMs: 30 });
    await mod.searchDestinations("Paris", 3);
    const out = await mod.searchDestinations("Madrid", 3);
    expect(out.map((c) => c.n)).toContain("Madrid");
  }, 20_000);

  it("covers the map too, which queries on every pan", async () => {
    const { mod, calls } = await load({ delayMs: 30 });
    await mod.getCitiesInBounds(bounds, { zoom: 5 });
    const afterFirst = calls.n;
    for (let i = 0; i < 4; i++) await mod.getCitiesInBounds(bounds, { zoom: 5 });
    expect(calls.n).toBe(afterFirst);

    const out = await mod.getCitiesInBounds(bounds, { zoom: 5 });
    expect(out.length).toBeGreaterThan(0);
  }, 20_000);

  it("comes back for more eventually, rather than giving up for the session", async () => {
    const { mod } = await load();
    expect(mod.BACKOFF_MS).toBeGreaterThanOrEqual(10_000);
    expect(mod.BACKOFF_MS).toBeLessThanOrEqual(10 * 60_000);
  });
});

describe("when the database answers", () => {
  it("uses it, and does not report itself degraded", async () => {
    const { mod, calls } = await load({ failing: false, delayMs: 10 });
    const out = await mod.searchDestinations("Paris", 3);
    expect(calls.n).toBeGreaterThan(0);
    expect(out.map((c) => c.n)).toContain("Paris");
    expect(mod.isDegraded()).toBe(false);
  }, 20_000);
});
