import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";

// The 230 cities the pack skips.
//
// They are the long tail the crawler found too little in — Kananga, Aba,
// Moradabad — and until now they got the generic "Centrul istoric" itinerary on
// a phone while the web app showed real places for the very same city, because
// osmLive.js existed only on the web side.
//
// What is tested here is the tier ladder and the one thing the native wrapper
// adds: a User-Agent. The budget and mirror ladder are tested once, against the
// shared module, in osmBudget.test.js — there is one copy of that logic now.

const cities = JSON.parse(fs.readFileSync("mobile-native/src/data/destinations.json", "utf8"));
const packIndex = JSON.parse(fs.readFileSync("mobile-native/src/data/pois/index.json", "utf8"));

// Kananga: 1.97 million people and no packed objectives. If this ever gains
// them the test should move to another unpacked city, not be deleted — the
// assertion is about the tier, not about Kananga.
const UNPACKED = cities.find((c) => c.n === "Kananga");

vi.mock("../../mobile-native/src/lib/poiShards.js", () => ({
  shardLoaders: Array.from({ length: 60 }, (_, n) => () =>
    JSON.parse(fs.readFileSync(`mobile-native/src/data/pois/${n}.json`, "utf8")),
  ),
}));

const live = vi.hoisted(() => ({ fetchCityPoisLive: vi.fn() }));
vi.mock("../../mobile-native/src/lib/osmLive.js", () => live);

const prefs = (destination) => ({
  destination, days: 2, interests: ["culture"], pace: "normal", budget: "mediu",
});
const stopsOf = (route) => route.itinerary.flatMap((d) => d.stops);
const INVENTED = ["Centrul istoric", "Muzeul orașului", "Parcul orașului"];

// Six sights, the shape shared/osmLive.js returns.
const payload = (name) => ({
  city: name,
  source: "osm-live",
  pois: Array.from({ length: 6 }, (_, i) => ({
    name: `${name} obiectiv ${i + 1}`,
    category: "museum",
    tags: ["culture"],
    ll: [UNPACKED.ll[0] + i * 0.001, UNPACKED.ll[1]],
  })),
});

let generateRoute;
beforeEach(async () => {
  live.fetchCityPoisLive.mockReset();
  vi.resetModules();
  ({ generateRoute } = await import("../../mobile-native/src/lib/mockEngine.js"));
});
afterEach(() => { try { localStorage.clear(); } catch {} });

describe("the tier ladder", () => {
  it("picks the Kananga case honestly — it really has no packed objectives", () => {
    expect(UNPACKED).toBeTruthy();
    expect(UNPACKED.id in packIndex).toBe(false);
  });

  it("asks OpenStreetMap for a city the pack skips, and uses the answer", async () => {
    live.fetchCityPoisLive.mockResolvedValue(payload("Kananga"));
    const route = await generateRoute(prefs("Kananga"));

    expect(live.fetchCityPoisLive).toHaveBeenCalledTimes(1);
    expect(live.fetchCityPoisLive.mock.calls[0][0].id).toBe(UNPACKED.id);
    const names = stopsOf(route).map((s) => s.name);
    expect(names.filter((n) => INVENTED.includes(n))).toEqual([]);
    expect(names[0]).toContain("Kananga obiectiv");
  });

  it("does not touch the network for a city that is packed", async () => {
    // The whole point of shipping 34 MB: Leeds must be instant and offline.
    const route = await generateRoute(prefs("Leeds"));
    expect(live.fetchCityPoisLive).not.toHaveBeenCalled();
    expect(stopsOf(route).length).toBeGreaterThanOrEqual(3);
  });

  it("does not touch the network for one of the hand-written cities", async () => {
    const route = await generateRoute(prefs("Roma"));
    expect(live.fetchCityPoisLive).not.toHaveBeenCalled();
    expect(stopsOf(route).map((s) => s.name)).toContain("Colosseumul");
  });

  it("falls to the generic itinerary when OpenStreetMap gives nothing", async () => {
    live.fetchCityPoisLive.mockResolvedValue(null);
    const stops = stopsOf(await generateRoute(prefs("Kananga")));
    expect(stops.length).toBeGreaterThan(0);
    expect(stops.every((s) => INVENTED.concat([
      "Piața centrală & cafenele", "Piață locală / bazar", "Punct panoramic", "Cartierul de seară",
    ]).includes(s.name))).toBe(true);
  });

  it("falls to the generic itinerary when the fetch throws", async () => {
    // A rejected promise inside generateRoute would take the whole trip down,
    // and App.js has no catch around it.
    live.fetchCityPoisLive.mockRejectedValue(new Error("fara internet"));
    await expect(generateRoute(prefs("Kananga"))).resolves.toBeTruthy();
  });

  it("asks nothing for a phrase that matches no city", async () => {
    await generateRoute(prefs("Qwertyuiop"));
    expect(live.fetchCityPoisLive).not.toHaveBeenCalled();
  });
});

describe("what the native wrapper adds", () => {
  const src = fs.readFileSync("mobile-native/src/lib/osmLive.js", "utf8");

  it("sends a User-Agent, because React Native otherwise says okhttp", () => {
    expect(src).toMatch(/"User-Agent":\s*USER_AGENT/);
  });

  it("puts no email address in a request header", () => {
    // scripts/batch-pois.mjs identifies itself with the maintainer's address.
    // That is one machine run by hand; this is every user's phone, and their
    // own address is not ours to attach either.
    expect(src).not.toMatch(/@/);
  });

  it("contributes nowhere until an absolute endpoint is configured", () => {
    // The web app contributes to a relative URL, which resolves against the
    // page's origin. A phone has no origin, so a relative URL goes nowhere —
    // undefined, not "", is what skips it.
    expect(src).toMatch(/extra\?\.apiBase \|\| undefined/);
  });
});
