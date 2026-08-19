import { describe, it, expect } from "vitest";
import { buildICS } from "../exporters.js";

const route = {
  id: "trip42", destName: "Roma", country: "Italia",
  itinerary: [
    { day: 1, date: "2026-08-01", stops: [
      { name: "Colosseum; the big one", time: "9:00", dur: 120, emoji: "🏛", tip: "Book, ahead", ll: [41.89, 12.49] },
      { name: "Trevi", time: "12:00", dur: 30, note: "meet Ana at the fountain" },
    ]},
  ],
};

describe("buildICS", () => {
  const ics = buildICS(route);

  it("produces a calendar with one VEVENT per stop", () => {
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect((ics.match(/BEGIN:VEVENT/g) || []).length).toBe(2);
  });

  it("uses the trip date + stop time and duration", () => {
    expect(ics).toContain("DTSTART:20260801T090000");
    expect(ics).toContain("DTEND:20260801T110000"); // 9:00 + 120min
  });

  it("escapes ICS special characters in text fields", () => {
    expect(ics).toContain("Colosseum\\; the big one");
    expect(ics).toContain("Book\\, ahead");
  });

  it("folds the personal note into the description", () => {
    expect(ics).toContain("meet Ana at the fountain");
  });

  it("emits GEO for stops with coordinates", () => {
    expect(ics).toContain("GEO:41.89;12.49");
  });
});
