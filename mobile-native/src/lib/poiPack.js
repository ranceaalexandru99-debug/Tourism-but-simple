// Real objectives for 4,769 cities, from inside the app bundle.
//
// The native app used to have hand-written objectives for 19 cities and a
// generic "Centrul istoric / Muzeul orașului / Parcul orașului" for the other
// 4,980. These are the crawled OpenStreetMap objectives — 265,740 of them —
// packed by scripts/pack-native-pois.mjs.
//
// Nothing here touches the network. That is the point: the web app can query a
// database for a city's sights, and an offline-first phone app cannot.
//
// WHAT IS LOADED WHEN. Only index.json (57 KB) at startup. The objectives sit
// in 60 shards of about 600 KB; opening a city evaluates exactly one, once, and
// it stays in memory afterwards. Opening a second city in the same shard costs
// nothing.
//
// Data © OpenStreetMap contributors (ODbL).

import INDEX from "../data/pois/index.json";
import { shardLoaders } from "./poiShards.js";

const loaded = [];

// A city's objectives, or null when it has none packed — 230 cities, almost
// all of them villages the crawler found too little in. Those go to osmLive.js,
// which asks OpenStreetMap on the spot.
export function loadPackedPois(qid) {
  if (!qid) return null;
  const shard = INDEX[qid];
  if (shard === undefined) return null;
  try {
    if (!loaded[shard]) loaded[shard] = shardLoaders[shard]();
    const pois = loaded[shard][qid];
    if (!pois?.length) return null;
    return {
      qid,
      source: "osm",
      attribution: "© OpenStreetMap contributors",
      pois,
    };
  } catch {
    // A shard that fails to parse must not take the trip down with it — the
    // caller falls back to the generic itinerary, which is what happened for
    // every city before this module existed.
    return null;
  }
}
