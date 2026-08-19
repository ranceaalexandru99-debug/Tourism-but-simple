import { describe, it, expect } from "vitest";
import { encodeTripHash, decodeSharedRouteFromHash, isSharedRouteValid, sanitizeRouteForShare } from "../shareCodec.js";

const validRoute = {
  id: "r1", destName: "Roma", days: 3,
  // A real route always carries a budget, and the Route screen renders it
  // unconditionally — so the validator requires it too.
  budget: { tier: "mediu", tickets: 20, food: 150, transport: 30, total: 200, perDay: 67 },
  itinerary: [
    { day: 1, stops: [{ name: "Colosseum", time: "9:00" }] },
    { day: 2, stops: [] },
    { day: 3, stops: [{ name: "Vatican", time: "10:00" }] },
  ],
};

describe("share link round-trip", () => {
  it("encodes and decodes a route losslessly", () => {
    const hash = encodeTripHash(validRoute);
    expect(hash.startsWith("#tripz=")).toBe(true);
    expect(decodeSharedRouteFromHash(hash)).toEqual(validRoute);
  });
});

describe("sanitizeRouteForShare (personal state never leaves the device)", () => {
  it("strips notes, done flags, ratings and AI flags — keeps the itinerary", () => {
    const dirty = {
      id: "r2", destName: "Roma", days: 1, _ai: true, _aiFailed: false,
      itinerary: [{ day: 1, stops: [
        { name: "Colosseum", time: "9:00", note: "meet Ana — private!", done: true, rating: 5, ll: [41.89, 12.49] },
      ]}],
    };
    const clean = sanitizeRouteForShare(dirty);
    const stop = clean.itinerary[0].stops[0];
    expect(stop.note).toBeUndefined();
    expect(stop.done).toBeUndefined();
    expect(stop.rating).toBeUndefined();
    expect(clean._ai).toBeUndefined();
    expect(stop.name).toBe("Colosseum");
    expect(stop.ll).toEqual([41.89, 12.49]);
    // and the original is untouched
    expect(dirty.itinerary[0].stops[0].note).toBe("meet Ana — private!");
    // the encoded payload itself must not contain the private text
    expect(decodeURIComponent(encodeTripHash(clean))).not.toContain("Ana");
  });
});

describe("hostile/malformed input is rejected (returns null, never throws)", () => {
  it.each([
    ["garbage payload", "#tripz=not-actually-lz-data"],
    ["empty hash", ""],
    ["unrelated hash", "#section-2"],
    ["legacy format, invalid base64", "#trip=%%%%"],
  ])("%s", (_label, hash) => {
    expect(decodeSharedRouteFromHash(hash)).toBeNull();
  });

  it("rejects well-formed JSON with the wrong shape", () => {
    const bad = [
      {},                                            // empty object
      { destName: "X", days: 0, itinerary: [{ stops: [] }] },   // days out of range
      { destName: "X", days: 99, itinerary: [{ stops: [] }] },  // days out of range
      { destName: "", days: 2, itinerary: [{ stops: [] }] },    // blank name
      { destName: "X", days: 2, itinerary: [] },                // empty itinerary
      { destName: "X", days: 2, itinerary: [{ stops: null }] }, // day without stops[]
      [1, 2, 3],                                     // array, not object
    ];
    for (const r of bad) {
      expect(isSharedRouteValid(r)).toBe(false);
      expect(decodeSharedRouteFromHash(encodeTripHash(r))).toBeNull();
    }
  });
});

describe("validator rejects payloads that would crash the route screen", () => {
  it("rejects a route with no budget (BudgetCard reads budget.total)", () => {
    const { budget, ...noBudget } = validRoute;
    expect(isSharedRouteValid(noBudget)).toBe(false);
  });
  it("rejects a non-numeric budget total", () => {
    expect(isSharedRouteValid({ ...validRoute, budget: { total: "lots" } })).toBe(false);
  });
});
