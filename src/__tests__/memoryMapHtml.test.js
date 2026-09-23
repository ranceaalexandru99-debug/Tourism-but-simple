import { describe, it, expect } from "vitest";
import { buildMemoryMapHtml, TILE_URL } from "../../mobile-native/src/lib/memoryMapHtml.js";

// The photo map is a page built as a string and loaded into a WebView, the
// same shape as the short renderer — which a photo caption was once able to
// inject script into. This one carries photo ids and data URLs, so the same
// care applies.

const colors = { gold: "#C9A84C", card: "#162840", bg: "#0A1628" };
const pin = (over = {}) => ({ id: "m1", ll: [45.64, 25.58], dataUrl: "data:image/jpeg;base64,AAAA", ...over });

const scriptTags = (html) => (html.match(/<script/g) || []).length;

describe("buildMemoryMapHtml", () => {
  it("plots every pin it is given", () => {
    const html = buildMemoryMapHtml([pin({ id: "a" }), pin({ id: "b" })], colors);
    expect(html).toContain('"a"');
    expect(html).toContain('"b"');
  });

  it("uses the same tiles as the web map, so the two look alike", () => {
    expect(TILE_URL).toContain("basemaps.cartocdn.com");
    expect(buildMemoryMapHtml([pin()], colors)).toContain("basemaps.cartocdn.com");
  });

  it("shows each photo whole, over a blurred copy — as the grid does", () => {
    const html = buildMemoryMapHtml([pin()], colors);
    expect(html).toContain("object-fit:contain");
    expect(html).toContain("blur(");
  });

  it("cannot be broken out of by a photo id", () => {
    // Ids are generated, but they reach a <script> block, and "generated" is
    // an assumption about code elsewhere rather than a guarantee here.
    const html = buildMemoryMapHtml([pin({ id: 'x"</script><script>window.PWNED=1;//' })], colors);
    const opens = (html.match(/<script[ >]/g) || []).length;
    const closes = (html.match(/<\/script>/g) || []).length;
    expect(opens).toBe(closes);
    const body = html.slice(html.indexOf("const PINS"), html.indexOf("</script>", html.indexOf("const PINS")));
    expect(body).not.toContain("</script>");
  });

  it("produces a page that is valid JavaScript", () => {
    const html = buildMemoryMapHtml([pin({ id: "</script>" })], colors);
    const start = html.indexOf("const PINS");
    const script = html.slice(start, html.indexOf("</script>", start));
    // eslint-disable-next-line no-new-func
    expect(() => new Function("L", "window", script)).not.toThrow();
  });

  it("carries the right number of script blocks — Leaflet plus ours", () => {
    expect(scriptTags(buildMemoryMapHtml([pin()], colors))).toBe(2);
  });

  it("copes with no pins at all, rather than producing a broken page", () => {
    const html = buildMemoryMapHtml([], colors);
    expect(html).toContain("const PINS = []");
    expect(() => new Function("L", "window", html.slice(html.indexOf("const PINS"), html.indexOf("</script>", html.indexOf("const PINS"))))).not.toThrow();
  });
});
