// Small utilities shared across screens. Keep this file tiny — anything
// specific to a single screen stays with that screen.

// Localized short date, e.g. en "Tue, Jul 14" · ja "7月14日(火)".
export function fmtDate(iso, locale) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return "";
  return d.toLocaleDateString(
    locale === "zh" ? "zh-CN" : locale || "en",
    { weekday: "short", day: "numeric", month: "short" },
  );
}

// Aggregate high-level stats for a route, so the summary card can show the
// trip at a glance. Distances come from geo.js; categories are tallied from
// each stop's `tags`; visited count is the sum of `stop.done` across days.
// `topRated` is the highest-rated stop the user has scored (>0 stars).
export function computeTripStats(route) {
  if (!route?.itinerary?.length) return null;
  const allStops = route.itinerary.flatMap((d) => d.stops);
  const visited = allStops.filter((s) => s.done);
  let kmWalked = 0;
  for (const day of route.itinerary) {
    for (let i = 0; i < day.stops.length - 1; i++) {
      const a = day.stops[i], b = day.stops[i + 1];
      if (a.ll && b.ll && a.done && b.done) {
        const R = 6371;
        const dLat = ((b.ll[0] - a.ll[0]) * Math.PI) / 180;
        const dLng = ((b.ll[1] - a.ll[1]) * Math.PI) / 180;
        const la1 = (a.ll[0] * Math.PI) / 180, la2 = (b.ll[0] * Math.PI) / 180;
        const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
        kmWalked += 2 * R * Math.asin(Math.sqrt(h));
      }
    }
  }
  const cats = {};
  for (const s of visited) for (const tag of s.tags || []) cats[tag] = (cats[tag] || 0) + 1;
  const spent = visited.reduce((sum, s) => sum + (s.cost || 0), 0);
  const rated = visited.filter((s) => (s.rating || 0) > 0);
  const topRated = rated.length ? rated.reduce((a, b) => ((a.rating || 0) >= (b.rating || 0) ? a : b)) : null;
  return {
    visitedCount: visited.length,
    totalCount: allStops.length,
    kmWalked,
    categories: cats,
    spent,
    topRated,
    complete: visited.length > 0 && visited.length === allStops.length,
  };
}

// Where a saved trip stands relative to today. Returns null when we can't
// tell (no startDate); otherwise an object with:
//   phase = "upcoming" | "ongoing" | "past" plus per-phase display values.
export function tripStatus(r) {
  if (!r?.startDate) return null;
  const start = new Date(r.startDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysDiff = Math.round((today - start) / 86400000);
  if (daysDiff < 0) return { phase: "upcoming", daysUntil: -daysDiff };
  if (daysDiff < r.days) {
    return {
      phase: "ongoing",
      currentDay: daysDiff + 1,
      of: r.days,
      progress: (daysDiff + 1) / r.days,
    };
  }
  return { phase: "past" };
}
