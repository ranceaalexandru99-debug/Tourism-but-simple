import { describe, it, expect, vi, beforeEach } from "vitest";
import * as picker from "expo-image-picker";
import * as fsx from "expo-file-system";

// The native gallery. Two behaviours here were silent failures until recently,
// and both cost the user their photograph:
//
//   - a full device meant addMemory() wrote nothing and said nothing, so a
//     photo appeared in the grid and was gone on the next launch
//   - a failed copy out of the picker's cache left the memory pointing at a
//     temporary file the OS may reclaim
//
// Neither is visible from the UI, which is exactly why they need tests.

function memoryStorage(failWrites = false) {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { if (failWrites) throw new Error("QuotaExceeded"); map.set(k, String(v)); },
    removeItem: (k) => map.delete(k),
    get _map() { return map; },
  };
}

const memory = (over = {}) => ({
  id: "m1", ts: Date.now(), uri: "file:///docs/photos/a.jpg",
  caption: "Turnul", tripId: "t1", tripTitle: "Brașov", stopName: null, ll: null,
  ...over,
});

// Imported once, deliberately. vi.resetModules() would give the module a fresh
// copy of the stubs too, so the `next` object configured here would no longer
// be the one it reads — and every picker test would see the defaults.
// gallery.js keeps no module state: it reads storage on each call.
import * as gallery from "../../mobile-native/src/lib/gallery.js";

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  fsx.calls.length = 0;
  fsx.failures.clear();
  picker.next.permission = { granted: true };
  picker.next.result = { canceled: true };
});

describe("addMemory", () => {
  it("stores the photo and reports that it landed", () => {
    expect(gallery.addMemory(memory())).toBe(true);
    expect(gallery.listMemories()).toHaveLength(1);
  });

  it("reports FALSE when the write fails, instead of losing the photo quietly", () => {
    vi.stubGlobal("localStorage", memoryStorage(true));
    // The caller shows an alert on false; before this returned the memory
    // object, which is always truthy, so the failure was invisible.
    expect(gallery.addMemory(memory())).toBe(false);
  });

  it("puts the newest photo first", () => {
    gallery.addMemory(memory({ id: "old", ts: 1000 }));
    gallery.addMemory(memory({ id: "new", ts: 2000 }));
    expect(gallery.listMemories().map((m) => m.id)).toEqual(["new", "old"]);
  });
});

describe("deleteMemory", () => {
  it("removes only the one asked for", () => {
    gallery.addMemory(memory({ id: "a" }));
    gallery.addMemory(memory({ id: "b" }));
    gallery.deleteMemory("a");
    expect(gallery.listMemories().map((m) => m.id)).toEqual(["b"]);
  });

  it("ignores an id that is not there", () => {
    gallery.addMemory(memory({ id: "a" }));
    expect(() => gallery.deleteMemory("nope")).not.toThrow();
    expect(gallery.listMemories()).toHaveLength(1);
  });
});

describe("pickPhoto", () => {
  it("says 'denied' when permission is refused, rather than looking like a dead button", async () => {
    picker.next.permission = { granted: false };
    expect(await gallery.pickPhoto(true)).toBe("denied");
  });

  it("returns null when the user cancels", async () => {
    picker.next.result = { canceled: true };
    expect(await gallery.pickPhoto(true)).toBeNull();
  });

  it("copies the photo out of the picker's cache into the app's own storage", async () => {
    picker.next.result = { canceled: false, assets: [{ uri: "file:///cache/tmp/IMG_1.jpg" }] };
    const uri = await gallery.pickPhoto(true);
    expect(fsx.calls.some((c) => c.name === "copyAsync")).toBe(true);
    // The returned path is the durable copy, not the temporary one: it lives
    // in the document directory, which the OS does not reclaim, rather than the
    // cache the picker handed us.
    expect(uri).not.toBe("file:///cache/tmp/IMG_1.jpg");
    expect(uri.startsWith("file:///docs/")).toBe(true);
    expect(uri.startsWith("file:///cache/")).toBe(false);
  });

  it("keeps the original extension", async () => {
    picker.next.result = { canceled: false, assets: [{ uri: "file:///cache/tmp/IMG_1.png" }] };
    expect(await gallery.pickPhoto(false)).toMatch(/\.png$/);
  });

  it("falls back to the temporary path when the copy fails, rather than losing the photo", async () => {
    fsx.failures.set("copyAsync", new Error("disk full"));
    picker.next.result = { canceled: false, assets: [{ uri: "file:///cache/tmp/IMG_1.jpg" }] };
    // A fragile reference beats no photograph — but it IS fragile: the OS may
    // reclaim that file, which is why exportAlbumPdf reports "noFiles" rather
    // than telling someone to add more photos.
    expect(await gallery.pickPhoto(true)).toBe("file:///cache/tmp/IMG_1.jpg");
  });
});
