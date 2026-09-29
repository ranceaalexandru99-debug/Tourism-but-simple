import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Typography in the app's own words.
//
// The value of this test is as much what it does NOT check. A first pass
// flagged 212 "wrong Romanian diacritics" that were Turkish ş, and 63 "spaces
// before punctuation" that were correct French — applying those would have
// broken three languages to tidy one. What is left are the two things that are
// wrong in any language.

const LANGS = ["en", "ro", "fr", "es", "it", "de", "pt", "nl", "pl", "el", "tr", "uk", "ru", "zh", "ja", "ko"];

const FILES = [
  ...LANGS.map((l) => path.join("src/i18n", `${l}.js`)),
  "mobile-native/src/lib/i18n.js",
];

function stringsIn(file) {
  const src = fs.readFileSync(file, "utf8");
  const out = [];
  for (const m of src.matchAll(/([A-Za-z_$][\w$]*)\s*:\s*"((?:[^"\\]|\\.)*)"/g)) {
    out.push({
      key: m[1],
      value: m[2].replace(/\\"/g, '"'),
      at: `${file}:${src.slice(0, m.index).split("\n").length}`,
    });
  }
  return out;
}

const all = FILES.flatMap(stringsIn);

describe("the app's copy", () => {
  it("is a real amount of text, not an empty scan", () => {
    expect(all.length).toBeGreaterThan(2000);
  });

  it("closes a typographic quote the way it opened it", () => {
    // German, Polish and Romanian open with „ and must close with ”. Fifteen
    // strings opened typographically and closed with a straight ".
    const openers = ["„", "“", "«", "‘"];
    const mixed = all.filter((s) => openers.some((o) => s.value.includes(o)) && s.value.includes('"'));
    expect(mixed.map((s) => `${s.at} ${s.key}`)).toEqual([]);
  });

  it("uses an ellipsis rather than three periods", () => {
    const dots = all.filter((s) => s.value.includes("..."));
    expect(dots.map((s) => `${s.at} ${s.key}`)).toEqual([]);
  });

  it("has no stray or doubled spaces", () => {
    const bad = all.filter((s) => s.value !== s.value.trim() || /\S {2,}\S/.test(s.value));
    expect(bad.map((s) => `${s.at} ${s.key}`)).toEqual([]);
  });
});

describe("Romanian specifically", () => {
  // The primary market, and the only language where a convention can be told
  // from a mistake without guessing.
  const ro = stringsIn("src/i18n/ro.js");

  it("was read properly", () => {
    expect(ro.length).toBeGreaterThan(300);
  });

  it("uses comma-below diacritics, not the Turkish cedilla", () => {
    // ș ț, not ş ţ. Nearly identical on screen, different characters, and the
    // wrong ones render badly in many fonts.
    const cedilla = ro.filter((s) => /[şŞţŢ]/.test(s.value));
    expect(cedilla.map((s) => `${s.key} — ${s.value}`)).toEqual([]);
  });

  it("quotes the Romanian way", () => {
    // Anything that opens a quotation opens it with „.
    const wrong = ro.filter((s) => /[“”]/.test(s.value) && !s.value.includes("„"));
    expect(wrong.map((s) => `${s.key} — ${s.value}`)).toEqual([]);
  });
});

describe("what is deliberately left alone", () => {
  it("keeps Turkish ş, which is a Turkish letter", () => {
    const tr = stringsIn("src/i18n/tr.js");
    expect(tr.some((s) => /[şŞ]/.test(s.value))).toBe(true);
  });

  it("keeps the space French puts before ? and !", () => {
    // Required by French typography. A scanner that does not know this reports
    // dozens of "errors".
    const fr = stringsIn("src/i18n/fr.js");
    expect(fr.some((s) => /\s[?!]/.test(s.value))).toBe(true);
  });
});
