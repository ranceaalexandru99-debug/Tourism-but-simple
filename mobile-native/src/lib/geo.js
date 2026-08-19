// Geographic helpers used for travel estimates between stops and for
// reordering a day by proximity — all from the coordinates we already have.

export function haversineKm(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const la1 = (a[0] * Math.PI) / 180;
  const la2 = (b[0] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Estimate the hop between two consecutive stops. Short hops = walk, longer =
// transit. Returns null if either stop lacks coordinates.
export function travelBetween(a, b) {
  const km = haversineKm(a && a.ll, b && b.ll);
  if (km == null) return null;
  const walk = km <= 1.4;
  const speed = walk ? 4.8 : 18; // km/h (transit incl. waiting)
  const minutes = Math.max(1, Math.round((km / speed) * 60));
  const dist = km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
  return { km, minutes, walk, emoji: walk ? "🚶" : "🚌", dist };
}

// Total travel distance (km) across a day, for comparing before/after.
export function dayDistanceKm(stops) {
  let sum = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    const d = haversineKm(stops[i].ll, stops[i + 1].ll);
    if (d != null) sum += d;
  }
  return sum;
}

// Greedy nearest-neighbour reorder of each day's stops to cut walking.
// Keeps the first stop as the anchor; stops without coordinates go last.
// Time slots are reassigned to the new order so the schedule stays sensible.
export function optimizeItinerary(itinerary) {
  return itinerary.map((day) => {
    const times = day.stops.map((s) => s.time);
    const withLL = day.stops.filter((s) => s.ll);
    const noLL = day.stops.filter((s) => !s.ll);
    if (withLL.length <= 2) return day;

    const remaining = [...withLL];
    const ordered = [remaining.shift()];
    while (remaining.length) {
      const last = ordered[ordered.length - 1];
      let bi = 0, bd = Infinity;
      remaining.forEach((s, i) => {
        const d = haversineKm(last.ll, s.ll);
        if (d < bd) { bd = d; bi = i; }
      });
      ordered.push(remaining.splice(bi, 1)[0]);
    }

    const stops = [...ordered, ...noLL].map((s, i) => ({ ...s, time: times[i] ?? s.time }));
    return { ...day, stops };
  });
}
