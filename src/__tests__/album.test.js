import { describe, it, expect } from "vitest";
import { buildAlbum, localDay, hasEnoughForAlbum } from "../album.js";

// Photos reach the gallery two ways and carry different fields: from a stop
// (with `stopName`) or from the Gallery screen (`stopName: null`, no
// coordinates). Placement has to cope with both, and must never drop one of the
// user's own pictures on the floor.

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();

const photo = (id, ts, stopName = null, tripId = "t1") => ({
  id, ts, stopName, tripId, dataUrl: "data:image/jpeg;base64,x", caption: "",
});

const route = {
  id: "t1",
  destName: "Timișoara",
  startDate: "2026-05-10",
  itinerary: [
    { day: 1, date: "2026-05-10", stops: [{ name: "Muzeul de Artă", time: "9:00" }, { name: "Piața Unirii", time: "11:30" }] },
    { day: 2, date: "2026-05-11", stops: [{ name: "Cetățuia", time: "9:00" }, { name: "Piața Unirii", time: "17:30" }] },
  ],
};

describe("localDay", () => {
  it("uses the local calendar date, not UTC", () => {
    // 01:00 local would be the previous day in UTC for any positive offset —
    // the itinerary already shipped that off-by-one once.
    expect(localDay(at(2026, 5, 10, 1))).toBe("2026-05-10");
    expect(localDay(at(2026, 5, 10, 23))).toBe("2026-05-10");
  });
});

describe("buildAlbum", () => {
  it("files a photo under the stop it was taken at", () => {
    const album = buildAlbum(route, [photo("a", at(2026, 5, 10), "Muzeul de Artă")]);
    expect(album.chapters).toHaveLength(1);
    expect(album.chapters[0].day).toBe(1);
    expect(album.chapters[0].stops[0].name).toBe("Muzeul de Artă");
    expect(album.chapters[0].stops[0].photos.map((p) => p.id)).toEqual(["a"]);
  });

  it("puts a repeated stop on the day the photo was actually taken", () => {
    // "Piața Unirii" is visited on both days; the timestamp decides.
    const album = buildAlbum(route, [photo("a", at(2026, 5, 11), "Piața Unirii")]);
    expect(album.chapters).toHaveLength(1);
    expect(album.chapters[0].day).toBe(2);
  });

  it("places a photo with no stop on the right day by its date", () => {
    const album = buildAlbum(route, [photo("a", at(2026, 5, 11))]);
    expect(album.chapters[0].day).toBe(2);
    expect(album.chapters[0].loose.map((p) => p.id)).toEqual(["a"]);
  });

  it("keeps photos that fit no day instead of discarding them", () => {
    // Taken a week after the trip — still the user's picture of that trip.
    const album = buildAlbum(route, [photo("a", at(2026, 5, 20))]);
    expect(album.chapters).toHaveLength(0);
    expect(album.extras.map((p) => p.id)).toEqual(["a"]);
    expect(album.photoCount).toBe(1);
  });

  it("ignores photos belonging to another trip", () => {
    const album = buildAlbum(route, [photo("a", at(2026, 5, 10), "Cetățuia", "OTHER")]);
    expect(album.photoCount).toBe(0);
    expect(album.chapters).toHaveLength(0);
  });

  it("omits days and stops with no photos", () => {
    const album = buildAlbum(route, [photo("a", at(2026, 5, 10), "Muzeul de Artă")]);
    // Day 2 had no pictures, and day 1's second stop had none either.
    expect(album.chapters).toHaveLength(1);
    expect(album.chapters[0].stops).toHaveLength(1);
  });

  it("orders photos within a stop chronologically", () => {
    const album = buildAlbum(route, [
      photo("late", at(2026, 5, 10, 16), "Muzeul de Artă"),
      photo("early", at(2026, 5, 10, 9), "Muzeul de Artă"),
    ]);
    expect(album.chapters[0].stops[0].photos.map((p) => p.id)).toEqual(["early", "late"]);
  });

  it("copes with a trip that has no dates", () => {
    const undated = { ...route, startDate: null, itinerary: route.itinerary.map((d) => ({ ...d, date: null })) };
    const album = buildAlbum(undated, [
      photo("a", at(2026, 5, 10), "Cetățuia"),   // still placeable by name
      photo("b", at(2026, 5, 10)),               // nothing to go on
    ]);
    expect(album.chapters[0].stops[0].name).toBe("Cetățuia");
    expect(album.extras.map((p) => p.id)).toEqual(["b"]);
  });

  it("returns null without an itinerary", () => {
    expect(buildAlbum(null, [])).toBeNull();
    expect(buildAlbum({ id: "t1", itinerary: [] }, [])).toBeNull();
  });

  it("one linked photo is already an album", () => {
    // The threshold used to be three, which only produced a button that
    // refused to appear while the user counted photos wondering why.
    const one = buildAlbum(route, [photo("a", at(2026, 5, 10), "Cetățuia")]);
    expect(hasEnoughForAlbum(one)).toBe(true);
  });

  it("no linked photos is not an album", () => {
    // Photos belonging to another trip leave this one with nothing.
    const none = buildAlbum(route, [photo("a", at(2026, 5, 10), "Cetățuia", "OTHER")]);
    expect(hasEnoughForAlbum(none)).toBe(false);
  });
});

describe("the shared copies", () => {
  // album.js and albumHtml.js are copied verbatim to the native app. shortEdit
  // and shortDraw already had this check; these two did not, which left a
  // manual diff in the release checklist. A fix landing in one copy and not
  // the other is this project's most repeated mistake.
  it.each(["album.js", "albumHtml.js", "errorScrub.js"])("%s is byte-identical to the native one", async (name) => {
    const fs = await import("node:fs");
    const web = fs.readFileSync(`src/${name}`, "utf8");
    const native = fs.readFileSync(`mobile-native/src/lib/${name}`, "utf8");
    // Line endings are the one thing allowed to differ: git normalises them.
    expect(native.replace(/\r\n/g, "\n")).toBe(web.replace(/\r\n/g, "\n"));
  });
});
