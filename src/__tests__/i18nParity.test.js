import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// A key present in English but missing from another language renders as the raw
// key name — "authErrGeneric" shown to the user instead of a sentence. That is
// silent: nothing throws, nothing logs, and it only surfaces if someone opens
// the app in that language. Hence a test.
//
// Both dictionaries are read as text rather than imported, because src/i18n.js
// pulls in React and the native one pulls in react-native; neither loads under
// plain vitest. The files also declare several merge blocks (MORE_I18N,
// RAILS_I18N, EXPLORE_I18N, …) that are Object.assign-ed on at load, so the
// scan has to find every `<lang>: { … }` object, not just the first.

const LANGS = ["en", "ro", "fr", "es", "it", "de", "pl", "ru", "zh", "ja", "pt", "nl", "tr", "el", "uk", "ko"];
const ROOT = path.resolve(__dirname, "..", "..");

// Blank out string CONTENTS before looking for keys. Without this a value like
// "See my trip: {title}" contributes a phantom key `trip`, which exists only in
// the English copy and makes all 15 other languages look incomplete.
const blankStrings = (s) =>
  s.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g,
    (lit) => lit[0] + " ".repeat(Math.max(0, lit.length - 2)) + lit[0]);

function readDictionaries(file) {
  const src = fs.readFileSync(file, "utf8");
  const per = Object.fromEntries(LANGS.map((l) => [l, new Set()]));

  for (const lang of LANGS) {
    const re = new RegExp("(?:^|[\\s{,])" + lang + ":\\s*\\{", "g");
    let m;
    while ((m = re.exec(src))) {
      // Walk balanced braces so nested objects stay inside their own block.
      let i = src.indexOf("{", m.index + m[0].length - 1);
      const start = i;
      let depth = 0;
      for (; i < src.length; i++) {
        if (src[i] === "{") depth++;
        else if (src[i] === "}") { depth--; if (!depth) break; }
      }
      const body = blankStrings(src.slice(start + 1, i));
      for (const k of body.matchAll(/(?:^|[\s{,])([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g)) per[lang].add(k[1]);
    }
  }
  return per;
}

// The web dictionary was split into one file per language, so only that
// language's chunk is downloaded. Native keeps a single combined file: Metro
// bundles everything regardless. The scan has to handle both shapes, and the
// per-file one is the stricter check — a language that lost its whole file
// would otherwise look "complete" by having no keys to compare.
function readWebDictionaries() {
  const per = Object.fromEntries(LANGS.map((l) => [l, new Set()]));
  for (const lang of LANGS) {
    const file = path.join(ROOT, "src", "i18n", `${lang}.js`);
    const src = blankStrings(fs.readFileSync(file, "utf8"));
    for (const m of src.matchAll(/^\s{2}([A-Za-z_$][\w$]*)\s*:/gm)) per[lang].add(m[1]);
  }
  return per;
}

const TARGETS = [
  ["web", null],
  ["native", path.join(ROOT, "mobile-native", "src", "lib", "i18n.js")],
];

describe.each(TARGETS)("%s translations", (_label, file) => {
  const per = file ? readDictionaries(file) : readWebDictionaries();

  // Guards the test itself: a scanner that reads nothing would report every
  // language as complete, which is exactly the failure this test must not have.
  it("reads a substantial English dictionary", () => {
    expect(per.en.size).toBeGreaterThan(200);
  });

  it.each(LANGS.filter((l) => l !== "en"))("%s covers every English key", (lang) => {
    const missing = [...per.en].filter((k) => !per[lang].has(k));
    expect(missing).toEqual([]);
  });
});
