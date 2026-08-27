// Turns a trip and the photos taken on it into an album: chapters per day, each
// photo sitting under the stop it was taken at.
//
// Pure and synchronous — no storage, no DOM. The caller loads memories and
// hands them in, which keeps the interesting part (where does each photo
// belong?) testable, because that is where the mistakes are.
//
// Photos arrive from two places and they are not the same shape:
//   • from a stop  → carries `stopName` and `ll`
//   • from Gallery → `stopName: null`, no coordinates, just a caption
// So placement has to fall back gracefully rather than assume a stop is known.

// Local calendar date of a timestamp, as yyyy-mm-dd.
// Deliberately not toISOString(): that converts to UTC first, so a photo taken
// at 01:00 in Bucharest lands on the previous day. The itinerary had this exact
// bug once already.
export function localDay(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const norm = (s) => (s || "").trim().toLowerCase();

// Build the album model. `memories` may include photos from other trips; they
// are filtered out here so callers can pass the whole gallery.
export function buildAlbum(route, memories = []) {
  if (!route?.itinerary?.length) return null;

  const mine = memories
    .filter((m) => m && m.tripId === route.id && m.dataUrl)
    .sort((a, b) => a.ts - b.ts);

  // Index every stop by name, remembering each day it appears on. A stop can
  // legitimately repeat across days ("Piața Centrală" twice), so keep a list
  // and disambiguate by date later rather than silently taking the first.
  const byStopName = new Map();
  route.itinerary.forEach((day) => {
    day.stops.forEach((stop) => {
      const key = norm(stop.name);
      if (!key) return;
      if (!byStopName.has(key)) byStopName.set(key, []);
      byStopName.get(key).push({ day: day.day, date: day.date, stop });
    });
  });

  const days = route.itinerary.map((day) => ({
    day: day.day,
    date: day.date || null,
    stops: day.stops.map((stop) => ({ name: stop.name, time: stop.time, photos: [] })),
    // Photos that belong to this day but not to any particular stop.
    loose: [],
  }));
  const dayByNumber = new Map(days.map((d) => [d.day, d]));
  const dayByDate = new Map(days.filter((d) => d.date).map((d) => [d.date, d]));

  // Photos that belong to the trip but cannot be placed on a day — the trip has
  // no dates, or the photo was taken outside them. Dropping them would lose the
  // user's own pictures, so they get their own chapter.
  const extras = [];

  for (const m of mine) {
    const taken = localDay(m.ts);
    const candidates = byStopName.get(norm(m.stopName)) || [];

    // Prefer the occurrence on the day the photo was actually taken; otherwise
    // the first, which is right whenever the stop appears only once.
    const match = candidates.find((c) => c.date && c.date === taken) || candidates[0];

    if (match) {
      const target = dayByNumber.get(match.day);
      const slot = target?.stops.find((s) => norm(s.name) === norm(m.stopName));
      if (slot) { slot.photos.push(m); continue; }
    }

    const byDate = dayByDate.get(taken);
    if (byDate) { byDate.loose.push(m); continue; }

    extras.push(m);
  }

  // A day with no photos at all is not a chapter — an album of empty pages is
  // worse than a short album.
  const chapters = days
    .map((d) => ({ ...d, stops: d.stops.filter((s) => s.photos.length) }))
    .filter((d) => d.stops.length || d.loose.length);

  return {
    tripId: route.id,
    destName: route.destName,
    country: route.country || null,
    startDate: route.startDate || null,
    chapters,
    extras,
    photoCount: mine.length,
    // How many of the trip's own days actually got pictures — the honest
    // denominator for "day 2 of 5", not the number of chapters.
    dayCount: route.itinerary.length,
  };
}

// One photo linked to the trip is enough.
//
// This was 3 on the theory that fewer is "not really an album". In practice it
// only produced a button that refused to appear, with the user counting photos
// and wondering what was wrong — an arbitrary gate protecting nobody from
// anything. A two-photo album is a perfectly good two-photo album.
export const MIN_PHOTOS = 1;
export const hasEnoughForAlbum = (album) => !!album && album.photoCount >= MIN_PHOTOS;
