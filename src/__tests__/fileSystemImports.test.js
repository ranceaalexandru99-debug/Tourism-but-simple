import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Where the native app gets its file-system API from.
//
// In SDK 54 expo-file-system's root entry point stopped being that API:
// documentDirectory, cacheDirectory and EncodingType vanished from it, and
// copyAsync, getInfoAsync, makeDirectoryAsync, readAsStringAsync and
// writeAsStringAsync stayed exported but now throw. The package says it plainly:
// "@deprecated … This method will throw in runtime."
//
// The app kept importing the root for months. It built fine — a missing export
// is not a build error — and the suite stayed green because the stub made the
// root work. On a phone the album produced "no files", the short renderer could
// not write its output, and every photo was stored at "undefinedmemories/…".
//
// Two tests, because neither alone is enough. The stubs catch a wrong import
// only where a test actually reaches that call: the album's toDataUrl tries
// ImageManipulator first and succeeds there, so its file-system fallback is
// never exercised. A source scan does not care which branch runs.

const ROOT = "mobile-native/src";

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.js$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = walk(ROOT);

describe("expo-file-system imports", () => {
  it("scans the whole native source tree", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("never import the entry point whose methods throw", () => {
    const offenders = files.filter((f) => {
      const src = fs.readFileSync(f, "utf8");
      // The root specifier exactly — "expo-file-system/legacy" is the good one.
      return /from\s+["']expo-file-system["']/.test(src);
    });
    expect(offenders).toEqual([]);
  });

  it("uses the legacy entry wherever the file system is touched", () => {
    const users = files.filter((f) => /FileSystem\./.test(fs.readFileSync(f, "utf8")));
    // Three today: gallery.js, albumExport.js, ShortRenderer.js.
    expect(users.length).toBeGreaterThanOrEqual(3);
    for (const f of users) {
      expect(fs.readFileSync(f, "utf8")).toMatch(/from\s+["']expo-file-system\/legacy["']/);
    }
  });

  it("only asks the legacy API for things it actually has", () => {
    // A name that is not there comes back undefined and turns into a string like
    // "undefinedmemories/" rather than an error — the quietest possible failure.
    const AVAILABLE = new Set([
      "documentDirectory", "cacheDirectory", "bundleDirectory", "EncodingType",
      "copyAsync", "moveAsync", "deleteAsync", "getInfoAsync", "makeDirectoryAsync",
      "readAsStringAsync", "writeAsStringAsync", "readDirectoryAsync",
      "downloadAsync", "uploadAsync", "getContentUriAsync",
      "getFreeDiskStorageAsync", "getTotalDiskCapacityAsync",
      "createDownloadResumable", "createUploadTask",
    ]);
    const unknown = new Set();
    for (const f of files) {
      for (const m of fs.readFileSync(f, "utf8").matchAll(/\bFileSystem\.([A-Za-z_$][\w$]*)/g)) {
        if (!AVAILABLE.has(m[1])) unknown.add(`${f}: FileSystem.${m[1]}`);
      }
    }
    expect([...unknown]).toEqual([]);
  });
});
