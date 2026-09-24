import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { searchLocal, nameMatchesCity, aliasTargets, normalize, ALIASES } from "../shared/citySearch.js";
import { selectCitiesInBounds } from "../shared/cityBounds.js";

// The alias table used to exist twice, once per platform. A table of exonyms
// that two copies disagree about is a table where "Viena" finds Vienna on the
// phone and nothing on the web.

const fallback = JSON.parse(fs.readFileSync("src/data/fallbackCities.json", "utf8"));
const names = (rows) => rows.map((c) => c.n);

describe("the shared search module", () => {
  it("is byte-identical on web and native", () => {
    const web = fs.readFileSync("src/shared/citySearch.js", "utf8").replace(/\r\n/g, "\n");
    const nat = fs.readFileSync("mobile-native/src/shared/citySearch.js", "utf8").replace(/\r\n/g, "\n");
    expect(nat).toBe(web);
  });

  it("is the only copy of the alias table", () => {
    for (const file of ["src/destinations.js", "mobile-native/src/lib/destinations.js"]) {
      const src = fs.readFileSync(file, "utf8");
      expect(src).not.toMatch(/bucuresti:\s*"Bucharest"/);
    }
  });
});

describe("finding a city by what someone typed", () => {
  it("understands Romanian names", () => {
    expect(names(searchLocal(fallback, "viena", 1))).toEqual(["Vienna"]);
    expect(names(searchLocal(fallback, "bucuresti", 1))).toEqual(["Bucharest"]);
    expect(names(searchLocal(fallback, "londra", 1))).toEqual(["London"]);
  });

  it("understands endonyms and other languages' exonyms", () => {
    expect(names(searchLocal(fallback, "wien", 1))).toEqual(["Vienna"]);
    expect(names(searchLocal(fallback, "londres", 1))).toEqual(["London"]);
    expect(names(searchLocal(fallback, "roma", 1))).toEqual(["Rome"]);
  });

  it("puts the recognisable city first", () => {
    // "par" must surface Paris, not Paramaribo: a prefix match beats a mere
    // substring, and rank breaks the tie.
    expect(names(searchLocal(fallback, "par", 3))[0]).toBe("Paris");
  });

  it("matches an alias while it is still being typed", () => {
    expect(aliasTargets("bucu")).toContain("bucharest");
    expect(aliasTargets("roma 2 zile")).toContain("rome");
  });

  it("does not let a country name become a city", () => {
    // A bare prefix test made "românia" match the alias "roma" and return Rome.
    expect(aliasTargets(normalize("românia"))).not.toContain("rome");
  });

  it("says nothing until there is enough to go on", () => {
    expect(searchLocal(fallback, "p", 5)).toEqual([]);
    expect(searchLocal(fallback, "", 5)).toEqual([]);
  });

  it("gives back nothing rather than throwing on rubbish", () => {
    expect(searchLocal(null, "paris", 5)).toEqual([]);
    expect(searchLocal([{ id: 1 }, null], "paris", 5)).toEqual([]);
  });

  it("respects the limit it is given", () => {
    expect(searchLocal(fallback, "san", 3)).toHaveLength(3);
  });
});

describe("nameMatchesCity", () => {
  const rome = { n: "Rome" };
  it("accepts the name and an alias for it, at the start", () => {
    expect(nameMatchesCity("Rome", rome)).toBe(true);
    expect(nameMatchesCity("roma 2 zile", rome)).toBe(true);
    expect(nameMatchesCity("Rome, 3 days", rome)).toBe(false); // comma, not a space
  });

  it("refuses a name that merely contains it", () => {
    expect(nameMatchesCity("Romeo", rome)).toBe(false);
    expect(nameMatchesCity("românia", rome)).toBe(false);
  });
});

describe("the fallback index", () => {
  it("holds the cities everyone has heard of, and no more", () => {
    expect(fallback.length).toBeGreaterThan(400);
    expect(fallback.length).toBeLessThan(800);
    for (const c of fallback) expect(["mega", "major"]).toContain(c.t);
  });

  it("speaks the same shape as a database row", () => {
    // A fallback city and a real one must be indistinguishable to every caller,
    // or the degraded mode becomes its own set of bugs.
    for (const c of fallback.slice(0, 50)) {
      expect(typeof c.id).toBe("string");
      expect(typeof c.n).toBe("string");
      expect(typeof c.c).toBe("string");
      expect(Array.isArray(c.ll)).toBe(true);
      expect(typeof c.r).toBe("number");
    }
  });

  it("has a photo for almost every city, so the rails are not grey boxes", () => {
    const withImg = fallback.filter((c) => c.img).length;
    expect(withImg / fallback.length).toBeGreaterThan(0.9);
  });

  it("can answer the explore map", () => {
    const europe = selectCitiesInBounds(fallback, { south: 42, west: 10, north: 52, east: 30 }, { zoom: 5 });
    expect(europe.length).toBeGreaterThan(3);
    expect(names(europe)).toContain("Vienna");
  });

  it("stays small enough to be worth loading at all", () => {
    // It is lazily imported and only after a query fails, but a fallback that
    // costs as much as the index it replaces would defeat the move to Supabase.
    const bytes = fs.statSync("src/data/fallbackCities.json").size;
    expect(bytes).toBeLessThan(120 * 1024);
  });
});
