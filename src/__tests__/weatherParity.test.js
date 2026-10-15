import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { codeInfo as webCodeInfo } from "../shared/weather.js";
import { codeInfo as nativeCodeInfo } from "../../mobile-native/src/shared/weather.js";

// The weather icon on a phone was always a thermometer.
//
// Three things were right and one was left behind. icons.js maps codes —
// clear, partly, fog, rain, snow, showers, storm — to sun, cloud and lightning
// glyphs. Route.js renders <WeatherIcon code={w.code} />. The i18n dictionary
// carries wx_clear, wx_rain and the rest in all sixteen languages.
//
// But mobile-native/src/lib/weather.js returned `{ emoji, label }` with the
// label hardcoded in Romanian — a leftover from before the web copy was fixed.
// So `w.code` was undefined for every day of every trip, WeatherIcon fell
// through to its Thermometer default, and the Romanian labels it did compute
// were never displayed at all.
//
// Two hand-maintained copies of one function, one of them fixed. This test is
// the thing that was missing.

const CODES = ["clear", "partly", "fog", "rain", "snow", "showers", "storm"];

// Open-Meteo WMO codes, one from each band the function distinguishes.
const SAMPLES = [
  [0, "clear"], [2, "partly"], [45, "fog"], [48, "fog"], [51, "rain"], [67, "rain"],
  [71, "snow"], [77, "snow"], [85, "snow"], [86, "snow"], [81, "showers"], [95, "storm"], [99, "storm"],
];

describe("the weather code", () => {
  it("is what the icon table and the dictionary expect", () => {
    for (const [wmo, expected] of SAMPLES) {
      expect(nativeCodeInfo(wmo).code, `WMO ${wmo}`).toBe(expected);
    }
  });

  it("is one file, not two that agree today", () => {
    // Comparing the two functions' output would pass trivially now that both
    // sides import the same shared module — and it would also have passed, for
    // a while, back when they were separate copies that had not yet drifted.
    // What actually prevents this bug is there being one file.
    const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
    const web = read("src/shared/weather.js");
    const native = read("mobile-native/src/shared/weather.js").replace(/^\/\/ SYNCED[^\n]*\n/, "");
    expect(native).toBe(web);
    // And both platforms read it from there, rather than keeping a copy.
    expect(fs.existsSync("mobile-native/src/lib/weather.js")).toBe(false);
    expect(fs.existsSync("src/weather.js")).toBe(false);
    for (const screen of ["src/screens/Route.jsx", "mobile-native/src/screens/Route.js"]) {
      expect(fs.readFileSync(screen, "utf8"), screen).toContain('from "../shared/weather.js"');
    }
  });

  it("still behaves the same read through either path", () => {
    for (const [wmo] of SAMPLES) expect(nativeCodeInfo(wmo)).toEqual(webCodeInfo(wmo));
  });

  it("carries no label the UI would have to translate at render time", () => {
    // A hardcoded "parțial noros" reached Japanese, Korean and Greek users.
    for (const [wmo] of SAMPLES) expect(nativeCodeInfo(wmo).label).toBeUndefined();
  });
});

describe("the pieces that were already right", () => {
  it("has an icon for every code the function can return", () => {
    const icons = fs.readFileSync("mobile-native/src/icons.js", "utf8");
    const table = icons.slice(icons.indexOf("const WX_ICONS"), icons.indexOf("export function WeatherIcon"));
    for (const code of CODES) expect(table, code).toContain(`${code}:`);
  });

  it("has a translation for every code, in every language", () => {
    // The keys existed in all sixteen before this was fixed, and were unused.
    const dict = fs.readFileSync("mobile-native/src/lib/i18n.js", "utf8");
    for (const code of CODES) {
      const langs = dict.split(`wx_${code}:`).length - 1;
      expect(langs, `wx_${code}`).toBeGreaterThanOrEqual(16);
    }
  });
});
