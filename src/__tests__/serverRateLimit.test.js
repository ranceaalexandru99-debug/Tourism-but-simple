import { describe, it, expect } from "vitest";
import { createRateLimiter, WINDOW_MS, DEFAULT_MAX } from "../../server/rateLimit.js";

// The limiter is what stands between a stranger and someone else's Anthropic
// bill, and between a stranger and writing crowd-sourced POIs into everybody's
// itineraries. It was broken once in a way that made it completely ineffective
// — the server trusted an IP the client supplied, so rotating a header gave a
// fresh allowance on every request — and the fix was verified only by hand.

const clock = (start = 1_000_000) => {
  let t = start;
  return { now: () => t, advance: (ms) => { t += ms; } };
};

describe("createRateLimiter", () => {
  it("allows exactly `max` requests, then refuses", () => {
    const l = createRateLimiter({ max: 3, now: clock().now });
    expect([l.limited("a"), l.limited("a"), l.limited("a")]).toEqual([false, false, false]);
    expect(l.limited("a")).toBe(true);
    expect(l.limited("a")).toBe(true);
  });

  it("counts each address separately", () => {
    const l = createRateLimiter({ max: 2, now: clock().now });
    l.limited("a"); l.limited("a");
    expect(l.limited("a")).toBe(true);
    // A different visitor is unaffected by the first one's spending.
    expect(l.limited("b")).toBe(false);
  });

  it("forgives once the window has passed", () => {
    const c = clock();
    const l = createRateLimiter({ max: 2, now: c.now });
    l.limited("a"); l.limited("a");
    expect(l.limited("a")).toBe(true);

    c.advance(WINDOW_MS + 1);
    expect(l.limited("a")).toBe(false);
  });

  it("slides rather than resetting on a fixed boundary", () => {
    // Two at the start and two at the end of a window must not both be allowed
    // just because a clock ticked over.
    const c = clock();
    const l = createRateLimiter({ max: 2, now: c.now });
    l.limited("a");
    c.advance(WINDOW_MS / 2);
    l.limited("a");
    c.advance(WINDOW_MS / 2 - 10);        // the first is still inside the window
    expect(l.limited("a")).toBe(true);
  });

  it("uses a sane default when none is given", () => {
    const l = createRateLimiter({ now: clock().now });
    for (let i = 0; i < DEFAULT_MAX; i++) expect(l.limited("a")).toBe(false);
    expect(l.limited("a")).toBe(true);
  });

  it("treats an empty or undefined address as one bucket, not as no limit", () => {
    // req.ip can be undefined behind an odd proxy. That must not become an
    // unlimited allowance.
    const l = createRateLimiter({ max: 2, now: clock().now });
    l.limited(undefined); l.limited(undefined);
    expect(l.limited(undefined)).toBe(true);
  });
});

describe("memory", () => {
  it("does not keep a row per address for ever", () => {
    const c = clock();
    const l = createRateLimiter({ max: 5, now: c.now });
    for (let i = 0; i < 5100; i++) l.limited(`ip-${i}`);
    const before = l.size;

    // Everything ages out, and the next request triggers the sweep.
    c.advance(WINDOW_MS + 1);
    l.limited("fresh");
    expect(l.size).toBeLessThan(before);
    expect(l.size).toBeLessThan(100);
  });

  it("does not sweep away addresses that are still active", () => {
    const c = clock();
    const l = createRateLimiter({ max: 5, now: c.now });
    for (let i = 0; i < 5100; i++) l.limited(`ip-${i}`);
    // "busy" keeps spending right up to the sweep, so it must survive it.
    c.advance(WINDOW_MS + 1);
    l.limited("busy"); l.limited("busy"); l.limited("busy"); l.limited("busy");
    l.limited("busy");
    expect(l.limited("busy")).toBe(true);
  });

  it("reset clears everything", () => {
    const l = createRateLimiter({ max: 1, now: clock().now });
    l.limited("a");
    expect(l.limited("a")).toBe(true);
    l.reset();
    expect(l.limited("a")).toBe(false);
  });
});
