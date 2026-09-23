import { describe, it, expect } from "vitest";
import {
  haversineKm, travelBetween, dayDistanceKm, optimizeItinerary,
} from "../../mobile-native/src/lib/geo.js";

// Distances and the reordering built on them. These numbers are shown to the
// user — "🚶 12 min", "3.4 km" — and drive the "optimise the route" button, so
// being quietly wrong here is being wrong in a way nobody would question.

// Real coordinates, so the expected distances can be checked against reality.
const PIATA_SFATULUI = [45.6427, 25.5887];
const BISERICA_NEAGRA = [45.6410, 25.5876];   // ~200 m away
const POIANA_BRASOV   = [45.5930, 25.5510];   // ~6.5 km away
const BUCURESTI       = [44.4268, 26.1025];   // ~140 km away

const stop = (name, ll, over = {}) => ({ name, ll, time: "10:00", ...over });

describe("haversineKm", () => {
  it("is zero for the same point", () => {
    expect(haversineKm(PIATA_SFATULUI, PIATA_SFATULUI)).toBe(0);
  });

  it("matches a known short distance", () => {
    expect(haversineKm(PIATA_SFATULUI, BISERICA_NEAGRA)).toBeCloseTo(0.2, 1);
  });

  it("matches a known long distance", () => {
    // Brașov to Bucharest is about 140 km as the crow flies.
    expect(haversineKm(PIATA_SFATULUI, BUCURESTI)).toBeGreaterThan(130);
    expect(haversineKm(PIATA_SFATULUI, BUCURESTI)).toBeLessThan(150);
  });

  it("is symmetric", () => {
    expect(haversineKm(PIATA_SFATULUI, POIANA_BRASOV))
      .toBeCloseTo(haversineKm(POIANA_BRASOV, PIATA_SFATULUI), 9);
  });

  it("returns null rather than NaN when a coordinate is missing", () => {
    expect(haversineKm(null, PIATA_SFATULUI)).toBeNull();
    expect(haversineKm(PIATA_SFATULUI, undefined)).toBeNull();
  });

  it("handles crossing the equator and the prime meridian", () => {
    expect(haversineKm([-1, -1], [1, 1])).toBeGreaterThan(0);
  });
});

describe("travelBetween", () => {
  it("calls a short hop a walk", () => {
    const t = travelBetween(stop("a", PIATA_SFATULUI), stop("b", BISERICA_NEAGRA));
    expect(t.walk).toBe(true);
    expect(t.emoji).toBe("🚶");
  });

  it("calls a long hop transit", () => {
    const t = travelBetween(stop("a", PIATA_SFATULUI), stop("b", POIANA_BRASOV));
    expect(t.walk).toBe(false);
    expect(t.emoji).toBe("🚌");
  });

  it("shows metres under a kilometre and kilometres above", () => {
    expect(travelBetween(stop("a", PIATA_SFATULUI), stop("b", BISERICA_NEAGRA)).dist).toMatch(/^\d+ m$/);
    expect(travelBetween(stop("a", PIATA_SFATULUI), stop("b", POIANA_BRASOV)).dist).toMatch(/^\d+\.\d km$/);
  });

  it("never says zero minutes, however close the stops are", () => {
    // "0 min" reads as a bug; one minute is the honest floor.
    const t = travelBetween(stop("a", PIATA_SFATULUI), stop("b", PIATA_SFATULUI));
    expect(t.minutes).toBeGreaterThanOrEqual(1);
  });

  it("gives a plausible walking time", () => {
    // 200 m on foot is a few minutes, not an hour.
    const t = travelBetween(stop("a", PIATA_SFATULUI), stop("b", BISERICA_NEAGRA));
    expect(t.minutes).toBeLessThanOrEqual(5);
  });

  it("returns null when either stop has no coordinates", () => {
    expect(travelBetween(stop("a", null), stop("b", PIATA_SFATULUI))).toBeNull();
    expect(travelBetween(null, stop("b", PIATA_SFATULUI))).toBeNull();
  });
});

describe("dayDistanceKm", () => {
  it("adds up the hops", () => {
    const stops = [stop("a", PIATA_SFATULUI), stop("b", BISERICA_NEAGRA), stop("c", POIANA_BRASOV)];
    const expected = haversineKm(PIATA_SFATULUI, BISERICA_NEAGRA)
      + haversineKm(BISERICA_NEAGRA, POIANA_BRASOV);
    expect(dayDistanceKm(stops)).toBeCloseTo(expected, 6);
  });

  it("is zero for a single stop or none", () => {
    expect(dayDistanceKm([stop("a", PIATA_SFATULUI)])).toBe(0);
    expect(dayDistanceKm([])).toBe(0);
  });

  it("skips hops it cannot measure instead of producing NaN", () => {
    const stops = [stop("a", PIATA_SFATULUI), stop("b", null), stop("c", BISERICA_NEAGRA)];
    expect(Number.isFinite(dayDistanceKm(stops))).toBe(true);
  });
});

describe("optimizeItinerary", () => {
  const day = (stops) => ({ day: 1, date: "2026-09-10", stops });

  it("shortens a deliberately bad order", () => {
    // Far, near, far again — the worst arrangement of these three.
    const bad = day([
      stop("start", PIATA_SFATULUI, { time: "09:00" }),
      stop("far", POIANA_BRASOV, { time: "11:00" }),
      stop("near", BISERICA_NEAGRA, { time: "13:00" }),
    ]);
    const before = dayDistanceKm(bad.stops);
    const after = dayDistanceKm(optimizeItinerary([bad])[0].stops);
    expect(after).toBeLessThan(before);
  });

  it("keeps the first stop as the anchor", () => {
    const d = day([
      stop("start", PIATA_SFATULUI),
      stop("far", POIANA_BRASOV),
      stop("near", BISERICA_NEAGRA),
    ]);
    expect(optimizeItinerary([d])[0].stops[0].name).toBe("start");
  });

  it("keeps the time slots in order, so the schedule still reads sensibly", () => {
    const d = day([
      stop("start", PIATA_SFATULUI, { time: "09:00" }),
      stop("far", POIANA_BRASOV, { time: "11:00" }),
      stop("near", BISERICA_NEAGRA, { time: "13:00" }),
    ]);
    expect(optimizeItinerary([d])[0].stops.map((s) => s.time)).toEqual(["09:00", "11:00", "13:00"]);
  });

  it("loses no stops, and sends the ones without coordinates to the end", () => {
    const d = day([
      stop("start", PIATA_SFATULUI),
      stop("nowhere", null),
      stop("far", POIANA_BRASOV),
      stop("near", BISERICA_NEAGRA),
    ]);
    const out = optimizeItinerary([d])[0].stops;
    expect(out).toHaveLength(4);
    expect(out[out.length - 1].name).toBe("nowhere");
  });

  it("leaves a day of two or fewer alone — there is nothing to improve", () => {
    const d = day([stop("a", PIATA_SFATULUI), stop("b", POIANA_BRASOV)]);
    expect(optimizeItinerary([d])[0]).toBe(d);
  });

  it("saves nothing measurable on a day that is already in the best order", () => {
    // The native screen only offers the button when the saving clears 200 m.
    // On a compact old town the reorder is often a no-op, and a button that
    // changes nothing reads as a broken one.
    const tidy = day([
      stop("a", PIATA_SFATULUI),
      stop("b", BISERICA_NEAGRA),
      stop("c", POIANA_BRASOV),
    ]);
    const before = dayDistanceKm(tidy.stops);
    const after = dayDistanceKm(optimizeItinerary([tidy])[0].stops);
    expect(before - after).toBeLessThan(0.2);
  });

  it("saves a measurable distance on a day that is not", () => {
    const messy = day([
      stop("start", PIATA_SFATULUI),
      stop("far", POIANA_BRASOV),
      stop("near", BISERICA_NEAGRA),
    ]);
    const before = dayDistanceKm(messy.stops);
    const after = dayDistanceKm(optimizeItinerary([messy])[0].stops);
    expect(before - after).toBeGreaterThan(0.2);
  });

  it("does not mutate the itinerary it was given", () => {
    const d = day([
      stop("start", PIATA_SFATULUI),
      stop("far", POIANA_BRASOV),
      stop("near", BISERICA_NEAGRA),
    ]);
    const names = d.stops.map((s) => s.name);
    optimizeItinerary([d]);
    expect(d.stops.map((s) => s.name)).toEqual(names);
  });
});
