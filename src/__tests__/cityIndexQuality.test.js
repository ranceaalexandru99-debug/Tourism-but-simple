import { describe, it, expect } from "vitest";
import fs from "node:fs";

// Two defects in the 5000-city index, and the guards against them coming back.
//
// NAMES. Nineteen cities were called by their Wikidata id — the app showed
// "Q49255" where it meant Tampa, and nobody can type that into a search box.
// The crawler fell back to the id when a city had no English label.
//
// TIERS. `r` is the number of Wikipedias with an article, and the tier follows
// from it. Bots mass-created stub articles for thousands of small European
// settlements, so Kurów — 2,795 people — scores 236 against Miami's 202, and
// shared a tier with Paris. Tier decides what the explore map draws at world
// zoom.

const WEB = "src/destinations.json";
const NATIVE = "mobile-native/src/data/destinations.json";

const web = JSON.parse(fs.readFileSync(WEB, "utf8"));
const native = JSON.parse(fs.readFileSync(NATIVE, "utf8"));
const corrections = JSON.parse(fs.readFileSync("data/index-corrections.json", "utf8"));
const { overrides, removals } = corrections;

describe("city names", () => {
  it("never shows a database id as a city name", () => {
    const byId = web.filter((c) => /^Q\d+$/.test(c.n));
    expect(byId.map((c) => c.id)).toEqual([]);
  });

  it("is searchable by typing — every name is Latin script", () => {
    // A name in Arabic or Greek cannot be found by someone typing Latin, and
    // every other one of the 5000 is Latin. This found جنين — the English
    // LABEL on Wikidata for Jenin is itself in Arabic, while the article is
    // titled "Jenin" — and resolving Άργος to "Argos" was the difference
    // between a city existing in this app and not.
    //
    // Modifier letters are allowed: Nukuʻalofa is spelt with U+02BB, which is
    // not Latin script by Unicode's reckoning and is the town's real name.
    const latin = /^[\p{Script=Latin}\p{P}\p{Zs}\p{Lm}\d]+$/u;
    const odd = web.filter((c) => !latin.test(c.n));
    expect(odd.map((c) => `${c.id} ${c.n}`)).toEqual([]);
  });

  it("holds only places", () => {
    // "unification of Germany" was in here: a historical process whose Wikidata
    // coordinate is the Hall of Mirrors at Versailles, which the generator read
    // as a city in France with a population of zero.
    //
    // There is no automatic test for this — Wikidata does not file "comune of
    // Italy" under "human settlement", so asking that question flags 1951 of
    // the 5000. The list was read by hand and exactly one entry was not a
    // place. This guards the answer, not the method.
    for (const r of removals) {
      expect(web.find((c) => c.id === r.id)).toBeUndefined();
      expect(native.find((c) => c.id === r.id)).toBeUndefined();
    }
  });

  it("carries no leftover Wikipedia disambiguator", () => {
    // Article titles say "Tampa, Florida" and "Bard, Aosta Valley"; the cities
    // are called Tampa and Bard.
    //
    // Parentheses are NOT a disambiguator here: "Halle (Saale)" and "Frankfurt
    // (Oder)" carry their river because that is the name. And a comma belongs
    // in the handful of places whose name contains one.
    const REAL_COMMAS = ["Washington, D.C."];
    const withComma = web.filter((c) => /,\s/.test(c.n) && !REAL_COMMAS.includes(c.n));
    expect(withComma.map((c) => c.n)).toEqual([]);
  });
});

describe("city tiers", () => {
  it("keeps the six corrections applied", () => {
    for (const o of overrides) {
      const city = web.find((c) => c.id === o.id);
      expect({ id: o.id, name: city?.n, tier: city?.t }).toEqual({ id: o.id, name: o.name, tier: o.to });
    }
  });

  it("has no village left in the top tier", () => {
    // A mega city is somewhere a person would plan a trip to. Every small entry
    // that stays is a national capital, a US state capital or a heritage site —
    // checked against Wikidata, not by eye — and those are legitimate.
    const KNOWN_SMALL = ["Vatican City", "Monaco", "Gibraltar", "Nicosia"];
    const tiny = web.filter((c) => c.t === "mega" && (c.p || 0) < 50000 && !KNOWN_SMALL.includes(c.n));
    expect(tiny.map((c) => `${c.n} (${c.p})`)).toEqual([]);
  });

  it("still ranks by something that descends", () => {
    // The tiers were checked against the POI data and they hold up: average
    // sights per city fall 120 / 79 / 62 / 41 across mega to hidden. This is the
    // cheap version — median population must fall too.
    const median = (t) => {
      const pops = web.filter((c) => c.t === t).map((c) => c.p || 0).sort((a, b) => a - b);
      return pops[Math.floor(pops.length / 2)];
    };
    const [mega, major, notable, hidden] = ["mega", "major", "notable", "hidden"].map(median);
    expect(mega).toBeGreaterThan(major);
    expect(major).toBeGreaterThan(notable);
    expect(notable).toBeGreaterThan(hidden);
  });
});

describe("the two copies of the index", () => {
  it("agree on every city, name and tier", () => {
    // They differ deliberately in one way — `img` is percent-encoded on native —
    // and must differ in no other.
    expect(native.length).toBe(web.length);
    const byId = new Map(native.map((c) => [c.id, c]));
    const drift = [];
    for (const c of web) {
      const n = byId.get(c.id);
      if (!n) { drift.push(`${c.id} lipsește din nativ`); continue; }
      for (const k of ["n", "c", "t", "r", "p", "co"]) {
        if (JSON.stringify(c[k]) !== JSON.stringify(n[k])) drift.push(`${c.id}.${k}`);
      }
    }
    expect(drift).toEqual([]);
  });
});
