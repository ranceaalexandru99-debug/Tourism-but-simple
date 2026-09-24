import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { appendCapped, MAX_BYTES } from "../../server/errorLog.js";

// /api/errors is unauthenticated — it must be, since an app that has just
// crashed may have no session — and every report is a line on disk. Nothing
// ever reclaimed any of it. At the limiter's 10 reports a minute and ~2.7 KB an
// entry, one address could write about 38 MB a day, ten about 380 MB.
//
// A full disk does not merely lose crash reports. Trip generation and account
// deletion share the machine and go down with it.

let dir;
let log;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "vai-errlog-"));
  log = path.join(dir, "nested", "errors.jsonl");
});
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

const lines = (f) => fs.readFileSync(f, "utf8").trim().split("\n");

describe("appendCapped", () => {
  it("writes a line, creating the directory it needs", () => {
    expect(appendCapped(log, '{"a":1}')).toBe("written");
    expect(lines(log)).toEqual(['{"a":1}']);
  });

  it("keeps one object per line", () => {
    appendCapped(log, '{"a":1}');
    appendCapped(log, '{"b":2}');
    expect(lines(log)).toEqual(['{"a":1}', '{"b":2}']);
  });

  it("does not double a newline the caller already added", () => {
    appendCapped(log, '{"a":1}\n');
    appendCapped(log, '{"b":2}');
    expect(fs.readFileSync(log, "utf8")).toBe('{"a":1}\n{"b":2}\n');
  });

  it("rotates once the file is full, and keeps writing", () => {
    appendCapped(log, "x".repeat(200), 100);
    expect(appendCapped(log, "fresh", 100)).toBe("rotated");
    expect(lines(log)).toEqual(["fresh"]);
    expect(fs.existsSync(`${log}.1`)).toBe(true);
  });

  it("keeps exactly one previous generation, so the total is bounded", () => {
    // The point of the whole exercise: no sequence of writes, however long,
    // grows the directory without limit.
    for (let i = 0; i < 40; i++) appendCapped(log, "y".repeat(60), 100);
    const files = fs.readdirSync(path.dirname(log));
    expect(files.sort()).toEqual(["errors.jsonl", "errors.jsonl.1"]);
    for (const f of files) {
      expect(fs.statSync(path.join(path.dirname(log), f)).size).toBeLessThan(300);
    }
  });

  it("replaces the old generation rather than failing on it", () => {
    // renameSync onto an existing target throws on Windows. Hitting that would
    // have meant the log stopped rotating there and grew forever instead.
    fs.mkdirSync(path.dirname(log), { recursive: true });
    fs.writeFileSync(`${log}.1`, "stale");
    appendCapped(log, "z".repeat(200), 100);
    expect(appendCapped(log, "newest", 100)).toBe("rotated");
    expect(fs.readFileSync(`${log}.1`, "utf8")).not.toContain("stale");
  });

  it("reports failure instead of throwing", () => {
    // This is called from the handler whose entire job is recording that
    // something already went wrong. Throwing there replaces a crash report
    // with a crash.
    const onAFile = path.join(dir, "afile");
    fs.writeFileSync(onAFile, "not a directory");
    expect(() => appendCapped(path.join(onAFile, "deeper", "x.jsonl"), "{}")).not.toThrow();
    expect(appendCapped(path.join(onAFile, "deeper", "x.jsonl"), "{}")).toBe("failed");
  });

  it("caps the log at something sane by default", () => {
    // Small enough to be irrelevant on any disk, large enough to hold far more
    // reports than anyone reads.
    expect(MAX_BYTES).toBeGreaterThan(1024 * 1024);
    expect(MAX_BYTES).toBeLessThanOrEqual(20 * 1024 * 1024);
  });
});

describe("the route uses it", () => {
  it("no longer appends to the log directly", () => {
    const src = fs.readFileSync("server/index.js", "utf8");
    expect(src).toContain("appendCapped(ERROR_LOG");
    expect(src).not.toMatch(/appendFileSync\(\s*ERROR_LOG/);
  });
});
