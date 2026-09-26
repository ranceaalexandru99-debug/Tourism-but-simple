import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// One dictionary per language, fetched on demand.
//
// Measured before: all sixteen together were 102 KB gzipped out of 377 KB for
// the whole app — the second largest thing the browser downloaded, and a reader
// uses one of them. After: a Romanian visitor downloads 199 KB instead of 281.
//
// Two ways this quietly comes undone, and a test for each:
//
//   1. someone imports a dictionary statically, which pulls all of them back
//      into the main bundle;
//   2. the service worker precaches them, which downloads all sixteen anyway —
//      the same bytes over the same connection, just later. That one had
//      already happened by default: the first build after the split precached
//      every language and the saving was entirely imaginary.

const LANGS = ["en", "ro", "fr", "es", "it", "de", "pt", "nl", "pl", "el", "tr", "uk", "ru", "zh", "ja", "ko"];
const DIR = "src/i18n";
const i18n = fs.readFileSync("src/i18n.js", "utf8");
const viteConfig = fs.readFileSync("vite.config.js", "utf8");

describe("the per-language dictionaries", () => {
  it("has one file per language, and nothing else", () => {
    const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".js")).map((f) => f.replace(/\.js$/, ""));
    expect(files.sort()).toEqual([...LANGS].sort());
  });

  it("gives every language the same keys as English", () => {
    const keysOf = (lang) => {
      const src = fs.readFileSync(path.join(DIR, `${lang}.js`), "utf8");
      return new Set([...src.matchAll(/^\s{2}([A-Za-z_$][\w$]*)\s*:/gm)].map((m) => m[1]));
    };
    const en = keysOf("en");
    expect(en.size).toBeGreaterThan(300);
    for (const lang of LANGS) {
      const missing = [...en].filter((k) => !keysOf(lang).has(k));
      expect({ lang, missing }).toEqual({ lang, missing: [] });
    }
  });
});

describe("how they are loaded", () => {
  it("imports only English eagerly", () => {
    // Any other static import defeats the whole thing: the bundler would fold
    // that language into the main chunk.
    const statics = [...i18n.matchAll(/^import\s+\w+\s+from\s+"\.\/i18n\/(\w+)\.js"/gm)].map((m) => m[1]);
    expect(statics).toEqual(["en"]);
  });

  it("reaches the other fifteen through import(), one call each", () => {
    // A computed specifier — import(`./i18n/${code}.js`) — would make the
    // bundler emit all of them as a single eager group on some configs.
    const dynamic = [...i18n.matchAll(/import\("\.\/i18n\/(\w+)\.js"\)/g)].map((m) => m[1]);
    expect(dynamic.sort()).toEqual(LANGS.filter((l) => l !== "en").sort());
    expect(i18n).not.toMatch(/import\(`[^`]*\$\{/);
  });

  it("falls back to English when a chunk cannot be fetched", () => {
    // Offline mid-session, or a stale chunk name after a redeploy. A worse
    // looking app, not a broken one.
    expect(i18n).toMatch(/\.catch\(\(\) => en\)/);
  });
});

describe("the service worker", () => {
  it("does not precache the fifteen translations", () => {
    expect(viteConfig).toContain("globIgnores");
    const m = viteConfig.match(/globIgnores:\s*\[([^\]]*)\]/);
    expect(m).not.toBeNull();
    for (const lang of LANGS.filter((l) => l !== "en")) {
      expect(m[1]).toContain(lang);
    }
  });

  it("still keeps the one a reader opens, for offline", () => {
    // Excluding them from precache must not mean the app stops working offline
    // in the reader's own language.
    expect(viteConfig).toContain("i18n-v1");
    expect(viteConfig).toMatch(/handler:\s*"CacheFirst"/);
  });

  it("leaves English alone, since it is the fallback", () => {
    const m = viteConfig.match(/globIgnores:\s*\[([^\]]*)\]/);
    expect(m[1]).not.toMatch(/\ben\b/);
  });
});
