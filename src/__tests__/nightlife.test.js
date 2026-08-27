import { describe, it, expect } from "vitest";
import { assembleRoute } from "../mockEngine.js";

// "Nightlife" is a selectable interest, and bars/clubs are now real itinerary
// stops rather than data that gets fetched and thrown away. Three properties
// have to hold at once, and they pull against each other:
//   • a traveller who did NOT ask for nightlife must never get a bar;
//   • one who did must actually get some;
//   • and they must land in the evening, not open the day at 9:00.

const stop = (name, tags, dur = 60) => ({ name, tags, dur, cost: 0, hours: "—", ll: [0, 0] });

// Shaped like poiDb.buildDest output: sights plus a realistic run of bars.
const dest = {
  key: "osm",
  name: "Boston",
  country: "US",
  emoji: "📍",
  blurb: "",
  center: [42.36, -71.06],
  pois: [
    stop("Museum of Fine Arts", ["culture"], 90),
    stop("Faneuil Hall", ["culture"], 40),
    stop("Boston Common", ["nature", "family"], 60),
    stop("Bunker Hill Monument", ["culture"], 40),
    stop("Charles River Esplanade", ["nature"], 60),
    stop("Isabella Stewart Gardner", ["culture"], 90),
    stop("The Plough and Stars", ["nightlife"], 75),
    stop("Cask 'n Flagon", ["nightlife"], 75),
    stop("Cheers Beacon Hill", ["nightlife"], 75),
    stop("Royale", ["nightlife"], 150),
  ],
  food: ["🍽 Neptune Oyster"],
  transport: "walk",
};

const base = { days: 2, pace: "balanced", budget: "mediu", startDate: null };
const allStops = (r) => r.itinerary.flatMap((d) => d.stops);
const isNight = (s) => s.tags.includes("nightlife");

describe("nightlife stops", () => {
  it("never appear when the traveller did not ask for them", () => {
    for (const interests of [["culture"], ["nature"], ["culture", "food"], []]) {
      const route = assembleRoute(dest, { ...base, interests });
      expect(allStops(route).filter(isNight)).toEqual([]);
    }
  });

  it("appear when nightlife is selected", () => {
    const route = assembleRoute(dest, { ...base, interests: ["nightlife"] });
    expect(allStops(route).filter(isNight).length).toBeGreaterThan(0);
  });

  it("are capped so a day is not just a pub crawl", () => {
    const route = assembleRoute(dest, { ...base, interests: ["nightlife"], pace: "packed" });
    for (const day of route.itinerary) {
      expect(day.stops.filter(isNight).length).toBeLessThanOrEqual(2);
    }
  });

  it("are scheduled at the end of the day, never first", () => {
    const route = assembleRoute(dest, { ...base, interests: ["nightlife", "culture"] });
    for (const day of route.itinerary) {
      const idx = day.stops.map((s, i) => (isNight(s) ? i : -1)).filter((i) => i >= 0);
      if (!idx.length) continue;
      // Every nightlife stop sits after every daytime one.
      const lastDay = day.stops.map((s, i) => (isNight(s) ? -1 : i)).filter((i) => i >= 0).pop();
      expect(Math.min(...idx)).toBeGreaterThan(lastDay ?? -1);
      // And carries a genuine evening hour — position alone is not enough,
      // since a four-stop day would otherwise put the last one at 15:30.
      for (const i of idx) expect(["20:00", "21:30", "23:00", "00:30"]).toContain(day.stops[i].time);
    }
  });

  it("keeps sights that merely happen to be good after dark", () => {
    // The curated destinations tag places like "Montmartre & Sacré-Cœur" as
    // ["culture","nightlife"] — the tag means "also lovely in the evening",
    // not "this is a bar". Gating on `includes("nightlife")` deleted Montmartre
    // from a culture traveller's Paris, so the rule is "nightlife AND NOTHING
    // ELSE" instead.
    const withMontmartre = {
      ...dest,
      pois: [...dest.pois, stop("Montmartre", ["culture", "nightlife"], 90)],
    };
    const route = assembleRoute(withMontmartre, { ...base, days: 3, interests: ["culture"] });
    expect(allStops(route).map((s) => s.name)).toContain("Montmartre");
  });

  it("opens a club later than a bar, and puts the bar first", () => {
    const withClubs = {
      ...dest,
      pois: [
        ...dest.pois.filter((p) => !p.tags.includes("nightlife")),
        { ...stop("Joben Bistro", ["nightlife"], 75), category: "bar" },
        { ...stop("Club NOA", ["nightlife"], 150), category: "nightclub" },
      ],
    };
    const route = assembleRoute(withClubs, { ...base, days: 1, interests: ["nightlife", "culture"] });
    const night = route.itinerary[0].stops.filter(isNight);
    expect(night.map((s) => s.name)).toEqual(["Joben Bistro", "Club NOA"]);
    expect(night[0].time).toBe("20:00");
    expect(night[1].time).toBe("23:00");
  });

  it("pairs an early venue with a late one, so the night runs late", () => {
    const night = (name, dur, category) => ({ ...stop(name, ["nightlife"], dur), category });
    const berlin = {
      ...dest,
      pois: [
        ...dest.pois.filter((p) => !p.tags.includes("nightlife")),
        night("Klunkerkranich", 75, "bar"),
        night("SO36", 120, "livemusic"),
        night("Spielbank", 90, "casino"),
        night("Berghain", 150, "nightclub"),
      ],
    };
    const route = assembleRoute(berlin, { ...base, interests: ["nightlife", "culture"] });
    for (const day of route.itinerary) {
      const n = day.stops.filter(isNight);
      if (n.length < 2) continue;
      // Dealing strictly by opening hour gave both seats to the two earliest
      // kinds, so clubs never appeared at all — the last stop must be a late one.
      expect(["22:00", "23:00", "23:30", "00:30"]).toContain(n[n.length - 1].time);
    }
  });

  it("spreads a short list across the nights instead of spending it on the first", () => {
    const night = (name) => ({ ...stop(name, ["nightlife"], 75), category: "bar" });
    const twoBars = {
      ...dest,
      pois: [
        ...dest.pois.filter((p) => !p.tags.includes("nightlife")),
        night("Joben"), night("Enigma"),
      ],
    };
    const route = assembleRoute(twoBars, { ...base, days: 2, interests: ["nightlife", "culture"] });
    // One each, not both on night one leaving night two dry.
    for (const day of route.itinerary) {
      expect(day.stops.filter(isNight).length).toBe(1);
    }
  });

  it("does not schedule a venue before it opens", () => {
    // Timișoara's "Beer Pub" opens at 21:00 and was landing in the 20:00 slot,
    // an hour before the door unlocks. Venues whose hours OSM knows are ordered
    // so the earliest opener takes the earliest seat.
    const bar = (name, opensMin) => ({ ...stop(name, ["nightlife"], 75), category: "bar", opensMin });
    const city = {
      ...dest,
      pois: [
        ...dest.pois.filter((p) => !p.tags.includes("nightlife")),
        bar("Beer Pub", 21 * 60),      // opens 21:00 — cannot take the 20:00 seat
        bar("Aethernativ", 17 * 60),   // opens 17:00 — can
      ],
    };
    const route = assembleRoute(city, { ...base, days: 1, interests: ["nightlife", "culture"] });
    const first = route.itinerary[0].stops.filter(isNight)[0];
    expect(first.name).toBe("Aethernativ");
    expect(first.time).toBe("20:00");
  });

  it("prefers a venue with verified hours over one with none", () => {
    // Ranking purely on opening time sorted every unknown-hours venue (null → 0)
    // ahead of every known one, so Timișoara's route picked three venues OSM
    // knows nothing about and skipped the bars with a published schedule.
    const bar = (name, opensMin) => ({ ...stop(name, ["nightlife"], 75), category: "bar", opensMin });
    const city = {
      ...dest,
      pois: [
        ...dest.pois.filter((p) => !p.tags.includes("nightlife")),
        bar("Unknown Hours", null),
        bar("Aethernativ", 17 * 60),   // verified, and open by 20:00
      ],
    };
    const route = assembleRoute(city, { ...base, days: 1, interests: ["nightlife", "culture"] });
    expect(route.itinerary[0].stops.filter(isNight)[0].name).toBe("Aethernativ");
  });

  it("still produces a usable route when nightlife is the only interest", () => {
    const route = assembleRoute(dest, { ...base, interests: ["nightlife"] });
    expect(route.totalStops).toBeGreaterThan(0);
    expect(route.themeKey).toBe("evening");
  });
});
