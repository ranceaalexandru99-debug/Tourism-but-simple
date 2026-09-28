import { describe, it, expect } from "vitest";
import fs from "node:fs";

// The Content-Security-Policy, checked against what the app actually loads.
//
// Nothing applies these headers in development — they live in public/_headers
// and vercel.json, which the static host reads — so a wrong one is invisible
// until the site is deployed, and then it silently blocks things.
//
// It was wrong. img-src allowed upload.wikimedia.org, and every photo URL
// Wikipedia hands back is on thumb.wikimedia.org: five cities checked, five out
// of five. A deployed build would have shown no destination photos at all, for
// a completely different reason than the phone did.

// The policy itself, not the file around it: the comments above it discuss the
// hosts it deliberately no longer allows, and a test that reads the whole file
// finds those and fails on its own explanation.
function policyOf(file) {
  const src = fs.readFileSync(file, "utf8");
  if (file.endsWith(".json")) {
    // Structured: walk the header list rather than guessing at its layout.
    const found = [];
    const walk = (node) => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (node && typeof node === "object") {
        if (node.key === "Content-Security-Policy") found.push(node.value);
        return Object.values(node).forEach(walk);
      }
    };
    walk(JSON.parse(src));
    if (!found.length) throw new Error(`no policy found in ${file}`);
    return found[0].trim();
  }
  const m = src.match(/^\s*Content-Security-Policy:\s*(.+)$/m);
  if (!m) throw new Error(`no policy found in ${file}`);
  return m[1].trim();
}

const POLICIES = [["_headers", policyOf("public/_headers")], ["vercel.json", policyOf("vercel.json")]];

const directive = (policy, name) => {
  const m = policy.match(new RegExp(`${name} ([^;"]*)`));
  return m ? m[1].trim() : null;
};

describe.each(POLICIES)("%s", (_label, policy) => {
  it("carries a policy at all", () => {
    expect(policy).toContain("default-src 'self'");
  });

  it("allows the host the photos are really on", () => {
    // thumb.wikimedia.org, not upload.wikimedia.org. Both are listed: the
    // second for URLs cached before Wikimedia moved.
    expect(directive(policy, "img-src")).toContain("https://thumb.wikimedia.org");
  });

  it("allows the map tiles", () => {
    expect(directive(policy, "img-src")).toContain("basemaps.cartocdn.com");
  });

  it("allows every API the app calls", () => {
    const connect = directive(policy, "connect-src");
    for (const host of [
      "https://api.open-meteo.com",       // weather
      "https://*.wikipedia.org",          // photo lookups
      "https://commons.wikimedia.org",    // photo lookups, last resort
      "https://*.supabase.co",            // cities, auth
    ]) {
      expect(connect).toContain(host);
    }
  });

  it("no longer allows Google to serve the fonts", () => {
    // They are self-hosted. Leaving the allowance would let a stray link
    // reintroduce the third party without the policy objecting.
    expect(policy).not.toContain("fonts.googleapis.com");
    expect(policy).not.toContain("fonts.gstatic.com");
    expect(directive(policy, "font-src")).toBe("'self'");
  });

  it("keeps the strict parts strict", () => {
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("script-src 'self'");
  });
});

describe("the page and the policy agree", () => {
  it("loads no font from a third party", () => {
    const html = fs.readFileSync("index.html", "utf8");
    expect(html).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
  });

  it("serves the fonts from the app itself", () => {
    const css = fs.readFileSync("src/fonts.css", "utf8");
    expect(css).toMatch(/@font-face/);
    // Relative paths, so the bundler hashes them and the service worker
    // precaches them — no absolute URL to anywhere else.
    expect(css).not.toMatch(/src:\s*url\(["']?https?:/);
    for (const family of ["Fraunces", "Plus Jakarta Sans"]) {
      expect(css).toContain(`font-family: "${family}"`);
    }
  });

  it("keeps the unicode ranges, so a page fetches only the subsets it needs", () => {
    const css = fs.readFileSync("src/fonts.css", "utf8");
    expect((css.match(/unicode-range:/g) || []).length).toBeGreaterThanOrEqual(4);
  });
});
