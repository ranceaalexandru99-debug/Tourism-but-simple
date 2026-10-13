import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Does every relative import point at a file that exists?
//
// Written after shared/osmLive.js — copied byte-for-byte to the native app —
// imported "../osmCurate.js". On the web that is src/osmCurate.js and correct;
// on native the copy was being synced to src/lib/osmCurate.js, so the path
// resolved to nothing. Metro would have failed the bundle, but nothing in the
// test suite would: sourceParses.test.js parses each file and a broken path
// still parses, and most of these modules cannot be imported under vitest at
// all because of React Native.
//
// Byte-for-byte sharing only works when a relative path means the same thing on
// both sides. This is the test that says so.

const ROOTS = ["src", "mobile-native/src", "server", "scripts"];
// __tests__ is excluded, and that is not laziness. These files hold example
// specifiers as data — trackedDataFiles.test.js documents `from "./data/
// thing.json"`, this very file writes `from "./x"` — and a scanner cannot tell
// an example from an import. A genuinely broken import inside a test needs no
// scanner anyway: the test does not run.
const SKIP = /node_modules|\.expo|dist|leafletAsset\.js|__tests__/;
const EXTS = ["", ".js", ".jsx", ".mjs", ".json", "/index.js", "/index.jsx"];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (SKIP.test(p)) continue;
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|jsx|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

// `from "./x"`, `import("./x")` and `require("./x")` — the native shard loader
// uses the last of those because Metro cannot follow a computed path.
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)["'](\.[^"']*)["']/g;

describe("relative imports", () => {
  const files = ROOTS.flatMap((r) => walk(r));

  it("covers the whole codebase", () => {
    expect(files.length).toBeGreaterThan(80);
    // The two synced files whose paths have to mean the same thing on both
    // sides, and the generated loader.
    expect(files).toContain(path.join("mobile-native", "src", "shared", "osmLive.js"));
    expect(files).toContain(path.join("mobile-native", "src", "shared", "poiDest.js"));
    expect(files).toContain(path.join("mobile-native", "src", "lib", "poiShards.js"));
  });

  it("all point at a file that exists", () => {
    const broken = [];
    for (const file of files) {
      const dir = path.dirname(file);
      for (const [, raw] of fs.readFileSync(file, "utf8").matchAll(SPECIFIER)) {
        // A template literal is a path assembled at runtime — scripts write
        // those into generated files, and no static check can resolve one.
        // Vite carries options on the specifier ("./x?worker"); the file is the
        // part before the ?.
        if (raw.includes("${")) continue;
        const spec = raw.split("?")[0];
        const base = path.join(dir, spec);
        if (!EXTS.some((ext) => fs.existsSync(base + ext))) broken.push(`${file} -> ${raw}`);
      }
    }
    expect(broken).toEqual([]);
    // Sixty seconds, not vitest's five: this reads every source file and stats
    // each specifier against seven candidate extensions, which takes over ten
    // when the other file-walking tests run alongside it.
  }, 60000);
});
