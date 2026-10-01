import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { ownedByNearestCity, metres } from "../osmCurate.js";

// A wide Overpass radius annexes the neighbours.
//
// The crawler asks within 5 km of a city centroid. That was writing off cities
// whose sights are spread out — Port Harcourt, 3.3 million people, found 2
// sightseeing stops at 5 km and 18 at 20 km — so scripts/retry-barren.mjs asks
// again at 10 and 20 km.
//
// At 20 km a query is no longer about one city. Without this guard, Suez would
// list a stop that sits inside the next town and the explore map would send
// someone there believing it was in Suez.

const CAIRO = { id: "Q85", n: "Cairo", ll: [30.0444, 31.2357] };
const GIZA = { id: "Q83618", n: "Giza", ll: [30.0131, 31.2089] };

const at = (name, ll) => ({ name, ll, category: "landmark" });

describe("who a stop belongs to", () => {
  it("keeps everything when the city has no neighbour in the index", () => {
    const pois = [at("undeva", [30.2, 31.4])];
    expect(ownedByNearestCity(pois, CAIRO, []).kept).toEqual(pois);
  });

  it("gives a stop to whichever city centre is nearer", () => {
    // Deliberately placed 500 m from Giza's centre and ~20 km from Cairo's.
    const sphinx = at("Sfinxul", [30.0175, 31.2089]);
    const tahrir = at("Tahrir", [30.0444, 31.2357]);
    const { kept, annexed } = ownedByNearestCity([sphinx, tahrir], CAIRO, [GIZA]);

    expect(kept.map((p) => p.name)).toEqual(["Tahrir"]);
    expect(annexed).toEqual([{ name: "Sfinxul", to: "Giza" }]);
  });

  it("is symmetric — the same stop stays when Giza is the one asking", () => {
    const sphinx = at("Sfinxul", [30.0175, 31.2089]);
    const { kept, annexed } = ownedByNearestCity([sphinx], GIZA, [CAIRO]);
    expect(kept).toHaveLength(1);
    expect(annexed).toEqual([]);
  });

  it("cedes a landmark to the town it is actually in, against the real index", () => {
    // The Palace of Versailles is 17 km from the centre of Paris. Versailles is
    // its own entry in the index, 1 km away, so the palace is Versailles's and
    // the rule says so — which is what we want here: this guard only ever runs
    // for a city that has NO objectives at all, and ceding a stop to a
    // neighbour that already lists it loses nobody anything.
    //
    // It is also the rule's price, stated plainly: a 20 km query will not hand
    // Paris its suburbs. Paris is not a city this script touches.
    const palace = at("Château de Versailles", [48.8049, 2.1204]);
    const paris = { id: "Q90", n: "Paris", ll: [48.8566, 2.3522] };
    const cities = JSON.parse(fs.readFileSync("src/destinations.json", "utf8"));
    const near = cities.filter(
      (o) => o.id !== paris.id
        && Math.abs(o.ll[0] - paris.ll[0]) < 0.6
        && Math.abs(o.ll[1] - paris.ll[1]) < 0.6,
    );

    expect(metres(paris.ll, palace.ll)).toBeGreaterThan(15000);
    const { kept, annexed } = ownedByNearestCity([palace], paris, near);
    expect(kept).toEqual([]);
    expect(annexed[0].to).toBe("Versailles");
  });
});
