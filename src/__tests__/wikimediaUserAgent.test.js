import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { USER_AGENT, WIKI_HEADERS, isRemote } from "../../mobile-native/src/lib/userAgent.js";

// Why this exists, measured rather than guessed:
//
//   ro.wikipedia.org       okhttp 403   browser 200
//   commons.wikimedia.org  okhttp 403   browser 200
//   thumb.wikimedia.org    okhttp 403   browser 200
//
// React Native's Android networking identifies itself as okhttp, so on a phone
// every stage of the photo chain failed and no destination photo ever appeared.
// The web app never saw it: a browser sends its own agent.
//
// The third line is the one that is easy to miss. React Native loads images
// through a separate client, so headers on fetch() do nothing for an <Image> —
// the photo would resolve correctly and then never draw.

const photos = fs.readFileSync("mobile-native/src/lib/photos.js", "utf8");
const poiImage = fs.readFileSync("mobile-native/src/components/PoiImage.js", "utf8");

describe("the user agent", () => {
  it("identifies the app, as Wikimedia's policy asks", () => {
    expect(USER_AGENT).toMatch(/TurismDarSimplu\/\S+/);
    expect(USER_AGENT.length).toBeGreaterThan(20);
  });

  it("is not okhttp, and not a browser pretending", () => {
    expect(USER_AGENT).not.toMatch(/okhttp/i);
    // Claiming to be Chrome would work and would be a lie to a service that
    // asks apps to identify themselves.
    expect(USER_AGENT).not.toMatch(/Mozilla|Chrome|Safari/i);
  });

  it("carries no email address", () => {
    // A request header to a third party is not the place for one.
    expect(USER_AGENT).not.toMatch(/@/);
  });
});

describe("where it is sent", () => {
  it("goes on every Wikimedia API request", () => {
    // All three stages of the chain go through one getJson, which is the reason
    // a single change covers them.
    expect(photos).toMatch(/fetch\(url,\s*\{\s*headers:\s*WIKI_HEADERS\s*\}\)/);
    const bareFetches = [...photos.matchAll(/fetch\(([^)]*)\)/g)]
      .filter((m) => !m[1].includes("WIKI_HEADERS"));
    expect(bareFetches.map((m) => m[0])).toEqual([]);
  });

  it("goes on the image source too, since RN loads images itself", () => {
    expect(poiImage).toContain("headers: WIKI_HEADERS");
    expect(poiImage).toContain("isRemote(state.src)");
  });

  it("is not attached to local files", () => {
    // A file:// or data: photo is read off the device; headers mean nothing and
    // would only invite questions later.
    expect(isRemote("https://thumb.wikimedia.org/x.jpg")).toBe(true);
    expect(isRemote("http://example.org/x.jpg")).toBe(true);
    expect(isRemote("file:///docs/memories/a.jpg")).toBe(false);
    expect(isRemote("data:image/jpeg;base64,AAAA")).toBe(false);
    expect(isRemote(null)).toBe(false);
  });

  it("sends a header object shaped the way fetch and Image both want", () => {
    expect(WIKI_HEADERS).toEqual({ "User-Agent": USER_AGENT });
  });
});
