import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { selectCitiesInBounds, tiersForZoom, lonRanges, usableBounds } from "../shared/cityBounds.js";

// The web asks Supabase for a bounding box; the phone filters the index that
// ships in its bundle. What a viewport CONTAINS, and what is worth drawing at a
// given zoom, has to be the same on both — otherwise the same pan shows two
// different worlds. Hence one shared module, and these tests over it.

const city = (n, lat, lon, t = "mega", r = 100) => ({ id: n, n, ll: [lat, lon], t, r });
const box = (south, west, north, east) => ({ south, west, north, east });

describe("tiersForZoom", () => {
  it("shows only the famous cities when zoomed out", () => {
    expect(tiersForZoom(3)).toEqual(["mega"]);
  });

  it("fills in smaller places as you close in", () => {
    const sizes = [3, 5, 7, 9, 12].map((z) => tiersForZoom(z).length);
    // Monotonic: zooming in must never take a city off the map.
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]).toBeGreaterThanOrEqual(sizes[i - 1]);
    expect(tiersForZoom(12)).toContain("hidden");
  });
});

describe("usableBounds", () => {
  it("accepts a real viewport", () => {
    expect(usableBounds(box(44, 20, 48, 30))).toBe(true);
  });

  it("rejects one with a NaN in it", () => {
    // A NaN sails through every comparison as false and silently empties the
    // map, which reads to the user exactly like "there is nothing here".
    expect(usableBounds(box(NaN, 20, 48, 30))).toBe(false);
    expect(usableBounds(box(44, 20, 48, undefined))).toBe(false);
    expect(usableBounds(null)).toBe(false);
  });
});

describe("selectCitiesInBounds", () => {
  const cities = [
    city("Paris", 48.85, 2.35),
    city("Rome", 41.9, 12.5),
    city("Braşov", 45.65, 25.6, "notable", 40),
    city("Sydney", -33.86, 151.2),
    city("Auckland", -36.85, 174.76),
    city("Apia", -13.83, -171.76),
  ];

  it("returns what is inside the rectangle and nothing else", () => {
    const hits = selectCitiesInBounds(cities, box(40, 0, 50, 15), { zoom: 4 });
    expect(hits.map((c) => c.n).sort()).toEqual(["Paris", "Rome"]);
  });

  it("leaves out places too small for the current zoom", () => {
    const wide = box(40, 0, 50, 30);
    expect(selectCitiesInBounds(cities, wide, { zoom: 4 }).map((c) => c.n)).not.toContain("Braşov");
    expect(selectCitiesInBounds(cities, wide, { zoom: 10 }).map((c) => c.n)).toContain("Braşov");
  });

  it("finds cities on both sides of the date line", () => {
    // Leaflet hands back bounds like west=170, east=190 when you pan past the
    // antimeridian. A plain BETWEEN drops everything east of 180 — which is
    // most of the Pacific.
    const hits = selectCitiesInBounds(cities, box(-40, 170, -10, 190), { zoom: 4 });
    expect(hits.map((c) => c.n).sort()).toEqual(["Apia", "Auckland"]);
  });

  it("returns the most recognisable first", () => {
    const ranked = [city("Small", 45, 25, "mega", 1), city("Big", 45.1, 25.1, "mega", 900)];
    expect(selectCitiesInBounds(ranked, box(44, 24, 46, 26), { zoom: 4 })[0].n).toBe("Big");
  });

  it("keeps the best ones when it has to cut", () => {
    const many = Array.from({ length: 300 }, (_, i) => city(`c${i}`, 45, 25, "mega", i));
    const hits = selectCitiesInBounds(many, box(44, 24, 46, 26), { zoom: 4, limit: 10 });
    expect(hits).toHaveLength(10);
    expect(hits[0].r).toBe(299);
  });

  it("gives back nothing rather than throwing on rubbish", () => {
    expect(selectCitiesInBounds(null, box(0, 0, 1, 1))).toEqual([]);
    expect(selectCitiesInBounds(cities, null)).toEqual([]);
    expect(selectCitiesInBounds(cities, box(NaN, 0, 1, 1))).toEqual([]);
    expect(selectCitiesInBounds([{ id: "x" }, null, { ll: "nope" }], box(-90, -180, 90, 180))).toEqual([]);
  });

  it("covers the whole world when the whole world is in view", () => {
    expect(lonRanges(-200, 200)).toEqual([[-180, 180]]);
    const hits = selectCitiesInBounds(cities, box(-90, -200, 90, 200), { zoom: 12 });
    expect(hits).toHaveLength(cities.length);
  });
});

describe("the shared module", () => {
  it("is byte-identical on web and native", () => {
    const web = fs.readFileSync("src/shared/cityBounds.js", "utf8").replace(/\r\n/g, "\n");
    const nat = fs.readFileSync("mobile-native/src/shared/cityBounds.js", "utf8").replace(/\r\n/g, "\n");
    expect(nat).toBe(web);
  });

  it("is the only place the tier rules are written", () => {
    // They used to live in src/destinations.js. A second copy is how the two
    // platforms would drift back apart.
    const web = fs.readFileSync("src/destinations.js", "utf8");
    expect(web).not.toMatch(/function\s+tiersForZoom/);
    expect(web).not.toMatch(/export function lonRanges/);
  });
});
