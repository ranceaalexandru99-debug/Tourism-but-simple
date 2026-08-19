// Time helpers for the itinerary: parsing "H:MM" stamps, formatting minutes,
// and working out where the traveler is *right now* along an ongoing trip.

// Parse a "H:MM" (or "HH:MM") string into minutes since midnight. Returns null
// for placeholders like "—" so callers can skip the check gracefully.
export function parseTime(t) {
  if (!t || typeof t !== "string") return null;
  const m = t.trim().match(/^(\d{1,2})[:.](\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10), mm = parseInt(m[2], 10);
  if (h > 23 || mm > 59) return null;
  return h * 60 + mm;
}

export const fmtMin = (n) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;

// Compute where the traveler is *right now* along an ongoing trip. Returns
// null unless today falls inside [startDate, startDate + days) so callers can
// bail out for planning-only trips (past, or scheduled in the future).
//   phase: "at" (inside a stop's window) | "moving" (between stops) | "done" (day finished)
//   dayIndex: 0-based index into route.itinerary
//   currentIndex / nextIndex: indices into that day's stops
//   minutesUntilNext: minutes from now until the next stop's start time
export function computeTripNow(route, nowDate = new Date()) {
  if (!route?.startDate) return null;
  const start = new Date(route.startDate + "T00:00:00");
  const today = new Date(nowDate); today.setHours(0, 0, 0, 0);
  const dayIndex = Math.round((today - start) / 86400000);
  if (dayIndex < 0 || dayIndex >= (route.days || 0)) return null;
  const day = route.itinerary?.[dayIndex];
  if (!day) return null;

  const nowMin = nowDate.getHours() * 60 + nowDate.getMinutes();
  let currentIndex = -1, nextIndex = -1;
  for (let i = 0; i < day.stops.length; i++) {
    const startMin = parseTime(day.stops[i].time);
    if (startMin == null) continue;
    const endMin = startMin + (day.stops[i].dur || 60);
    if (nowMin >= startMin && nowMin < endMin) currentIndex = i;
    if (nowMin < startMin && nextIndex === -1) nextIndex = i;
  }

  if (currentIndex >= 0) {
    const startMin = parseTime(day.stops[currentIndex].time) || 0;
    const endMin = startMin + (day.stops[currentIndex].dur || 60);
    return { phase: "at", dayIndex, currentIndex, nextIndex, minutesLeft: endMin - nowMin };
  }
  if (nextIndex >= 0) {
    const startMin = parseTime(day.stops[nextIndex].time) || 0;
    return { phase: "moving", dayIndex, currentIndex: nextIndex - 1, nextIndex, minutesUntilNext: startMin - nowMin };
  }
  return { phase: "done", dayIndex, currentIndex: day.stops.length - 1, nextIndex: -1 };
}
