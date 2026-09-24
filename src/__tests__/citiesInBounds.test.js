import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// "The server is unreachable" and "there are no cities here" are different
// facts. getCitiesInBounds used to return [] for both, so the explore map told
// people to move it — advice that could never work — for as long as the backend
// was down, with nothing saying why. These pin the two apart.

const rows = [
  { id: "Q1", name: "Paris", country: "FR", lat: 48.85, lon: 2.35, rank: 900, population: 2e6, tier: "mega", img: null, continent: "EU" },
  { id: "Q2", name: "Lyon", country: "FR", lat: 45.76, lon: 4.83, rank: 400, population: 5e5, tier: "big", img: null, continent: "EU" },
];

// A chainable stand-in for the supabase query builder: every method returns
// itself, and awaiting it yields whatever the test set up.
function stubSupabase(result) {
  const builder = {};
  for (const m of ["from", "select", "gte", "lte", "in", "order", "limit"]) builder[m] = () => builder;
  builder.then = (resolve) => Promise.resolve(result).then(resolve);
  return { from: () => builder };
}

const bounds = { south: 44, west: 1, north: 50, east: 6 };

async function load(result) {
  vi.resetModules();
  vi.doMock("../lib/supabaseClient.js", () => ({ supabase: stubSupabase(result) }));
  return import("../destinations.js");
}

beforeEach(() => { vi.resetModules(); });
afterEach(() => { vi.doUnmock("../lib/supabaseClient.js"); });

describe("getCitiesInBounds", () => {
  it("returns the cities it found", async () => {
    const { getCitiesInBounds } = await load({ data: rows, error: null });
    const out = await getCitiesInBounds(bounds, { zoom: 6 });
    expect(out.map((c) => c.n)).toEqual(["Paris", "Lyon"]);
  });

  it("returns an empty list when the area genuinely holds nothing", async () => {
    const { getCitiesInBounds } = await load({ data: [], error: null });
    await expect(getCitiesInBounds(bounds, { zoom: 6 })).resolves.toEqual([]);
  });

  // These two used to assert that a failed query throws and an absent backend
  // returns [] — the point being that "unreachable" must never look like
  // "empty here". That point still stands; what changed is the answer. The map
  // now falls back to the best-known cities, and the screen learns it is
  // degraded from isDegraded() rather than from an exception.
  //
  // The old behaviour is what the app does today, with a Supabase project that
  // does not resolve: a world map that claims to know no cities.
  it("serves the best-known cities when the query fails", async () => {
    const { getCitiesInBounds, isDegraded } = await load({ data: null, error: { message: "network" } });
    const out = await getCitiesInBounds(bounds, { zoom: 6 });
    expect(out.map((c) => c.n)).toContain("Paris");
    expect(isDegraded()).toBe(true);
  });

  it("serves them when there is no backend configured at all", async () => {
    vi.resetModules();
    vi.doMock("../lib/supabaseClient.js", () => ({ supabase: null }));
    const { getCitiesInBounds, isDegraded } = await import("../destinations.js");
    const out = await getCitiesInBounds(bounds, { zoom: 6 });
    expect(out.length).toBeGreaterThan(0);
    expect(isDegraded()).toBe(true);
  });

  it("still never confuses a failure with an empty area", async () => {
    // A working query over empty water must NOT be reported as degraded, or
    // the distinction the fallback was built to preserve is lost again.
    const { getCitiesInBounds, isDegraded } = await load({ data: [], error: null });
    await expect(getCitiesInBounds(bounds, { zoom: 6 })).resolves.toEqual([]);
    expect(isDegraded()).toBe(false);
  });

  it("rejects nonsense bounds without calling out", async () => {
    const { getCitiesInBounds } = await load({ data: rows, error: null });
    await expect(getCitiesInBounds({ south: NaN, west: 1, north: 2, east: 3 })).resolves.toEqual([]);
  });
});
