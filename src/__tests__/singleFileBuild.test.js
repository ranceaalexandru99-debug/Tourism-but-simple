import { describe, it, expect } from "vitest";
import fs from "node:fs";

// `npm run build:share` makes one index.html that runs from file:// — the copy
// you send to someone who should not have to install anything.
//
// It was not quite self-contained. /noflash.js stayed an external file, because
// in the normal build that is deliberate: keeping it out of the HTML is what
// lets the page ship script-src 'self' with no 'unsafe-inline'. Sent on its
// own, the page 404s on it, flashes light before dark, and leaves <html lang>
// unset. A file:// page has no CSP to protect, so the single-file mode inlines
// it.
//
// Verified in a browser after the change: zero network requests, lang="ro",
// the dark class applied, both fonts from data URIs, no errors.

const config = fs.readFileSync("vite.config.js", "utf8");
const indexHtml = fs.readFileSync("index.html", "utf8");

describe("the single-file build", () => {
  it("inlines the no-flash script", () => {
    expect(config).toContain("inline-noflash");
    expect(config).toMatch(/transformIndexHtml/);
  });

  it("only does that in single-file mode", () => {
    // The normal build must keep the script external, or the CSP has to be
    // loosened to 'unsafe-inline' — the thing it was separated to avoid.
    const single = config.slice(config.indexOf('mode === "single"'), config.indexOf("VitePWA("));
    expect(single).toContain("inline-noflash");
    const pwa = config.slice(config.indexOf("VitePWA("));
    expect(pwa).not.toContain("inline-noflash");
  });

  it("fails the build rather than silently skipping, if the tag moves", () => {
    // A plugin that quietly does nothing would leave the artifact broken in a
    // way only someone opening the file would notice.
    expect(config).toMatch(/throw new Error\("noflash\.js tag not found/);
  });

  it("looks for a tag index.html actually has", () => {
    // Keeps the two in step: the guard above only helps if it is checking for
    // the right thing in the first place.
    expect(indexHtml).toMatch(/<script src="\/noflash\.js"><\/script>/);
  });
});

describe("the build output", () => {
  it("is not committed", () => {
    // It was, once, swept in by a bulk "add remaining files" change — so every
    // rebuild produced a 1.4 MB diff of a generated file. dist/ was always
    // ignored; this is the same kind of thing.
    const ignore = fs.readFileSync(".gitignore", "utf8");
    expect(ignore).toMatch(/^share\/$/m);
    expect(ignore).toMatch(/^dist\/$/m);
  });
});
