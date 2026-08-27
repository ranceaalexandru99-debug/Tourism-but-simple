import { describe, it, expect, beforeEach, vi } from "vitest";

// A chunk that fails to download is the single most common post-deploy failure
// in a code-split app: the visitor holds the previous index.html and asks for a
// filename the new build no longer has. These pin down that it retries, that it
// reloads only when retrying is hopeless, and — crucially — that it never
// reloads in a loop.

function fakeSessionStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

let lazyWithRetry, clearChunkReloadGuard, reloads;

async function load() {
  reloads = 0;
  vi.stubGlobal("sessionStorage", fakeSessionStorage());
  vi.stubGlobal("window", { location: { reload: () => { reloads++; } } });
  vi.resetModules();
  const mod = await import("../lazyWithRetry.js");
  lazyWithRetry = mod.default;
  clearChunkReloadGuard = mod.clearChunkReloadGuard;
}

// React.lazy stores the factory and only runs it when rendered, so reach in and
// invoke it directly — this tests the retry policy, not React.
const runFactory = (lazyComponent) => lazyComponent._payload._result();

describe("lazyWithRetry", () => {
  beforeEach(async () => { vi.unstubAllGlobals(); await load(); });

  it("passes a successful import straight through", async () => {
    const mod = { default: () => null };
    const C = lazyWithRetry(() => Promise.resolve(mod));
    await expect(runFactory(C)).resolves.toBe(mod);
    expect(reloads).toBe(0);
  });

  it("retries once — a dropped request on a train succeeds a moment later", async () => {
    const mod = { default: () => null };
    let calls = 0;
    const C = lazyWithRetry(() => {
      calls += 1;
      return calls === 1 ? Promise.reject(new Error("network")) : Promise.resolve(mod);
    });
    await expect(runFactory(C)).resolves.toBe(mod);
    expect(calls).toBe(2);
    expect(reloads).toBe(0);
  });

  it("reloads when both attempts fail — the chunk is gone, only a new page can name its replacement", async () => {
    const C = lazyWithRetry(() => Promise.reject(new Error("404")));
    const pending = runFactory(C);
    // Resolving or rejecting here would flash the error screen before the
    // reload lands, so the promise deliberately stays pending.
    let settled = false;
    pending.then(() => { settled = true; }, () => { settled = true; });
    await new Promise((r) => setTimeout(r, 10));
    expect(reloads).toBe(1);
    expect(settled).toBe(false);
  });

  it("reloads at most once per session, then surfaces the error", async () => {
    const C1 = lazyWithRetry(() => Promise.reject(new Error("404")));
    runFactory(C1);
    await new Promise((r) => setTimeout(r, 10));
    expect(reloads).toBe(1);

    // A second failure after the reload must NOT reload again: if a fresh page
    // still cannot fetch the chunk, looping forever is worse than the error.
    const C2 = lazyWithRetry(() => Promise.reject(new Error("404")));
    await expect(runFactory(C2)).rejects.toThrow("404");
    expect(reloads).toBe(1);
  });

  it("clearing the guard lets a later deploy trigger its own reload", async () => {
    const C1 = lazyWithRetry(() => Promise.reject(new Error("404")));
    runFactory(C1);
    await new Promise((r) => setTimeout(r, 10));
    clearChunkReloadGuard();

    const C2 = lazyWithRetry(() => Promise.reject(new Error("404")));
    runFactory(C2);
    await new Promise((r) => setTimeout(r, 10));
    expect(reloads).toBe(2);
  });
});
