import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Constants from "expo-constants";

// The module that decides whether someone gets what they paid for.
//
// Two things here are easy to get wrong in opposite directions. Lock a paying
// subscriber out because their plane has no signal, or hand the paid features
// to everyone because a key is missing. Both have to be right, and neither is
// visible from the UI until it is wrong for a real person.
//
// react-native and expo-constants are aliased to stubs (vite.config.js);
// react-native-purchases is not installed for the web tests, which is exactly
// the Expo Go situation the lazy import exists to survive.

const KEY = "vai_premium";

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    get _map() { return map; },
  };
}

async function load({ stored = {}, apiKey = null } = {}) {
  vi.stubGlobal("localStorage", memoryStorage(stored));
  Constants.expoConfig.extra = apiKey ? { revenueCatAndroidKey: apiKey } : {};
  vi.resetModules();
  return import("../../mobile-native/src/lib/premium.js");
}

afterEach(() => { vi.unstubAllGlobals(); });

describe("without the billing SDK present (Expo Go)", () => {
  it("reports billing unavailable rather than failing to load", async () => {
    const p = await load();
    expect(p.billingAvailable()).toBe(false);
    expect(p.billingConfigured).toBe(false);
  });

  it("entitles nobody, so the paid screens stay locked", async () => {
    const p = await load();
    expect(p.isPremium()).toBe(false);
  });

  it("refuses to pretend a purchase happened", async () => {
    const p = await load();
    await expect(p.purchase({})).rejects.toThrow("notconfigured");
    await expect(p.restore()).rejects.toThrow("notconfigured");
  });

  it("offers no package to buy", async () => {
    const p = await load();
    await expect(p.getOffering()).resolves.toBeNull();
  });

  it("initPremium resolves false instead of hanging or throwing", async () => {
    const p = await load();
    await expect(p.initPremium()).resolves.toBe(false);
  });

  it("stays unconfigured even WITH a key, when the SDK is absent", async () => {
    // billingConfigured is key AND sdk — a key alone must not make the app
    // believe it can take money.
    const p = await load({ apiKey: "goog_abc123" });
    expect(p.billingConfigured).toBe(false);
  });
});

describe("the cached answer", () => {
  it("restores a subscriber immediately on boot, before the store replies", async () => {
    // Read synchronously at module load: a returning subscriber must not be
    // locked out for the second it takes to reach the network.
    const p = await load({ stored: { [KEY]: "1" } });
    expect(p.isPremium()).toBe(true);
  });

  it("treats anything other than \"1\" as not entitled", async () => {
    for (const v of ["0", "", "true", "yes"]) {
      const p = await load({ stored: { [KEY]: v } });
      expect(p.isPremium()).toBe(v === "1");
    }
  });

  it("survives storage that throws, rather than taking the app down", async () => {
    vi.stubGlobal("localStorage", {
      getItem() { throw new Error("no storage"); },
      setItem() { throw new Error("no storage"); },
    });
    Constants.expoConfig.extra = {};
    vi.resetModules();
    const p = await import("../../mobile-native/src/lib/premium.js");
    expect(p.isPremium()).toBe(false);
  });
});

describe("unlockForTesting", () => {
  it("grants and revokes, and writes the decision down", async () => {
    const p = await load();
    p.unlockForTesting(true);
    expect(p.isPremium()).toBe(true);
    expect(localStorage.getItem(KEY)).toBe("1");

    p.unlockForTesting(false);
    expect(p.isPremium()).toBe(false);
    expect(localStorage.getItem(KEY)).toBe("0");
  });
});

describe("onPremiumChange", () => {
  it("tells subscribers when the entitlement changes", async () => {
    const p = await load();
    const seen = [];
    p.onPremiumChange((v) => seen.push(v));
    p.unlockForTesting(true);
    p.unlockForTesting(false);
    expect(seen).toEqual([true, false]);
  });

  it("says nothing when the value did not actually change", async () => {
    // Without this a renewal arriving every few minutes would re-render every
    // screen watching the entitlement.
    const p = await load();
    const seen = [];
    p.onPremiumChange((v) => seen.push(v));
    p.unlockForTesting(false);   // already false
    expect(seen).toEqual([]);
  });

  it("unsubscribes cleanly", async () => {
    const p = await load();
    const seen = [];
    const off = p.onPremiumChange((v) => seen.push(v));
    off();
    p.unlockForTesting(true);
    expect(seen).toEqual([]);
  });

  it("one listener throwing does not stop the others", async () => {
    const p = await load();
    const seen = [];
    p.onPremiumChange(() => { throw new Error("bad listener"); });
    p.onPremiumChange((v) => seen.push(v));
    expect(() => p.unlockForTesting(true)).not.toThrow();
    expect(seen).toEqual([true]);
  });
});

describe("the entitlement name", () => {
  it("is exactly what RevenueCat must be configured with", async () => {
    // Documented in docs/play-store-readiness.md; a typo here is a silent
    // "nobody is ever entitled".
    const p = await load();
    expect(p.ENTITLEMENT).toBe("premium");
  });
});
