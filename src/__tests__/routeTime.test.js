import { describe, it, expect } from "vitest";
import { parseTime, fmtMin, computeTripNow } from "../routeTime.js";

describe("parseTime", () => {
  it("parses H:MM and HH:MM into minutes since midnight", () => {
    expect(parseTime("9:00")).toBe(540);
    expect(parseTime("14:30")).toBe(870);
    expect(parseTime("09.15")).toBe(555);
  });
  it("returns null for placeholders and nonsense", () => {
    expect(parseTime("—")).toBeNull();
    expect(parseTime("")).toBeNull();
    expect(parseTime(null)).toBeNull();
    expect(parseTime("25:00")).toBeNull();
    expect(parseTime("12:75")).toBeNull();
  });
});

describe("fmtMin", () => {
  it("formats minutes as H:MM", () => {
    expect(fmtMin(540)).toBe("9:00");
    expect(fmtMin(605)).toBe("10:05");
  });
});

describe("computeTripNow", () => {
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const route = (startDate) => ({
    startDate, days: 2,
    itinerary: [
      { day: 1, stops: [
        { name: "A", time: "9:00", dur: 120 },   // 9:00–11:00
        { name: "B", time: "12:00", dur: 60 },   // 12:00–13:00
      ]},
      { day: 2, stops: [{ name: "C", time: "10:00", dur: 60 }] },
    ],
  });

  it("returns null for trips without a start date or outside the window", () => {
    expect(computeTripNow({ itinerary: [] })).toBeNull();
    expect(computeTripNow(route("2000-01-01"), new Date("2020-06-15T10:00:00"))).toBeNull();
  });

  it("phase 'at' while inside a stop's window", () => {
    const today = new Date(); today.setHours(10, 0, 0, 0);
    const now = computeTripNow(route(iso(today)), today);
    expect(now.phase).toBe("at");
    expect(now.currentIndex).toBe(0);
    expect(now.minutesLeft).toBe(60);
  });

  it("phase 'moving' between stops, with minutes until the next one", () => {
    const today = new Date(); today.setHours(11, 30, 0, 0);
    const now = computeTripNow(route(iso(today)), today);
    expect(now.phase).toBe("moving");
    expect(now.nextIndex).toBe(1);
    expect(now.minutesUntilNext).toBe(30);
  });

  it("phase 'done' after the last stop of the day", () => {
    const today = new Date(); today.setHours(20, 0, 0, 0);
    const now = computeTripNow(route(iso(today)), today);
    expect(now.phase).toBe("done");
  });
});
