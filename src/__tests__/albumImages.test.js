import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cellPixels, shrinkAlbumPhotos } from "../albumImages.js";

// These pin the two ways this module could hang or corrupt an album. Both were
// real: a photo whose Image fires neither load nor error left the promise
// unsettled forever, disabling the album button for the rest of the session,
// and a cache keyed on a missing id handed every such photo the first one's
// picture.

// A controllable stand-in for the browser's Image. `mode` decides which event,
// if any, the src setter fires.
function stubImage(mode) {
  vi.stubGlobal("Image", class {
    set src(_v) {
      if (mode === "load") queueMicrotask(() => this.onload?.());
      else if (mode === "error") queueMicrotask(() => this.onerror?.());
      // mode "silent": neither, on purpose.
    }
    get width() { return 4000; }
    get height() { return 3000; }
  });
}

const albumOf = (photos) => ({
  chapters: [{ day: 1, date: "2026-05-10", stops: [{ name: "S", time: "9:00", photos }], loose: [] }],
  extras: [],
  photoCount: photos.length,
});

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("cellPixels", () => {
  it("gives a smaller cell as the grid gets denser", () => {
    expect(cellPixels(1)).toBeGreaterThan(cellPixels(30));
  });

  it("stays within a sane print range", () => {
    for (const n of [1, 2, 5, 9, 16, 25, 40]) {
      expect(cellPixels(n)).toBeGreaterThan(150);
      expect(cellPixels(n)).toBeLessThan(1800);
    }
  });
});

describe("shrinkAlbumPhotos", () => {
  it("settles even when the Image never fires load or error", async () => {
    stubImage("silent");
    const promise = shrinkAlbumPhotos(albumOf([{ id: "a", dataUrl: "data:image/jpeg;base64,aaa" }]));

    await vi.advanceTimersByTimeAsync(10_000);
    const out = await promise;

    // Falls back to the original rather than hanging.
    expect(out.chapters[0].stops[0].photos[0].dataUrl).toBe("data:image/jpeg;base64,aaa");
  });

  it("keeps the original when the image cannot be decoded", async () => {
    stubImage("error");
    const promise = shrinkAlbumPhotos(albumOf([{ id: "a", dataUrl: "data:image/jpeg;base64,bad" }]));
    await vi.advanceTimersByTimeAsync(0);
    const out = await promise;
    expect(out.chapters[0].stops[0].photos[0].dataUrl).toBe("data:image/jpeg;base64,bad");
  });

  it("does not give two photos the same picture when neither has an id", async () => {
    stubImage("error");   // error path returns each photo's own dataUrl
    const promise = shrinkAlbumPhotos(albumOf([
      { dataUrl: "data:image/jpeg;base64,one" },
      { dataUrl: "data:image/jpeg;base64,two" },
    ]));
    await vi.advanceTimersByTimeAsync(0);
    const out = await promise;

    const [a, b] = out.chapters[0].stops[0].photos;
    expect(a.dataUrl).toBe("data:image/jpeg;base64,one");
    expect(b.dataUrl).toBe("data:image/jpeg;base64,two");
  });
});
