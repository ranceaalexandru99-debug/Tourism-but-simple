import { describe, it, expect } from "vitest";
import { generateRoute } from "../mockEngine.js";

// Regression guard for a whole class of bug: matching a destination by plain
// substring. "România" contains "roma", "Ontario" contains "rio", "Balikpapan"
// contains "bali" — each used to hijack the tier ladder and return a curated
// itinerary for an entirely different city (Romanian users searching their own
// country got a Rome trip, map and phrasebook included).
const PREFS = { days: 2, interests: ["culture"], pace: "balanced", budget: "mediu" };
const destFor = (destination) => generateRoute({ ...PREFS, destination }).destName;

describe("destination matching is whole-word, not substring", () => {
  it.each([
    ["România", "Roma"],
    ["Romania", "Roma"],
    ["Ontario", "Rio de Janeiro"],
    ["Balikpapan", "Bali"],
    ["Paradis", "Arad"],
  ])("%s must not resolve to the curated %s", (query, wrongCity) => {
    expect(destFor(query)).not.toBe(wrongCity);
  });

  it.each([
    ["Roma", "Roma"],
    ["Roma 2 zile", "Roma"],
    ["Roma, un weekend", "Roma"],
    ["New York", "New York"],
    ["Rio de Janeiro", "Rio de Janeiro"],
    ["Brașov", "Brașov"],
  ])("%s still resolves to the curated %s", (query, city) => {
    expect(destFor(query)).toBe(city);
  });
});
