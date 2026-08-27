import { describe, it, expect } from "vitest";
import { lonRanges } from "../destinations.js";

// Longitudes live in [-180, 180] in the database, but a map viewport doesn't:
// Leaflet happily reports east=184 when you pan past the date line. These cases
// pin down the translation, because the failure mode is silent — the query
// succeeds and simply returns nothing for half the screen.
describe("lonRanges", () => {
  it("passes an ordinary viewport through unchanged", () => {
    expect(lonRanges(2.05, 2.64)).toEqual([[2.05, 2.64]]);
  });

  it("handles a viewport spanning the prime meridian", () => {
    expect(lonRanges(-16.5, 21.3)).toEqual([[-16.5, 21.3]]);
  });

  it("splits a viewport that runs past the antimeridian", () => {
    // Fiji: Leaflet reports 174.77 → 184.22. The eastern 4.22° really lives at
    // -180 → -175.78, which a plain BETWEEN would never reach.
    const [a, b] = lonRanges(174.77050781250003, 184.21875000000003);
    expect(a[0]).toBeCloseTo(174.7705, 4);
    expect(a[1]).toBe(180);
    expect(b[0]).toBe(-180);
    expect(b[1]).toBeCloseTo(-175.78125, 4);
  });

  it("splits when panning the other way, past -180", () => {
    const [a, b] = lonRanges(-184, -176);
    expect(a[0]).toBeCloseTo(176, 6);
    expect(a[1]).toBe(180);
    expect(b[0]).toBe(-180);
    expect(b[1]).toBeCloseTo(-176, 6);
  });

  it("collapses a zoomed-out view of the whole world to one range", () => {
    expect(lonRanges(-400, 400)).toEqual([[-180, 180]]);
  });

  it("treats an exactly-360° span as the whole world", () => {
    expect(lonRanges(-180, 180)).toEqual([[-180, 180]]);
  });
});
