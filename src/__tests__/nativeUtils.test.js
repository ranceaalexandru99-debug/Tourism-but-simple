import { describe, it, expect, vi, afterEach } from "vitest";
import { fmtDate, computeTripStats, tripStatus } from "../../mobile-native/src/lib/utils.js";

// The numbers on the recap card and the badge on a saved trip. Both are read
// at a glance and believed, which is exactly the kind of thing that can be
// wrong for a long time without anyone querying it.

const stop = (over = {}) => ({ name: "s", time: "10:00", ll: null, cost: 0, tags: [], ...over });
const route = (over = {}) => ({
  id: "t1", destName: "Brașov", days: 3, startDate: "2026-09-10",
  itinerary: [{ day: 1, date: "2026-09-10", stops: [stop(), stop()] }],
  ...over,
});

afterEach(() => { vi.useRealTimers(); });

describe("fmtDate", () => {
  it("formats a date in the given language", () => {
    expect(fmtDate("2026-09-10", "en")).toMatch(/Sep/);
    expect(fmtDate("2026-09-10", "ro")).toMatch(/sept/i);
  });

  it("maps zh to the locale that actually exists", () => {
    // "zh" alone is not a locale Intl resolves the way this app wants.
    expect(fmtDate("2026-09-10", "zh")).toMatch(/9|月/);
  });

  it("reads the date as local, not UTC", () => {
    // Parsing "2026-09-10" bare gives UTC midnight, which is the day BEFORE
    // in any negative offset — the album had exactly this bug once.
    expect(fmtDate("2026-09-10", "en")).toMatch(/10/);
  });

  it("returns an empty string rather than 'Invalid Date'", () => {
    expect(fmtDate("", "en")).toBe("");
    expect(fmtDate(null, "en")).toBe("");
    expect(fmtDate("not-a-date", "en")).toBe("");
  });
});

describe("computeTripStats", () => {
  it("returns null for a route with no itinerary", () => {
    expect(computeTripStats(null)).toBeNull();
    expect(computeTripStats({ itinerary: [] })).toBeNull();
  });

  it("counts what was visited out of the total", () => {
    const r = route({ itinerary: [{ stops: [stop({ done: true }), stop(), stop()] }] });
    const s = computeTripStats(r);
    expect(s.visitedCount).toBe(1);
    expect(s.totalCount).toBe(3);
    expect(s.complete).toBe(false);
  });

  it("is complete only when every stop is done", () => {
    const all = route({ itinerary: [{ stops: [stop({ done: true }), stop({ done: true })] }] });
    expect(computeTripStats(all).complete).toBe(true);
  });

  it("is NOT complete for a trip with no stops visited", () => {
    // 0 of 0 must not read as a finished trip.
    const none = route({ itinerary: [{ stops: [stop(), stop()] }] });
    expect(computeTripStats(none).complete).toBe(false);
  });

  it("counts only distance actually walked, between stops both marked done", () => {
    const a = [45.6427, 25.5887], b = [45.5930, 25.5510];
    const halfDone = route({ itinerary: [{ stops: [stop({ ll: a, done: true }), stop({ ll: b })] }] });
    expect(computeTripStats(halfDone).kmWalked).toBe(0);

    const bothDone = route({ itinerary: [{ stops: [stop({ ll: a, done: true }), stop({ ll: b, done: true })] }] });
    expect(computeTripStats(bothDone).kmWalked).toBeGreaterThan(5);
  });

  it("tallies categories from visited stops only", () => {
    const r = route({ itinerary: [{ stops: [
      stop({ done: true, tags: ["museum", "landmark"] }),
      stop({ done: true, tags: ["museum"] }),
      stop({ tags: ["park"] }),                     // not visited
    ] }] });
    expect(computeTripStats(r).categories).toEqual({ museum: 2, landmark: 1 });
  });

  it("adds up what was spent, ignoring stops not visited", () => {
    const r = route({ itinerary: [{ stops: [
      stop({ done: true, cost: 12 }), stop({ done: true, cost: 3 }), stop({ cost: 100 }),
    ] }] });
    expect(computeTripStats(r).spent).toBe(15);
  });

  it("picks the highest-rated visited stop, and none when nothing was rated", () => {
    const rated = route({ itinerary: [{ stops: [
      stop({ name: "ok", done: true, rating: 3 }),
      stop({ name: "best", done: true, rating: 5 }),
    ] }] });
    expect(computeTripStats(rated).topRated.name).toBe("best");

    const unrated = route({ itinerary: [{ stops: [stop({ done: true })] }] });
    expect(computeTripStats(unrated).topRated).toBeNull();
  });

  it("survives stops with no tags, cost or coordinates", () => {
    const r = route({ itinerary: [{ stops: [{ name: "bare", done: true }] }] });
    const s = computeTripStats(r);
    expect(s.spent).toBe(0);
    expect(s.categories).toEqual({});
    expect(Number.isFinite(s.kmWalked)).toBe(true);
  });
});

describe("tripStatus", () => {
  const at = (iso) => vi.setSystemTime(new Date(`${iso}T12:00:00`));

  it("returns null when there is no start date to judge by", () => {
    expect(tripStatus({ days: 3 })).toBeNull();
    expect(tripStatus(null)).toBeNull();
  });

  it("counts the days until an upcoming trip", () => {
    vi.useFakeTimers(); at("2026-09-07");
    expect(tripStatus({ startDate: "2026-09-10", days: 3 }))
      .toEqual({ phase: "upcoming", daysUntil: 3 });
  });

  it("says ongoing on the first day, not upcoming", () => {
    vi.useFakeTimers(); at("2026-09-10");
    const s = tripStatus({ startDate: "2026-09-10", days: 3 });
    expect(s.phase).toBe("ongoing");
    expect(s.currentDay).toBe(1);
    expect(s.of).toBe(3);
  });

  it("says ongoing on the last day, and finished the day after", () => {
    vi.useFakeTimers();
    at("2026-09-12");
    expect(tripStatus({ startDate: "2026-09-10", days: 3 }).phase).toBe("ongoing");
    at("2026-09-13");
    expect(tripStatus({ startDate: "2026-09-10", days: 3 }).phase).toBe("past");
  });

  it("reports progress across the trip", () => {
    vi.useFakeTimers(); at("2026-09-11");
    const s = tripStatus({ startDate: "2026-09-10", days: 4 });
    expect(s.progress).toBeCloseTo(0.5, 5);
  });

  it("ignores the time of day", () => {
    // Late at night on the first day is still day one, not day two.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T23:59:00"));
    expect(tripStatus({ startDate: "2026-09-10", days: 3 }).currentDay).toBe(1);
  });
});
