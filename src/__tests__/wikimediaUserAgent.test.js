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
const photoCache = fs.readFileSync("mobile-native/src/lib/photoCache.js", "utf8");

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

  it("goes on the photo download, because <Image> cannot carry it", () => {
    // This test used to assert the opposite — that the headers go on the image
    // source — which is what the ImageSource type promises. On a phone React
    // Native handed back, for every tile:
    //
    //   Unexpected HTTP code Response{protocol=h2, code=403,
    //   url=https://thumb.wikimedia.org/.../330px-Split2.JPG}
    //
    // Images are loaded by a separate native client that does not send them.
    // So the bytes come down through downloadAsync, which does.
    expect(photoCache).toContain("WIKI_HEADERS");
    expect(photoCache).toMatch(/downloadAsync\([^)]*headers/s);
  });

  it("hands <Image> a local file, never a remote URL", () => {
    expect(poiImage).toContain("localPhoto");
    // A remote URI reaching the image element is the bug coming back.
    expect(poiImage).not.toMatch(/headers:\s*WIKI_HEADERS/);
    expect(poiImage).toMatch(/const source = \{ uri: state\.src \}/);
  });

  it("knows a remote URL from a local one", () => {
    // photoCache passes a file:// or data: source straight through: there is
    // nothing to download, and nothing to send a header to.
    expect(isRemote("https://thumb.wikimedia.org/x.jpg")).toBe(true);
    expect(isRemote("http://example.org/x.jpg")).toBe(true);
    expect(isRemote("file:///docs/memories/a.jpg")).toBe(false);
    expect(isRemote("data:image/jpeg;base64,AAAA")).toBe(false);
    expect(isRemote(null)).toBe(false);
  });

  it("downloads a photo once, however many tiles ask", () => {
    expect(photoCache).toContain("inflight");
  });

  it("does not keep a zero-byte file from a failed download", () => {
    // <Image> fails on an empty file forever, and the cached-file check would
    // never look past it.
    expect(photoCache).toMatch(/have\.exists && have\.size > 0/);
    expect(photoCache).toMatch(/status !== 200/);
  });

  it("sends a header object shaped the way fetch and Image both want", () => {
    expect(WIKI_HEADERS).toEqual({ "User-Agent": USER_AGENT });
  });
});
