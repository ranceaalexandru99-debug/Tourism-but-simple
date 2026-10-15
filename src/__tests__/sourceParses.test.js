import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";

// Does every source file actually parse?
//
// Written after a scripted edit dropped one character from the native
// dictionary, leaving `onst STORAGE_I18N = {`. The whole suite — 476 tests —
// went green, because everything that reads i18n.js reads it as TEXT: the
// parity scan, the missing-key scan, the call-site scan. Only the Android
// bundler noticed, and only because it was run by hand afterwards.
//
// Most modules here cannot be imported under vitest (React Native, expo
// packages, JSX), so this parses them instead. It says nothing about whether
// they work; it says they are not gibberish, which no other test does.

const ROOTS = ["src", "mobile-native/src", "server", "scripts"];
const SKIP = /node_modules|\.expo|dist|leafletAsset\.js/;

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

// The guard here used to be `walk(".").length`, which walked the entire
// repository — .git objects included — to establish that the working directory
// was the right one. Measured alongside the other file-walking tests, the three
// of them took over thirty seconds and blew vitest's five-second default, which
// is where several unexplained timeouts in full runs came from.
const files = fs.existsSync("package.json") ? ROOTS.flatMap((r) => walk(r)) : [];

describe("every source file", () => {
  it("covers the whole codebase, not a corner of it", () => {
    expect(files.length).toBeGreaterThan(80);
    // The file that motivated this, and its web twin.
    expect(files).toContain(path.join("mobile-native", "src", "lib", "i18n.js"));
    expect(files).toContain(path.join("src", "i18n.js"));
  });

  it("parses as JavaScript", () => {
    const broken = [];
    for (const file of files) {
      const src = fs.readFileSync(file, "utf8");
      try {
        // JSX, and with a .js extension throughout the native app — so the
        // parser has to accept it everywhere rather than by file name.
        parse(src, { sourceType: "module", plugins: ["jsx"], errorRecovery: false });
      } catch (e) {
        broken.push(`${file}:${e.loc?.line ?? "?"}  ${e.message}`);
      }
    }
    expect(broken).toEqual([]);
    // This takes a few seconds — see testTimeout in vite.config.js.
  });
});
