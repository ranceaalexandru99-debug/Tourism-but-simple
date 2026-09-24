import { describe, it, expect } from "vitest";
import { buildExploreMapHtml, DEFAULT_VIEW, DOT, TILE_URL } from "../../mobile-native/src/lib/exploreMapHtml.js";
import fs from "node:fs";
import { buildMemoryMapHtml } from "../../mobile-native/src/lib/memoryMapHtml.js";

// A third page built as a string for a WebView. The first one let a photo
// caption inject script; this one is the only one that takes a stored value —
// the remembered viewport — straight from device storage into a <script>.

const colors = { gold: "#C9A84C", cream: "#F2E9D8", bg: "#0A1628" };
const scriptOf = (html) => {
  const start = html.indexOf("const START");
  return html.slice(start, html.indexOf("</script>", start));
};

describe("buildExploreMapHtml", () => {
  it("opens where it is told to", () => {
    const html = buildExploreMapHtml({ center: [45.65, 25.6], zoom: 11 }, colors);
    expect(html).toContain("45.65");
    expect(html).toContain("11");
  });

  it("falls back to the default view when the stored one is nonsense", () => {
    // localStorage can hold anything — a half-written value, or something from
    // an older version of the app. A map that opens at NaN shows grey.
    for (const bad of [null, undefined, {}, { center: "x", zoom: 4 }, { center: [1], zoom: 4 }, { center: [1, 2], zoom: "far" }]) {
      const html = buildExploreMapHtml(bad, colors);
      expect(html).toContain(JSON.stringify(DEFAULT_VIEW.center[0]));
      expect(scriptOf(html)).not.toContain("NaN");
    }
  });

  it("uses the same tiles as the web map and the photo map", () => {
    expect(TILE_URL).toContain("basemaps.cartocdn.com");
    expect(buildExploreMapHtml(DEFAULT_VIEW, colors)).toContain("basemaps.cartocdn.com");
  });

  it("draws a bigger dot for a more recognisable city", () => {
    expect(DOT.mega).toBeGreaterThan(DOT.major);
    expect(DOT.major).toBeGreaterThan(DOT.notable);
    expect(DOT.notable).toBeGreaterThan(DOT.hidden);
  });

  it("cannot be broken out of by a stored viewport", () => {
    const html = buildExploreMapHtml({ center: [45, 25], zoom: 4, evil: "</script><script>window.PWNED=1;//" }, colors);
    const opens = (html.match(/<script[ >]/g) || []).length;
    const closes = (html.match(/<\/script>/g) || []).length;
    expect(opens).toBe(closes);
    expect(scriptOf(html)).not.toContain("</script>");
  });

  it("produces a page that is valid JavaScript", () => {
    const script = scriptOf(buildExploreMapHtml(DEFAULT_VIEW, colors));
    // eslint-disable-next-line no-new-func
    expect(() => new Function("L", "window", script)).not.toThrow();
  });

  it("gives React Native a way to send cities in, and get a viewport back", () => {
    const html = buildExploreMapHtml(DEFAULT_VIEW, colors);
    // The 5000-city index must stay on the native side: shipping it into the
    // WebView on every pan would be far more data than the visible markers.
    expect(html).toContain("window.setCities");
    expect(html).toContain('type: "view"');
    expect(html).toContain('type: "pick"');
    expect(html).not.toContain("destinations.json");
  });

  it("debounces the viewport it reports", () => {
    // A pinch-zoom emits several moveends in a row; each one un-debounced is
    // another full filter over 5000 cities plus a bridge round-trip.
    expect(html_contains_debounce()).toBe(true);
  });
});

describe("the WebView maps and the network", () => {
  const pages = () => [
    buildExploreMapHtml(DEFAULT_VIEW, colors),
    buildMemoryMapHtml([{ id: "m1", ll: [45, 25], dataUrl: "data:image/jpeg;base64,AA" }],
      { gold: colors.gold, card: "#162840", bg: colors.bg }),
  ];

  it("carries Leaflet itself rather than fetching it", () => {
    // Both pages used to load leaflet from unpkg.com — a service the privacy
    // policy never listed, and a second thing that had to be up before a map
    // could draw. The tiles need the network; the library does not.
    for (const html of pages()) {
      expect(html).not.toContain("unpkg.com");
      expect(html).toContain("L.tileLayer");   // still a real Leaflet page
      expect(html).toContain("leaflet-container");
    }
  });

  it("loads nothing from a remote host but the tiles", () => {
    // A URL merely APPEARING in the page proves nothing — Leaflet's own source
    // carries documentation links it never fetches. What matters is the tags
    // that actually cause a request: a script with a src, or a stylesheet link.
    // The tiles are the one deliberate exception, and they are fetched by
    // Leaflet at runtime rather than declared here.
    for (const html of pages()) {
      expect(html.match(/<script[^>]+\bsrc=/gi)).toBeNull();
      expect(html.match(/<link[^>]+\bhref=/gi)).toBeNull();
      expect(html).toContain("basemaps.cartocdn.com");
    }
  });

  it("declares every host it loads from in the privacy policy", () => {
    const legal = fs.readFileSync("src/legal.js", "utf8");
    // CARTO is the only one left. If a map ever loads from somewhere else,
    // this is where it has to be written down.
    expect(legal).toMatch(/CARTO/);
  });
});

function html_contains_debounce() {
  const s = scriptOf(buildExploreMapHtml(DEFAULT_VIEW, colors));
  return s.includes("clearTimeout") && s.includes("setTimeout");
}
