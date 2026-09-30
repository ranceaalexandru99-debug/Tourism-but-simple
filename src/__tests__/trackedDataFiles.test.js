import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// A clone must be able to build.
//
// .gitignore said `data/`, meant for the 47 MB of crawled POIs. A bare
// directory name matches at any depth, so it also caught src/data/ — and
// src/destinations.js imports src/data/fallbackCities.json, which had therefore
// never been committed. Locally everything built; `git clone && npm run build`
// stopped with UNRESOLVED_IMPORT. Nothing in the test suite noticed, because
// every test read the file straight off the working copy.
//
// So: whatever the source imports, git must be carrying.

const ROOT = path.resolve(__dirname, "..", "..");

const tracked = new Set(
  execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20 })
    .split("\n")
    .filter(Boolean)
);

const SOURCE_DIRS = ["src", "mobile-native/src", "scripts", "server"];

function sourceFiles(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  const out = [];
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === "__tests__") continue;
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...sourceFiles(rel));
    else if (/\.(js|jsx|mjs)$/.test(e.name)) out.push(rel);
  }
  return out;
}

// `import x from "./data/thing.json"` and `await import("../data/thing.json")`.
const JSON_IMPORT = /(?:from|import)\s*\(?\s*["'](\.[^"']*\.json)["']/g;

describe("data files the build needs", () => {
  it("are all tracked by git", () => {
    const missing = [];
    for (const file of SOURCE_DIRS.flatMap(sourceFiles)) {
      const text = fs.readFileSync(path.join(ROOT, file), "utf8");
      for (const [, spec] of text.matchAll(JSON_IMPORT)) {
        const rel = path
          .relative(ROOT, path.resolve(path.dirname(path.join(ROOT, file)), spec))
          .split(path.sep)
          .join("/");
        if (!tracked.has(rel)) missing.push(`${file} importă ${rel}, care nu e în git`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("still leaves the crawled POIs out of history", () => {
    // The other half of the rule: correcting the over-broad ignore must not
    // quietly start committing 47 MB of derived data.
    const pois = [...tracked].filter((f) => f.startsWith("data/pois/"));
    expect(pois).toEqual([]);
  });
});
