import { describe, it, expect } from "vitest";
import fs from "node:fs";

// The screen someone sees when the app has already failed them.
//
// It used to be Romanian with an English line underneath — a reasonable
// shortcut when the app was Romanian-first, and a poor thing to show a Japanese
// user at the worst moment in the app. The boundary sits outside the i18n
// provider, so it carries its own table rather than importing the module it may
// be catching.

const src = fs.readFileSync("mobile-native/src/components/ErrorBoundary.js", "utf8");
const LANGS = ["en", "ro", "fr", "es", "it", "de", "pt", "nl", "pl", "ru", "zh", "ja", "tr", "el", "uk", "ko"];

const block = src.slice(src.indexOf("const COPY = {"), src.indexOf("};", src.indexOf("const COPY = {")));
const entry = (lang) =>
  block.match(new RegExp(`\\n  ${lang}: \\{ title: "([^"]*)", body: "([^"]*)", retry: "([^"]*)" \\}`));

describe("the crash screen", () => {
  it("speaks all sixteen languages", () => {
    const missing = LANGS.filter((l) => !entry(l));
    expect(missing).toEqual([]);
  });

  it("has no English left in the non-Latin scripts", () => {
    // Caught a real one: the Chinese line read "你的数据safely保存在本机上".
    const leaks = [];
    for (const lang of ["ru", "zh", "ja", "el", "uk", "ko"]) {
      const m = entry(lang);
      const latin = (m[1] + m[2] + m[3]).match(/[A-Za-z]{3,}/g);
      if (latin) leaks.push(`${lang}: ${latin.join(", ")}`);
    }
    expect(leaks).toEqual([]);
  });

  it("stays independent of the i18n module", () => {
    // Importing it would couple the crash screen to something it might be
    // catching. Three short strings do not justify that.
    expect(src).not.toMatch(/from ["'].*i18n\.js["']/);
  });

  it("falls back to English when the language cannot be read", () => {
    // Storage being unreadable is a plausible reason to be here at all.
    expect(src).toContain("return COPY.en");
    expect(src).toMatch(/try \{[\s\S]*localStorage\.getItem[\s\S]*\} catch/);
  });

  it("still reports the crash it is showing", () => {
    expect(src).toContain("componentDidCatch");
    expect(src).toMatch(/report\("render"/);
  });
});
