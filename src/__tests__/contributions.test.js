import { describe, it, expect } from "vitest";
import {
  sanitizePois, isCityId, metres, MAX_DISTANCE_M, CATEGORIES,
} from "../../server/contributions.js";
import { STOP_CATEGORIES } from "../shared/poiDest.js";

// What the only unauthenticated write in the app will accept.
//
// /api/contribute-pois takes objectives from any client, with no account and no
// token, because that is what makes it useful: the first person to open a city
// the crawler never reached hands the result to everyone after them.
//
// None of this was tested. The rules lived inline in the endpoint, below
// `if (!admin) return 503`, and the server tests run with no Supabase
// credentials — so every request in them stopped at that line and not one rule
// was ever exercised. The proximity rule below did not exist at all.

const PARIS = [48.8566, 2.3522];

const poi = (over = {}) => ({
  name: "Muzeul Luvru",
  category: "museum",
  tags: ["culture"],
  ll: [48.8606, 2.3376],
  ...over,
});

const six = (over = {}) => Array.from({ length: 6 }, (_, i) => poi({ name: `Loc ${i}`, ...over }));

describe("where an objective is allowed to be", () => {
  it("accepts places in the city", () => {
    expect(sanitizePois(six(), PARIS).pois).toHaveLength(6);
  });

  it("refuses a valid coordinate on the other side of the world", () => {
    // This is the hole the rule was added for. Before it, six entries in the
    // middle of the Pacific — or all six at one chosen street address — were a
    // legitimate contribution for Paris, and every later visitor got them.
    const pacific = six({ ll: [0, -140] });
    const { pois, dropped } = sanitizePois(pacific, PARIS);
    expect(pois).toEqual([]);
    expect(dropped.distance).toBe(6);
  });

  it("drops only the strays, keeping a good contribution", () => {
    const mixed = [...six(), poi({ name: "Departe", ll: [0, -140] })];
    const { pois, dropped } = sanitizePois(mixed, PARIS);
    expect(pois).toHaveLength(6);
    expect(dropped.distance).toBe(1);
    expect(pois.map((p) => p.name)).not.toContain("Departe");
  });

  it("is generous enough never to reject what the app itself sends", () => {
    // osmLive.js asks within 4.5 km of the centre; the batch crawler goes to
    // 5 km and its barren-retry to 20 km. All of that has to pass.
    expect(MAX_DISTANCE_M).toBeGreaterThan(20000);
    const twenty = sanitizePois([poi({ ll: [48.8566 + 0.18, 2.3522] })], PARIS);
    expect(metres(PARIS, [48.8566 + 0.18, 2.3522])).toBeGreaterThan(19000);
    expect(twenty.pois).toHaveLength(1);
  });

  it("fails open when the city row has no coordinates", () => {
    // Rejecting everything for a city whose own record is incomplete would be
    // the wrong way round.
    expect(sanitizePois(six({ ll: [0, -140] }), null).pois).toHaveLength(6);
  });
});

describe("what gets stripped", () => {
  it("keeps only a http(s) website", () => {
    // Rendered to users as "Site: …". Plain text on both platforms, so a
    // javascript: URL is not clickable and this is not a hole — but
    // attacker-controlled text beside a real place is a phishing line.
    const cases = [
      ["https://louvre.fr", "https://louvre.fr"],
      ["http://louvre.fr", "http://louvre.fr"],
      ["javascript:alert(1)", undefined],
      ["data:text/html,<script>", undefined],
      ["  https://louvre.fr  ", "https://louvre.fr"],
      ["louvre.fr", undefined],
      [42, undefined],
    ];
    for (const [given, expected] of cases) {
      const [out] = sanitizePois([poi({ website: given })], PARIS).pois;
      expect(out.website, String(given)).toBe(expected);
    }
  });

  it("caps every string, because the sender is a stranger", () => {
    const [out] = sanitizePois([poi({
      name: "n".repeat(500), wiki: "w".repeat(900), hours: "h".repeat(900), img: "i".repeat(900),
      tags: Array.from({ length: 40 }, (_, i) => `t${i}`),
    })], PARIS).pois;
    expect(out.name.length).toBe(120);
    expect(out.wiki.length).toBe(200);
    expect(out.hours.length).toBe(200);
    expect(out.img.length).toBe(300);
    expect(out.tags.length).toBe(4);
  });

  it("drops anything the app does not read", () => {
    const [out] = sanitizePois([poi({ evil: "x", __proto__: { y: 1 }, charge: "5 EUR" })], PARIS).pois;
    expect(Object.keys(out).sort()).toEqual(
      ["category", "hours", "img", "ll", "name", "tags", "website", "wiki"],
    );
  });

  it("refuses a NaN or infinite coordinate", () => {
    for (const ll of [[NaN, 2], [48, Infinity], ["48", "2"], [48], null]) {
      expect(sanitizePois([poi({ ll })], PARIS).pois, JSON.stringify(ll)).toEqual([]);
    }
  });

  it("refuses a category the app cannot place", () => {
    const { pois, dropped } = sanitizePois([poi({ category: "fuel" }), poi({ category: "" })], PARIS);
    expect(pois).toEqual([]);
    expect(dropped.category).toBe(2);
  });

  it("refuses a name that is blank or one character", () => {
    const { dropped } = sanitizePois([poi({ name: " " }), poi({ name: "a" }), poi({ name: 7 })], PARIS);
    expect(dropped.shape).toBe(3);
  });
});

describe("the category list", () => {
  it("covers every category that can become an itinerary stop", () => {
    // The inline version left out bar, nightclub, livemusic and casino, so a
    // contributed city arrived with no nightlife at all while "nightlife"
    // stayed a selectable interest — the same bug poiDest.js documents having
    // already been fixed once on the read side.
    for (const c of STOP_CATEGORIES) expect(CATEGORIES.has(c), c).toBe(true);
  });

  it("covers the two that become food suggestions", () => {
    expect(CATEGORIES.has("restaurant")).toBe(true);
    expect(CATEGORIES.has("cafe")).toBe(true);
  });
});

describe("the city id", () => {
  it("is a Wikidata Q-id and nothing else", () => {
    for (const ok of ["Q90", "Q1", "Q154705"]) expect(isCityId(ok), ok).toBe(true);
    for (const no of ["Q", "90", "q90", "Q90; drop table", "", null, undefined, 90, "Q90 "]) {
      expect(isCityId(no), String(no)).toBe(false);
    }
  });
});
