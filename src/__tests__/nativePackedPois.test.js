import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { buildDest, STOP_CATEGORIES } from "../shared/poiDest.js";

// The native app's objectives.
//
// It had real ones for 19 cities, typed out by hand in mockEngine.js, and for
// the other 4,980 in the index it generated "Centrul istoric", "Muzeul
// orașului", "Parcul orașului" — no real name, no coordinate, the same seven
// stops everywhere. Meanwhile 265,740 crawled OpenStreetMap objectives sat in
// data/pois/ whose only reader was a Supabase table that does not exist.
//
// scripts/pack-native-pois.mjs packs them into 60 shards inside the bundle.
// These tests are about the pack being usable, not about it existing: a shard
// of the wrong shape, or missing the fields buildDest reads, would produce a
// trip that looks real and is empty.

const PACK = "mobile-native/src/data/pois";
const index = JSON.parse(fs.readFileSync(`${PACK}/index.json`, "utf8"));
const cities = JSON.parse(fs.readFileSync("mobile-native/src/data/destinations.json", "utf8"));
const byId = new Map(cities.map((c) => [c.id, c]));

const shard = (n) => JSON.parse(fs.readFileSync(`${PACK}/${n}.json`, "utf8"));

// Six of sixty. Cities are spread across shards round-robin by rank, so this is
// a tenth of the pack drawn evenly from every part of it. Reading all 34 MB
// here is what made six other test files time out.
const SAMPLE = [0, 11, 23, 37, 44, 58];

describe("the packed objectives", () => {
  it("covers the cities that have crawled data, and only real cities", () => {
    expect(Object.keys(index).length).toBeGreaterThan(4500);
    const strays = Object.keys(index).filter((qid) => !byId.has(qid));
    expect(strays).toEqual([]);
  });

  it("puts a city in a shard that actually holds it", () => {
    // An index pointing at the wrong shard fails silently — loadPackedPois
    // returns null and the city quietly drops to the generic itinerary.
    //
    // Every city is checked by scripts/pack-native-pois.mjs, which reads back
    // what it wrote and exits non-zero if one does not resolve. Doing it here
    // too meant reading 34 MB inside a suite that runs test files in parallel,
    // and that pushed six unrelated files past their timeouts. This is the
    // spot check; the script holds the exhaustive one.
    for (const n of SAMPLE) {
      const s = shard(n);
      const [qid, pois] = Object.entries(s)[0];
      expect(index[qid]).toBe(n);
      expect(pois.length).toBeGreaterThan(0);
    }
  });

  it("carries the fields the itinerary bridge reads", () => {
    const s = shard(0);
    const all = Object.values(s).flat();
    expect(all.length).toBeGreaterThan(100);
    // name/category/tags/ll are the four the crawl has for 100% of objectives
    // and the four without which a stop cannot be placed or drawn.
    for (const p of all) {
      expect(typeof p.name).toBe("string");
      expect(typeof p.category).toBe("string");
      expect(Array.isArray(p.tags)).toBe(true);
      expect(p.ll).toHaveLength(2);
      expect(Number.isFinite(p.ll[0]) && Number.isFinite(p.ll[1])).toBe(true);
    }
    // Nothing the bridge never reads should be paying for bundle space.
    const keys = new Set(all.flatMap((p) => Object.keys(p)));
    expect([...keys].filter((k) => k === "wikidata" || k === "cuisine")).toEqual([]);
  });

  it("gives every packed city enough sightseeing stops to plan a trip", () => {
    // Three is assembleRoute's floor. Below it the app would offer a trip whose
    // days are padded by repetition — worse than admitting it has no data.
    //
    // A sample, for the reason given at SAMPLE — and the pack script applies
    // this same floor, so this is checking its work rather than doing it.
    const thin = [];
    for (const n of SAMPLE) {
      for (const [qid, pois] of Object.entries(shard(n))) {
        const sights = pois.filter((p) => STOP_CATEGORIES.has(p.category)).length;
        if (sights < 3) thin.push(`${byId.get(qid)?.n || qid}: ${sights}`);
      }
    }
    expect(thin).toEqual([]);
  });
});

describe("a city that used to get the generic itinerary", () => {
  // Leeds: 536,280 people, crawled in this round of work, and never one of the
  // 19 hand-written cities. Before the pack it produced "Centrul istoric".
  const leeds = cities.find((c) => c.n === "Leeds");

  it("is in the pack", () => {
    expect(leeds).toBeTruthy();
    expect(index[leeds.id]).toBeTypeOf("number");
  });

  it("builds a destination of real, named, locatable places", () => {
    const pois = shard(index[leeds.id])[leeds.id];
    const dest = buildDest(
      { name: leeds.n, country: leeds.c, ll: leeds.ll, emoji: "📍", blurb: "" },
      { pois },
      { foodFallback: "fallback", transport: "transport" },
    );

    expect(dest.key).toBe("osm");
    expect(dest.pois.length).toBeGreaterThanOrEqual(3);
    // The tell-tale of the generic itinerary, in any language it was written in.
    const generic = ["Centrul istoric", "Muzeul orașului", "Parcul orașului", "Punct panoramic"];
    expect(dest.pois.filter((p) => generic.includes(p.name))).toEqual([]);
    // Every stop placeable on the map, and near Leeds rather than near anything
    // else — a shard mixed up at pack time would show up exactly here.
    for (const p of dest.pois) {
      expect(p.ll).toHaveLength(2);
      expect(Math.abs(p.ll[0] - leeds.ll[0])).toBeLessThan(0.5);
      expect(Math.abs(p.ll[1] - leeds.ll[1])).toBeLessThan(0.5);
    }
  });
});

describe("the generated shard loader", () => {
  it("names every shard with a literal path Metro can resolve", () => {
    // A require() with a computed path is a runtime lookup the bundler cannot
    // follow, and the shards would simply not be in the app. This is the one
    // thing about poiShards.js worth asserting.
    const src = fs.readFileSync("mobile-native/src/lib/poiShards.js", "utf8");
    for (let n = 0; n < 60; n++) {
      expect(src).toContain(`require("../data/pois/${n}.json")`);
    }
    expect(src).not.toMatch(/require\([^"')]*[$+]/);
  });

  it("has a file on disk for each one it requires", () => {
    for (let n = 0; n < 60; n++) {
      expect(fs.existsSync(path.join(PACK, `${n}.json`))).toBe(true);
    }
  });
});
