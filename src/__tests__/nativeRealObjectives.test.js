import { describe, it, expect, vi, beforeAll } from "vitest";
import fs from "node:fs";

// Does the native app actually put real places in a trip now?
//
// nativePackedPois.test.js checks the pack is well formed. This drives
// generateRoute, the function App.js calls, for a city that before this work
// produced "Centrul istoric", "Muzeul orașului", "Parcul orașului" — the same
// seven invented stops that 4,980 of the 4,999 cities in the index got.
//
// Only one thing is replaced: poiShards.js uses CommonJS require(), because
// that is the only form Metro can resolve at build time, and an ES module test
// cannot call it. The replacement reads the same shard files off disk, so the
// data flowing through here is the real pack — not a fixture that agrees with
// whatever the code happens to do.

vi.mock("../../mobile-native/src/lib/poiShards.js", () => ({
  shardLoaders: Array.from({ length: 60 }, (_, n) => () =>
    JSON.parse(fs.readFileSync(`mobile-native/src/data/pois/${n}.json`, "utf8")),
  ),
}));

let generateRoute;
beforeAll(async () => {
  ({ generateRoute } = await import("../../mobile-native/src/lib/mockEngine.js"));
});

// The stops the generic itinerary invents, in the language it was written in.
const INVENTED = [
  "Centrul istoric", "Muzeul orașului", "Piața centrală & cafenele",
  "Parcul orașului", "Piață locală / bazar", "Punct panoramic", "Cartierul de seară",
];

const prefs = (destination) => ({
  destination, days: 3, interests: ["culture"], pace: "normal", budget: "mediu",
});

const stopsOf = (route) => route.itinerary.flatMap((d) => d.stops);

describe("a city the native app used to invent a trip for", () => {
  // Leeds, 536,280 people. Crawled in this round of work, never one of the 19
  // cities somebody typed out by hand.
  it("gets real, named places", async () => {
    const route = await generateRoute(prefs("Leeds"));
    const stops = stopsOf(route);

    expect(stops.length).toBeGreaterThanOrEqual(3);
    expect(stops.filter((s) => INVENTED.includes(s.name))).toEqual([]);
    // `key: "osm"` is what tells the UI these are real places and not to flag
    // them as unverified AI output.
    expect(route.destKey ?? route.key).not.toBe("custom");
  });

  it("gets places with coordinates, near Leeds", async () => {
    const route = await generateRoute(prefs("Leeds"));
    const cities = JSON.parse(fs.readFileSync("mobile-native/src/data/destinations.json", "utf8"));
    const leeds = cities.find((c) => c.n === "Leeds");

    for (const s of stopsOf(route)) {
      expect(s.ll, `${s.name} fără coordonate`).toHaveLength(2);
      expect(Math.abs(s.ll[0] - leeds.ll[0])).toBeLessThan(0.5);
    }
  });

  it("works the same for Marrakech, Fez and Fukuoka", async () => {
    // All three were among the 146 cities never crawled until this round.
    for (const name of ["Marrakech", "Fez", "Fukuoka"]) {
      const stops = stopsOf(await generateRoute(prefs(name)));
      expect(stops.filter((s) => INVENTED.includes(s.name)), name).toEqual([]);
      expect(stops.length, name).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("what the pack must not take away", () => {
  it("leaves the hand-written cities alone", async () => {
    // Roma has local tips no database holds — "Vino dimineața devreme, la 8:00
    // e aproape goală". Tier 1 must still win over 265,740 OSM rows.
    const route = await generateRoute(prefs("Roma"));
    const names = stopsOf(route).map((s) => s.name);
    expect(names).toContain("Colosseumul");
    expect(stopsOf(route).some((s) => s.tip?.includes("Rezervă online"))).toBe(true);
  });

  it("still has a generic itinerary for somewhere that is not a city", async () => {
    // A typed phrase matching nothing must not crash and must not come back
    // empty — the generic trip is the floor, not the default.
    const route = await generateRoute(prefs("Qwertyuiop"));
    const stops = stopsOf(route);
    expect(stops.length).toBeGreaterThan(0);
    expect(stops.every((s) => INVENTED.includes(s.name))).toBe(true);
  });

  it("does not hijack a city name hidden inside another word", async () => {
    // "Balikpapan" contains "bali", "Ontario" contains "rio" — each used to
    // return a curated itinerary for the wrong city. Adding a second resolution
    // tier is exactly where that class of bug comes back.
    const route = await generateRoute(prefs("Balikpapan"));
    const names = stopsOf(route).map((s) => s.name);
    expect(names).not.toContain("Templul Uluwatu");
    expect(names.some((n) => /Bali/i.test(n))).toBe(false);
  });
});
