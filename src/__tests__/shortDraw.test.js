import { describe, it, expect } from "vitest";
import { DRAW, DRAW_SOURCE, PALETTE } from "../shortDraw.js";

// Records every call made against a canvas context, so two renderers can be
// compared by what they actually drew rather than by reading both.
function recorder() {
  const calls = [];
  const handler = {
    get(_target, prop) {
      if (prop === "calls") return calls;
      if (prop === "measureText") return (s) => ({ width: String(s).length * 10 });
      if (prop === "createLinearGradient") {
        return (...a) => {
          calls.push(["createLinearGradient", ...a]);
          return { __gradient: true, addColorStop: (...b) => calls.push(["addColorStop", ...b]) };
        };
      }
      if (prop === "canvas") return undefined;
      return (...args) => calls.push([String(prop), ...args]);
    },
    // A gradient is recorded as a marker, not as itself: it carries a function,
    // and two structurally identical gradients would compare unequal by
    // reference — a difference in the recorder, not in the drawing.
    set(_target, prop, value) {
      calls.push(["set:" + String(prop), value && value.__gradient ? "<gradient>" : value]);
      return true;
    },
  };
  return new Proxy({}, handler);
}

const img = (w, h) => ({ width: w, height: h });

describe("DRAW_SOURCE", () => {
  it("evaluates to an object with the same methods", () => {
    // eslint-disable-next-line no-new-func
    const evaluated = new Function(`${DRAW_SOURCE}; return DRAW;`)();
    expect(Object.keys(evaluated).sort()).toEqual(Object.keys(DRAW).sort());
  });

  it("draws a card identically to the module it came from", () => {
    // eslint-disable-next-line no-new-func
    const evaluated = new Function(`${DRAW_SOURCE}; return DRAW;`)();
    const a = recorder();
    const b = recorder();
    const opts = { title: "Timisoara and the long name", sub: "6 photos", t: 0.5, dur: 2 };
    DRAW.card(a, 1080, 1920, opts);
    evaluated.card(b, 1080, 1920, opts);
    expect(b.calls).toEqual(a.calls);
    expect(a.calls.length).toBeGreaterThan(5);
  });

  it("draws a photo identically, chip and crossfade included", () => {
    // eslint-disable-next-line no-new-func
    const evaluated = new Function(`${DRAW_SOURCE}; return DRAW;`)();
    const a = recorder();
    const b = recorder();
    const opts = { img: img(4000, 3000), next: img(1000, 1000), t: 0.9, caption: "A caption long enough to wrap twice over", dayText: "Day 2" };
    DRAW.photo(a, 720, 1280, opts);
    evaluated.photo(b, 720, 1280, opts);
    expect(b.calls).toEqual(a.calls);
  });
});

describe("scaling", () => {
  const fontsFrom = (calls) => calls.filter((c) => c[0] === "set:font").map((c) => parseInt(String(c[1]).match(/(\d+)px/)[1], 10));

  it("draws the phone frame as the same picture, two thirds the size", () => {
    const big = recorder();
    const small = recorder();
    const opts = { title: "Roma", sub: "9 photos", t: 1, dur: 2 };
    DRAW.card(big, 1080, 1920, opts);
    DRAW.card(small, 720, 1280, opts);

    const bigFonts = fontsFrom(big.calls);
    const smallFonts = fontsFrom(small.calls);
    expect(smallFonts).toHaveLength(bigFonts.length);
    bigFonts.forEach((size, i) => {
      // 1280/1920 = 2/3, allowing for the rounding to whole pixels.
      expect(smallFonts[i]).toBe(Math.round(size * (1280 / 1920)));
    });
  });

  it("keeps the full-size numbers the web renderer used before the split", () => {
    const c = recorder();
    DRAW.card(c, 1080, 1920, { title: "X", sub: "y", t: 1, dur: 2 });
    expect(fontsFrom(c.calls)).toEqual([96, 44]);

    const p = recorder();
    DRAW.photo(p, 1080, 1920, { img: img(100, 100), t: 0.5, caption: "c", dayText: "Day 1" });
    expect(fontsFrom(p.calls)).toEqual([60, 38]);
  });
});

describe("wrapText", () => {
  it("never returns more than three lines", () => {
    const c = recorder();
    const long = Array.from({ length: 60 }, (_, i) => `w${i}`).join(" ");
    expect(DRAW.wrapText(c, long, 200).length).toBe(3);
  });

  it("returns no lines at all for empty text, so nothing is drawn", () => {
    const c = recorder();
    expect(DRAW.wrapText(c, null, 200)).toEqual([]);
    expect(DRAW.wrapText(c, undefined, 200)).toEqual([]);
    expect(DRAW.wrapText(c, "", 200)).toEqual([]);
  });
});

describe("the shared copy", () => {
  it("is byte-identical to the native one", async () => {
    const fs = await import("node:fs");
    const web = fs.readFileSync("src/shortDraw.js", "utf8");
    const native = fs.readFileSync("mobile-native/src/lib/shortDraw.js", "utf8");
    expect(native.replace(/\r\n/g, "\n")).toBe(web.replace(/\r\n/g, "\n"));
  });

  it("produces a WebView page that is valid JavaScript", async () => {
    const { buildShortRenderHtml } = await import("../../mobile-native/src/lib/shortRenderHtml.js");
    const html = buildShortRenderHtml({
      scenes: [{ dataUrl: "data:,", day: 1, place: "P", caption: "c", sec: 1.7 }],
      starts: [0],
      photoTime: 1.7,
      labels: { title: "T", subtitle: "s", dayPrefix: "Day", outro: "o" },
    });
    const script = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));
    // A syntax error here would only ever surface as a WebView that renders
    // nothing, on a phone, with no error anywhere.
    // eslint-disable-next-line no-new-func
    expect(() => new Function(script)).not.toThrow();
    expect(script).toContain("const DRAW = {");
  });
});

describe("photoFill", () => {
  // The last drawImage in the sequence is the sharp photo; the first is the
  // blurred backdrop behind it.
  const draws = (calls) => calls.filter((c) => c[0] === "drawImage");

  it("keeps a landscape photo whole inside a 9:16 frame", () => {
    const c = recorder();
    const W = 1080, H = 1920;
    DRAW.photoFill(c, img(4000, 2250), W, H, 1);   // 16:9 into 9:16
    const [, , x, y, w, h] = draws(c.calls).at(-1);
    expect(w).toBeLessThanOrEqual(W + 0.001);
    expect(h).toBeLessThanOrEqual(H + 0.001);
    expect(x).toBeGreaterThanOrEqual(-0.001);
    expect(y).toBeGreaterThanOrEqual(-0.001);
    // The whole width is used, so nothing along it was cut.
    expect(w).toBeCloseTo(W, 5);
  });

  it("keeps a portrait photo whole too", () => {
    const c = recorder();
    const W = 720, H = 1280;
    DRAW.photoFill(c, img(900, 1600), W, H, 1);
    const [, , x, y, w, h] = draws(c.calls).at(-1);
    expect(w).toBeLessThanOrEqual(W + 0.001);
    expect(h).toBeLessThanOrEqual(H + 0.001);
    expect(x).toBeGreaterThanOrEqual(-0.001);
    expect(y).toBeGreaterThanOrEqual(-0.001);
  });

  it("fills the frame behind it, so no bar is ever empty", () => {
    const c = recorder();
    const W = 1080, H = 1920;
    DRAW.photoFill(c, img(4000, 2250), W, H, 1);
    const [, , x, y, w, h] = draws(c.calls)[0];   // the backdrop
    expect(x).toBeLessThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(0);
    expect(x + w).toBeGreaterThanOrEqual(W);
    expect(y + h).toBeGreaterThanOrEqual(H);
  });

  it("draws the backdrop first and the photo last", () => {
    const c = recorder();
    DRAW.photoFill(c, img(4000, 2250), 1080, 1920, 1);
    expect(draws(c.calls)).toHaveLength(2);
  });

  it("gives the photo an edge, so it reads as an object on a ground", () => {
    // Without a shadow the sharp photo and its own blurred backdrop had no
    // boundary: it looked like a blurry picture with a focused middle, worst
    // of all on a panorama, where the sharp part is a thin strip.
    const c = recorder();
    DRAW.photoFill(c, img(4000, 2250), 1080, 1920, 1);
    const shadows = c.calls.filter((x) => x[0] === "set:shadowBlur").map((x) => x[1]);
    expect(shadows.some((v) => v > 0)).toBe(true);
    // And it is scoped, so the caption drawn afterwards is not shadowed too.
    expect(c.calls.some((x) => x[0] === "save")).toBe(true);
    expect(c.calls.some((x) => x[0] === "restore")).toBe(true);
  });

  it("lifts a landscape photo off dead centre, clearing the caption band", () => {
    const W = 1080, H = 1920;
    const c = recorder();
    DRAW.photoFill(c, img(4000, 2250), W, H, 1);
    const [, , , y, , h] = draws(c.calls).at(-1);
    const centred = (H - h) / 2;
    expect(y).toBeLessThan(centred);      // raised
    expect(y).toBeGreaterThanOrEqual(0);  // but still inside the frame
  });

  it("does not move a photo that already fills the height", () => {
    // A 9:16 photo in a 9:16 frame has no gap to lift into, and nudging it
    // would push its top out of frame.
    const W = 720, H = 1280;
    const c = recorder();
    DRAW.photoFill(c, img(720, 1280), W, H, 1);
    const [, , , y] = draws(c.calls).at(-1);
    expect(y).toBeCloseTo(0, 5);
  });
});

describe("palette", () => {
  it("matches the colours the drawing actually uses", () => {
    const c = recorder();
    DRAW.card(c, 1080, 1920, { title: "X", sub: "y", t: 1, dur: 2 });
    const styles = c.calls.filter((x) => x[0] === "set:fillStyle").map((x) => x[1]);
    expect(styles).toContain(PALETTE.ink);
    expect(styles).toContain(PALETTE.gold);
    expect(styles).toContain(PALETTE.cream);
  });
});
