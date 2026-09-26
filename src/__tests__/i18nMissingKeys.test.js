import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Every t("literal") in the app, checked against the English dictionary.
//
// The sibling test (i18nCallSites) catches t(bareIdentifier), which crashes.
// This catches the quieter one: a key that is simply not in the table renders
// as its own name, so the user reads "galPermDenied" where a sentence belongs.
// Nothing throws and nothing logs — it surfaces only if someone opens that
// exact screen in that exact state.
//
// Written after nearly shipping t("delete"), which does not exist; the key is
// called galDelete.

// The web dictionary is one file per language now; English is the one that
// matters here, since it is the fallback every missing key falls through to.
const PAIRS = [
  { root: "src", dict: "src/i18n/en.js" },
  { root: "mobile-native/src", dict: "mobile-native/src/lib/i18n.js" },
];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!/node_modules|__tests__|\.expo|dist|data/.test(p)) walk(p, out);
    } else if (/\.(js|jsx)$/.test(e.name) && !/leafletAsset\.js$/.test(p)) out.push(p);
  }
  return out;
}

// Keys defined in the English block(s). Both files declare several merge blocks
// (MORE_I18N, RAILS_I18N, EXPLORE_I18N, …) that are Object.assign-ed on at
// load, so every `en: { … }` counts, not just the first.
function definedKeys(dictFile) {
  const src = fs.readFileSync(dictFile, "utf8");
  const keys = new Set();
  // A per-language file is a single flat object: every two-space key is a key.
  if (/[/\\]i18n[/\\]\w+\.js$/.test(dictFile)) {
    for (const m of src.matchAll(/^\s{2}([A-Za-z_$][\w$]*)\s*:/gm)) keys.add(m[1]);
    return keys;
  }
  const re = /(?:^|[\s{,])en:\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    let i = src.indexOf("{", m.index + m[0].length - 1);
    const start = i;
    let depth = 0;
    for (; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") { depth--; if (!depth) break; }
    }
    for (const km of src.slice(start, i + 1).matchAll(/(?:^|[{,\s])([A-Za-z_$][\w$]*)\s*:/g)) {
      keys.add(km[1]);
    }
  }
  return keys;
}

describe.each(PAIRS)("t() keys in $root", ({ root, dict }) => {
  const defined = definedKeys(dict);
  // The dictionaries themselves are not call sites.
  const files = walk(root).filter((f) => !/[/\\]i18n[/\\]/.test(f) && path.resolve(f) !== path.resolve(dict));

  it("reads a real dictionary and a meaningful number of files", () => {
    // Without this the test could pass by finding nothing to check.
    expect(defined.size).toBeGreaterThan(200);
    expect(files.length).toBeGreaterThan(15);
  });

  it("never asks for a key the dictionary does not have", () => {
    const missing = [];
    for (const file of files) {
      const src = fs.readFileSync(file, "utf8");
      for (const m of src.matchAll(/\bt\(\s*"([^"]+)"(\s*[+)])/g)) {
        if (m[2].trim().startsWith("+")) continue;   // built at runtime
        if (defined.has(m[1])) continue;
        missing.push(`${file}:${src.slice(0, m.index).split("\n").length}  t("${m[1]}")`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("never builds a key from a prefix nothing starts with", () => {
    // t("wx_" + code) is a genuine dynamic lookup and cannot be checked whole.
    // What can be: that the family exists. A prefix no key begins with means
    // every lookup through it renders raw, for every possible value.
    const orphans = [];
    for (const file of files) {
      const src = fs.readFileSync(file, "utf8");
      for (const m of src.matchAll(/\bt\(\s*"([^"]+)"\s*\+/g)) {
        if ([...defined].some((k) => k.startsWith(m[1]))) continue;
        orphans.push(`${file}:${src.slice(0, m.index).split("\n").length}  t("${m[1]}" + …)`);
      }
    }
    expect(orphans).toEqual([]);
  });
});
