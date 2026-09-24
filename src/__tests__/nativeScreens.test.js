import { describe, it, expect } from "vitest";
import { readMapMessage } from "../../mobile-native/src/lib/mapMessage.js";
import { isView, loadView, saveView, forMap, DEFAULT_VIEW, VIEW_KEY } from "../../mobile-native/src/lib/exploreView.js";
import { headOf, replaceHead, shouldSuggest } from "../../mobile-native/src/lib/destinationInput.js";

// The logic behind the three newest native screens — Explore, MemoryMap and the
// destination input. Extracted from the components deliberately, the same way
// shortCollector was pulled out of ShortRenderer: none of it needs a renderer,
// and all of it is the part that can silently do the wrong thing.

const storage = (initial) => {
  const map = new Map(initial ? Object.entries(initial) : []);
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    _map: map,
  };
};

describe("reading a message from a WebView map", () => {
  const view = {
    type: "view",
    bounds: { south: 44, west: 20, north: 48, east: 30 },
    center: [46, 25],
    zoom: 7,
  };

  it("accepts a viewport the map really reported", () => {
    expect(readMapMessage(JSON.stringify(view))).toEqual(view);
  });

  it("returns null rather than throwing on anything unreadable", () => {
    // This runs inside onMessage. Anything that throws there takes the screen
    // down, and the user is left looking at a map that stopped responding.
    for (const bad of ["", "{", "null", "[]", '"a string"', "17", JSON.stringify({ type: "nope" })]) {
      expect(() => readMapMessage(bad)).not.toThrow();
      expect(readMapMessage(bad)).toBeNull();
    }
  });

  it("refuses a viewport with a NaN or a missing edge", () => {
    // A NaN compares false against everything, so it does not error — it just
    // silently selects no cities, which reads as "there is nothing here".
    const broken = [
      { ...view, bounds: { ...view.bounds, south: null } },
      { ...view, bounds: { ...view.bounds, north: "48" } },
      { ...view, bounds: {} },
      { ...view, zoom: "7" },
    ];
    for (const b of broken) expect(readMapMessage(JSON.stringify(b))).toBeNull();
    // NaN does not survive JSON, so it has to be fed in directly.
    expect(readMapMessage('{"type":"view","bounds":{"south":1e999,"west":0,"north":2,"east":3},"zoom":4}')).toBeNull();
  });

  it("refuses a viewport whose south is north of its north", () => {
    expect(readMapMessage(JSON.stringify({ ...view, bounds: { south: 50, west: 20, north: 40, east: 30 } }))).toBeNull();
  });

  it("allows longitudes past the date line, because Leaflet reports them", () => {
    // Panning west of the antimeridian gives bounds like west=174, east=190.
    // Rejecting those would break exactly the case lonRanges exists to handle.
    const wrapped = { ...view, bounds: { south: -40, west: 174, north: -10, east: 190 } };
    expect(readMapMessage(JSON.stringify(wrapped))?.bounds.east).toBe(190);
  });

  it("keeps the viewport even when the centre is unusable", () => {
    // The centre only decides where the map reopens. Throwing away a whole
    // viewport over it would stop the cities loading at all.
    const msg = readMapMessage(JSON.stringify({ ...view, center: ["x", "y"] }));
    expect(msg?.type).toBe("view");
    expect(msg.center).toBeNull();
  });

  it("takes a pick only with a real id", () => {
    expect(readMapMessage(JSON.stringify({ type: "pick", id: "Q90" }))).toEqual({ type: "pick", id: "Q90" });
    for (const id of [null, 42, "", { }, ["Q90"]]) {
      expect(readMapMessage(JSON.stringify({ type: "pick", id }))).toBeNull();
    }
  });

  it("understands ready and error without insisting on their details", () => {
    expect(readMapMessage(JSON.stringify({ type: "ready", pins: 3 }))).toEqual({ type: "ready", pins: 3 });
    expect(readMapMessage(JSON.stringify({ type: "ready" }))).toEqual({ type: "ready", pins: null });
    expect(readMapMessage(JSON.stringify({ type: "error", reason: "boom" })).reason).toBe("boom");
    expect(readMapMessage(JSON.stringify({ type: "error" })).reason).toBe("");
  });
});

describe("remembering where the explore map was", () => {
  it("reopens where the user left off", () => {
    const s = storage();
    saveView(s, { center: [45.65, 25.6], zoom: 11 });
    expect(loadView(s)).toEqual({ center: [45.65, 25.6], zoom: 11 });
  });

  it("falls back to the default rather than opening on grey", () => {
    for (const stored of ['{"center":[45]}', "{not json", "null", '{"center":[1,2],"zoom":"far"}', '{"center":["a","b"],"zoom":4}']) {
      expect(loadView(storage({ [VIEW_KEY]: stored }))).toEqual(DEFAULT_VIEW);
    }
    expect(loadView(storage())).toEqual(DEFAULT_VIEW);
  });

  it("reports a write it could not make, instead of pretending", () => {
    const full = { getItem: () => null, setItem: () => { throw new Error("QuotaExceeded"); } };
    expect(saveView(full, { center: [1, 2], zoom: 4 })).toBe(false);
    expect(saveView(storage(), { center: [1, 2], zoom: 4 })).toBe(true);
  });

  it("refuses to store a viewport it would not read back", () => {
    // Writing something loadView rejects means the map silently forgets where
    // it was, every time, with nothing to show for the write.
    const s = storage();
    expect(saveView(s, { center: [1], zoom: 4 })).toBe(false);
    expect(saveView(s, null)).toBe(false);
    expect(s._map.size).toBe(0);
  });

  it("agrees with itself about what a viewport is", () => {
    const s = storage();
    for (const v of [{ center: [0, 0], zoom: 2 }, { center: [-89.9, 179.9], zoom: 19 }]) {
      expect(isView(v)).toBe(true);
      expect(saveView(s, v)).toBe(true);
      expect(loadView(s)).toEqual(v);
    }
  });
});

describe("what crosses into the map page", () => {
  const city = {
    id: "Q90", n: "Paris", c: "FR", ll: [48.85, 2.35],
    p: 2103778, r: 361, co: "EU", t: "mega",
    img: "La%20Tour%20Eiffel.jpg",
  };

  it("sends only what a dot needs", () => {
    expect(forMap(city)).toEqual({ id: "Q90", ll: [48.85, 2.35], t: "mega", r: 361 });
  });

  it("leaves the name, country, population and photo behind", () => {
    // This runs on every pan, up to 120 cities at a time. The photo filename
    // alone is longer than everything the page actually draws with.
    const sent = forMap(city);
    for (const key of ["n", "c", "p", "co", "img"]) expect(sent).not.toHaveProperty(key);
    expect(JSON.stringify(sent).length).toBeLessThan(JSON.stringify(city).length / 2);
  });
});

describe("the destination field", () => {
  it("treats only the text before the first comma as a place", () => {
    expect(headOf("Rome, 3 days, food")).toBe("Rome");
    expect(headOf("  Braşov  ")).toBe("Braşov");
    expect(headOf("")).toBe("");
    expect(headOf(null)).toBe("");
  });

  it("replaces the city without touching what the trip is about", () => {
    expect(replaceHead("Rom, 3 days, food", "Rome")).toBe("Rome, 3 days, food");
    expect(replaceHead("Rom", "Rome")).toBe("Rome");
    expect(replaceHead("", "Rome")).toBe("Rome");
  });

  it("survives a round trip through both", () => {
    const text = "Buc, 2 zile, mâncare";
    expect(headOf(replaceHead(text, "Bucharest"))).toBe("Bucharest");
  });

  it("stays quiet until there is something to search for", () => {
    expect(shouldSuggest("R", null)).toBe(false);
    expect(shouldSuggest("Ro", null)).toBe(true);
    expect(shouldSuggest(" , 3 days", null)).toBe(false);
  });

  it("stays quiet about a city already chosen", () => {
    // Otherwise the list reopens over the text every time the user adds a
    // detail, covering what they are typing.
    expect(shouldSuggest("Rome, 3 days", "Rome")).toBe(false);
    expect(shouldSuggest("rome, 3 days", "Rome")).toBe(false);
    expect(shouldSuggest("Rome and Naples", "Rome")).toBe(true);
  });
});
