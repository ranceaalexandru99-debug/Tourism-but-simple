import { describe, it, expect, beforeEach, vi } from "vitest";

// A localStorage that refuses writes once its contents exceed `quota`, the way
// a real browser does. Small enough that a couple of entries fill it.
function fakeStorage(quota) {
  const map = new Map();
  const used = () => [...map].reduce((n, [k, v]) => n + k.length + v.length, 0);
  return {
    get length() { return map.size; },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    removeItem: (k) => { map.delete(k); },
    clear: () => map.clear(),
    setItem(k, v) {
      const next = used() - (map.has(k) ? k.length + map.get(k).length : 0) + k.length + v.length;
      if (next > quota) { const e = new Error("QuotaExceededError"); e.name = "QuotaExceededError"; throw e; }
      map.set(k, v);
    },
    _keys: () => [...map.keys()],
  };
}

let persist, persistCache;

async function load(storage) {
  vi.stubGlobal("localStorage", storage);
  vi.resetModules();
  ({ persist, persistCache } = await import("../storage.js"));
}

describe("persist", () => {
  beforeEach(() => { vi.unstubAllGlobals(); });

  it("writes normally when there is room", async () => {
    const s = fakeStorage(1000);
    await load(s);
    expect(persist("vai_saved_routes", "trip")).toBe(true);
    expect(s.getItem("vai_saved_routes")).toBe("trip");
  });

  it("evicts caches rather than losing the user's trip", async () => {
    const s = fakeStorage(200);
    await load(s);
    // Fill the quota with disposable cache entries.
    s.setItem("vai_photo3_a", "x".repeat(60));
    s.setItem("vai_pois_Q90", "y".repeat(60));
    // The trip cannot fit alongside them...
    expect(() => s.setItem("vai_saved_routes", "z".repeat(60))).toThrow();
    // ...but persist() makes room by dropping caches.
    expect(persist("vai_saved_routes", "z".repeat(60))).toBe(true);
    expect(s.getItem("vai_saved_routes")).toBe("z".repeat(60));
  });

  it("never sacrifices one piece of user data for another", async () => {
    const s = fakeStorage(200);
    await load(s);
    s.setItem("vai_saved_routes", "trip".repeat(20));
    s.setItem("vai_photo3_a", "x".repeat(50));
    persist("vai_recent_searches", "r".repeat(50));
    // The photo cache may go; the saved trips must not.
    expect(s.getItem("vai_saved_routes")).toBe("trip".repeat(20));
  });

  it("reports failure when even an empty store cannot hold the value", async () => {
    const s = fakeStorage(10);
    await load(s);
    expect(persist("vai_saved_routes", "far too long to ever fit")).toBe(false);
  });

  it("persistCache gives up quietly and evicts nothing", async () => {
    const s = fakeStorage(120);
    await load(s);
    s.setItem("vai_photo3_a", "x".repeat(80));
    expect(persistCache("vai_dest_q_b", "y".repeat(80))).toBe(false);
    // The other cache is untouched — a cache miss is not worth a cascade.
    expect(s.getItem("vai_photo3_a")).toBe("x".repeat(80));
  });
});
