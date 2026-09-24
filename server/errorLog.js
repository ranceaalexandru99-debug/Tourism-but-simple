// Appending to the crash log, with a ceiling.
//
// /api/errors is unauthenticated — it has to be, since an app that has just
// crashed may have no session — and it writes a line to disk per report. The
// rate limiter caps a single IP at 10 reports a minute, which still allows
// about 38 MB a day from one address and ten times that from ten. Nothing
// reclaimed any of it.
//
// A full disk does not just lose crash reports: it takes trip generation and
// account deletion down with them, because those share the machine. So the log
// rotates. One previous generation is kept, which bounds the whole thing at
// twice MAX_BYTES and still leaves a useful window of history.

import fs from "node:fs";
import path from "node:path";

// 5 MB per generation, 10 MB in total. At the ~2.7 KB an entry can reach, that
// is roughly 1800 reports in the live file — far more than anyone reads, and
// small enough to be irrelevant next to any disk this runs on.
export const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Append one line, rotating first if the file has grown past `maxBytes`.
 *
 * Every failure is swallowed and reported through the return value: this is
 * called from a handler whose entire job is to record that something already
 * went wrong, and throwing there would replace a crash report with a crash.
 *
 * @returns "written" | "rotated" | "failed"
 */
export function appendCapped(file, line, maxBytes = MAX_BYTES) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });

    let rotated = false;
    let size = 0;
    try { size = fs.statSync(file).size; } catch { /* not there yet */ }

    if (size >= maxBytes) {
      // renameSync replaces an existing .1 atomically on POSIX; on Windows it
      // throws if the target exists, so the old generation goes first.
      try { fs.rmSync(`${file}.1`, { force: true }); } catch { /* nothing to remove */ }
      fs.renameSync(file, `${file}.1`);
      rotated = true;
    }

    fs.appendFileSync(file, line.endsWith("\n") ? line : line + "\n");
    return rotated ? "rotated" : "written";
  } catch {
    return "failed";
  }
}
