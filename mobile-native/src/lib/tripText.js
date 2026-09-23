// The trip as plain text, for the OS share sheet.
//
// The web app shares a URL — the whole trip rides in the link's hash, so the
// recipient opens the real itinerary. There is no such URL on a phone, so what
// gets shared is the itinerary itself. Both the share button and the group
// invite need exactly this text, and building it twice is how the two would
// come to disagree about what a shared trip looks like.

/**
 * @param route  the trip
 * @param t      the i18n function
 * @param title  the trip's display title, from tripTitle() — the stored
 *               `title` is missing on trips built before it existed
 * @param lead   an optional first line (the invite uses one; sharing does not)
 */
export function tripAsText(route, t, title, lead) {
  const lines = lead ? [lead, "", title, ""] : [title, ""];
  for (const day of route?.itinerary || []) {
    if ((route.days || 1) > 1) lines.push(t("day", { n: day.day }) + ":");
    for (const s of day.stops || []) {
      lines.push(`${s.time} · ${s.emoji || "📍"} ${s.name}`);
      if (s.note) lines.push(`   📝 ${s.note}`);
    }
    lines.push("");
  }
  lines.push("Turism, dar simplu!");
  return lines.join("\n");
}
