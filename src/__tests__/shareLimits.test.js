import { describe, it, expect } from "vitest";
import LZString from "lz-string";
import {
  decodeSharedRouteFromHash, isSharedRouteValid, encodeTripHash,
  MAX_PAYLOAD_CHARS, MAX_DAYS, MAX_STOPS_PER_DAY, MAX_STOPS_TOTAL,
} from "../shareCodec.js";

// A shared trip is data from a stranger. The old check verified the SHAPE and
// nothing about the size, so a link expanded to whatever the sender liked:
// measured at 128x, a 139 KB link became a 17 MB object with 200,000 stops,
// all of it accepted and handed to the route screen to render.

const stop = (over = {}) => ({
  name: "Colosseum", emoji: "🏛️", time: "09:00", durLabel: "1h 30m",
  hours: "09:00–19:00", cost: 18, tip: "Book ahead", ll: [41.89, 12.49], ...over,
});

const route = (stops = 4, days = 1) => ({
  destName: "Rome",
  days,
  budget: { total: 300, tickets: 80, food: 120, transport: 100 },
  itinerary: Array.from({ length: days }, (_, d) => ({
    day: d + 1,
    stops: Array.from({ length: stops }, () => stop()),
  })),
});

describe("a genuine trip still goes through", () => {
  it("accepts what the app itself produces", () => {
    expect(isSharedRouteValid(route())).toBe(true);
    expect(decodeSharedRouteFromHash(encodeTripHash(route()))).not.toBeNull();
  });

  it("accepts the largest trip anyone would really plan", () => {
    // The generator plans 3–5 stops a day. A month of eight is far beyond it.
    const big = route(8, 31);
    expect(isSharedRouteValid(big)).toBe(true);
    const hash = encodeTripHash(big);
    expect(decodeSharedRouteFromHash(hash)).not.toBeNull();
    // And it is nowhere near the payload ceiling.
    expect(JSON.stringify(big).length).toBeLessThan(MAX_PAYLOAD_CHARS / 2);
  });

  it("still accepts stops missing the optional fields", () => {
    const sparse = route();
    sparse.itinerary[0].stops = [{ name: "A park" }];
    expect(isSharedRouteValid(sparse)).toBe(true);
  });
});

describe("a link that is trying something", () => {
  it("refuses a payload that decompresses to something enormous", () => {
    // 20,000 stops, not the 200,000 this was first measured with: compressing
    // 17 MB takes longer than the test timeout, and 1.7 MB already clears the
    // ceiling several times over. The amplification is the same either way.
    const huge = route(1);
    huge.itinerary[0].stops = Array.from({ length: 20000 }, () => stop());
    const json = JSON.stringify(huge);
    expect(json.length).toBeGreaterThan(MAX_PAYLOAD_CHARS * 5);

    const hash = "#tripz=" + LZString.compressToEncodedURIComponent(json);
    // The link is small enough to paste into a message — which is the whole
    // problem. The ratio climbs with size: 43x here, 128x at the 17 MB this
    // was first measured with.
    expect(hash.length).toBeLessThan(100_000);
    expect(json.length / hash.length).toBeGreaterThan(20);
    expect(decodeSharedRouteFromHash(hash)).toBeNull();
  });

  it("refuses more stops in a day than a day has hours for", () => {
    expect(isSharedRouteValid(route(MAX_STOPS_PER_DAY))).toBe(true);
    expect(isSharedRouteValid(route(MAX_STOPS_PER_DAY + 1))).toBe(false);
  });

  it("refuses a total no holiday reaches", () => {
    const r = route(MAX_STOPS_PER_DAY, MAX_DAYS);
    expect(MAX_DAYS * MAX_STOPS_PER_DAY).toBeGreaterThan(MAX_STOPS_TOTAL);
    expect(isSharedRouteValid(r)).toBe(false);
  });

  it("refuses more days than a month", () => {
    const r = route(1, 2);
    r.itinerary = Array.from({ length: MAX_DAYS + 1 }, (_, d) => ({ day: d + 1, stops: [stop()] }));
    expect(isSharedRouteValid(r)).toBe(false);
  });

  it("refuses a stop whose name is not text", () => {
    // React throws outright on an object where a child belongs, so this took
    // the whole app to the error boundary — the same way a missing budget did.
    for (const name of [{ }, ["x"], 42, null, undefined, "", "x".repeat(200)]) {
      const r = route();
      r.itinerary[0].stops = [stop({ name })];
      expect(isSharedRouteValid(r)).toBe(false);
    }
  });

  it("refuses a stop whose fields are the wrong type", () => {
    const bad = [
      { ll: "41.89,12.49" }, { ll: [41.89] }, { ll: [41.89, "12.49"] },
      { cost: "free" }, { tip: { text: "x" } }, { emoji: 7 },
      { tags: "culture" },
    ];
    for (const over of bad) {
      const r = route();
      r.itinerary[0].stops = [stop(over)];
      expect(isSharedRouteValid(r)).toBe(false);
    }
  });

  it("refuses a destination name that is a paragraph", () => {
    expect(isSharedRouteValid({ ...route(), destName: "R".repeat(500) })).toBe(false);
  });

  it("returns null rather than throwing, whatever the hash says", () => {
    for (const h of ["", "#", "#tripz=", "#tripz=@@@", "#trip=!!!", "#other=x", null, undefined]) {
      expect(() => decodeSharedRouteFromHash(h)).not.toThrow();
      expect(decodeSharedRouteFromHash(h)).toBeNull();
    }
  });
});
