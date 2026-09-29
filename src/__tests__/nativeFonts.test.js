import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// How the native app imports its fonts, and why the shape of the import is the
// whole point.
//
// @expo-google-fonts packages ship every weight of a family — 32 files across
// the two used here. Importing from the package ROOT pulls in its index, which
// `require`s all of them, and Metro bundles what it can see rather than what is
// used. Measured in an export: 2706 KB of fonts shipped, 675 KB ever read.
// Switching to one import per weight took the app from 9.09 MB to 7.09 MB.
//
// Nothing about that is visible in the app: the fonts render identically either
// way. It shows up only as two megabytes of download.

const fonts = fs.readFileSync("mobile-native/src/fonts.js", "utf8");

const USED = [
  ["fraunces", "500Medium", "Fraunces_500Medium"],
  ["fraunces", "600SemiBold", "Fraunces_600SemiBold"],
  ["fraunces", "700Bold", "Fraunces_700Bold"],
  ["plus-jakarta-sans", "400Regular", "PlusJakartaSans_400Regular"],
  ["plus-jakarta-sans", "500Medium", "PlusJakartaSans_500Medium"],
  ["plus-jakarta-sans", "600SemiBold", "PlusJakartaSans_600SemiBold"],
  ["plus-jakarta-sans", "700Bold", "PlusJakartaSans_700Bold"],
  ["plus-jakarta-sans", "800ExtraBold", "PlusJakartaSans_800ExtraBold"],
];

describe("font imports", () => {
  it("never imports a family from its package root", () => {
    // `from "@expo-google-fonts/fraunces"` — the two megabyte mistake.
    const barrels = [...fonts.matchAll(/from\s+"(@expo-google-fonts\/[^"/]+)"/g)].map((m) => m[1]);
    expect(barrels).toEqual([]);
  });

  it("imports each weight from its own subpath", () => {
    for (const [pkg, weight] of USED) {
      expect(fonts).toContain(`from "@expo-google-fonts/${pkg}/${weight}"`);
    }
  });

  it("registers exactly the weights it imports", () => {
    const map = fonts.slice(fonts.indexOf("FONT_MAP"));
    const registered = [...map.matchAll(/^\s+([A-Za-z]+_[A-Za-z0-9]+),\s*$/gm)].map((m) => m[1]);
    expect(registered.sort()).toEqual(USED.map(([, , name]) => name).sort());
  });
});

describe("the weights actually exist", () => {
  // A subpath that does not resolve fails at bundle time, not here — but a
  // typo caught in a test is cheaper than a failed build.
  it.each(USED)("%s/%s ships a font file", (pkg, weight) => {
    const dir = path.join("mobile-native", "node_modules", "@expo-google-fonts", pkg, weight);
    expect(fs.existsSync(dir)).toBe(true);
    const ttf = fs.readdirSync(dir).filter((f) => /\.ttf$/i.test(f));
    expect(ttf.length).toBe(1);
  });

  it("costs what it is expected to cost", () => {
    // If this climbs, something started bundling more than the eight.
    let total = 0;
    for (const [pkg, weight] of USED) {
      const dir = path.join("mobile-native", "node_modules", "@expo-google-fonts", pkg, weight);
      const ttf = fs.readdirSync(dir).find((f) => /\.ttf$/i.test(f));
      total += fs.statSync(path.join(dir, ttf)).size;
    }
    expect(total).toBeLessThan(900 * 1024);
    expect(total).toBeGreaterThan(400 * 1024);
  });
});
