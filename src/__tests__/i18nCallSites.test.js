import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Guards against a mistake that actually shipped into this repo: a scripted
// edit stripped the quotes out of two t("…") calls, leaving t(shortFailed) —
// a bare identifier that is not defined anywhere. Nothing complained, because
// both sat inside error handlers. The result was worse than the failure they
// were meant to report: the moment a short failed, the handler itself threw a
// ReferenceError.
//
// A key can be missing from the table and that is merely a bad message; a key
// that is not a literal at all is a crash. This test only checks the second.

const ROOTS = ["src", "mobile-native/src"];
const CODE = /\.(js|jsx)$/;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!/node_modules|__tests__|\.expo|dist/.test(p)) walk(p, out);
    } else if (CODE.test(entry.name)) out.push(p);
  }
  return out;
}

// t(x) where x is a plain identifier. Single-letter and obvious loop variables
// are excluded: those are genuine dynamic lookups, e.g. t(key) in a map.
const SUSPECT = /\bt\(\s*([a-z][a-zA-Z0-9]{2,})\s*[,)]/g;
const DYNAMIC_OK = new Set(["key", "code", "lang", "label", "name", "value", "item", "entry", "msg", "reason", "which", "titleKey", "labelKey"]);

describe("t() call sites", () => {
  const files = ROOTS.flatMap((r) => (fs.existsSync(r) ? walk(r) : []));

  it("reads a meaningful number of source files", () => {
    // Without this the test could pass by scanning nothing at all.
    expect(files.length).toBeGreaterThan(20);
  });

  it("never passes an undefined bare identifier as a translation key", () => {
    const offenders = [];
    for (const file of files) {
      const src = fs.readFileSync(file, "utf8");
      const lines = src.split("\n");
      lines.forEach((line, i) => {
        for (const m of line.matchAll(SUSPECT)) {
          const name = m[1];
          if (DYNAMIC_OK.has(name)) continue;
          // A real variable is declared or imported somewhere in the file.
          const declared = new RegExp(`(const|let|var|function)\\s+${name}\\b|\\b${name}\\s*[,}]?\\s*(=>|=)|\\{[^}]*\\b${name}\\b[^}]*\\}\\s*=|import[^;]*\\b${name}\\b`).test(src);
          if (!declared) offenders.push(`${file}:${i + 1}  ${line.trim().slice(0, 90)}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
