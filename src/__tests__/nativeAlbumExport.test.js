import { describe, it, expect, vi, beforeEach } from "vitest";
import * as sharing from "expo-sharing";
import * as print from "expo-print";
import { state as manip } from "expo-image-manipulator";
import * as fsx from "expo-file-system/legacy";
import {
  exportAlbumPdf, buildShortScenes, buildShortPayload, shareShort, SHORT_MAX_PHOTOS,
} from "../../mobile-native/src/lib/albumExport.js";
import { makeRecipe, toggleAt, moveItem, setSecAt, DEFAULT_SEC } from "../../mobile-native/src/lib/shortEdit.js";

// The native album and short pipeline. Several of its behaviours were bugs
// once, and every one of them failed silently:
//
//   - the PDF was written but nothing opened, and the caller discarded the
//     result that said so
//   - a trip whose photo FILES had gone told the user to "add at least 1 photo"
//     while they were looking at a full gallery
//   - the title card counted the trip's photos rather than the chosen ones

const route = { id: "t1", destName: "Brașov", country: "România", startDate: "2026-09-10",
  itinerary: [{ day: 1, date: "2026-09-10", stops: [{ name: "Piața Sfatului", time: "10:00" }] }] };

const mem = (id, over = {}) => ({
  id, ts: Date.parse("2026-09-10T10:00:00"), uri: `file:///docs/memories/${id}.jpg`,
  caption: `poza ${id}`, tripId: "t1", tripTitle: "Brașov", stopName: "Piața Sfatului", ...over,
});

const labels = { title: "Brașov", photos: "fotografii", subtitle: "3 fotografii",
  dayPrefix: "Ziua", outro: "Turism", day: (n) => `Ziua ${n}`, date: (iso) => iso };

beforeEach(() => {
  sharing.state.available = true;
  sharing.state.shared.length = 0;
  print.printed.length = 0;
  manip.fail = false;
  manip.resizes.length = 0;
  fsx.failures.clear();
  fsx.calls.length = 0;
});

describe("exportAlbumPdf", () => {
  it("builds the PDF and hands it to the share sheet", async () => {
    expect(await exportAlbumPdf(route, [mem("a"), mem("b")], labels)).toBe("shared");
    expect(print.printed).toHaveLength(1);
    expect(sharing.state.shared[0].opts.mimeType).toBe("application/pdf");
  });

  it("reports 'saved' when there is no share sheet, instead of seeming to do nothing", async () => {
    sharing.state.available = false;
    expect(await exportAlbumPdf(route, [mem("a")], labels)).toBe("saved");
    expect(print.printed).toHaveLength(1);
  });

  it("refuses a trip with no photos at all", async () => {
    await expect(exportAlbumPdf(route, [], labels)).rejects.toThrow("tooFew");
  });

  it("ignores photos belonging to other trips", async () => {
    await expect(exportAlbumPdf(route, [mem("x", { tripId: "other" })], labels)).rejects.toThrow("tooFew");
  });

  it("says the FILES are missing, not that you need more photos", async () => {
    // The distinction matters: one is a thing you can act on, the other is
    // nonsense to someone looking at a full gallery.
    manip.fail = true;
    fsx.failures.set("readAsStringAsync", new Error("ENOENT"));
    await expect(exportAlbumPdf(route, [mem("a"), mem("b")], labels)).rejects.toThrow("noFiles");
  });

  it("puts the photos into the page it prints", async () => {
    await exportAlbumPdf(route, [mem("a")], labels);
    expect(print.printed[0]).toContain("data:image/jpeg;base64,");
    expect(print.printed[0]).toContain("Brașov");
  });
});

describe("buildShortScenes", () => {
  it("returns one scene per photo, carrying its caption and day", async () => {
    const scenes = await buildShortScenes(route, [mem("a"), mem("b")]);
    expect(scenes).toHaveLength(2);
    expect(scenes[0].photo.caption).toBe("poza a");
    expect(scenes[0].day).toBe(1);
  });

  it("caps the list, because every extra photo is another second of real-time encoding", async () => {
    const many = Array.from({ length: SHORT_MAX_PHOTOS + 6 }, (_, i) => mem(`p${i}`));
    expect(await buildShortScenes(route, many)).toHaveLength(SHORT_MAX_PHOTOS);
  });

  it("asks for thumbnails, not full-size photos", async () => {
    await buildShortScenes(route, [mem("a")]);
    // The editor shows these in a 46pt row; the render inlines its own at 720.
    expect(manip.resizes.every((w) => w <= 160)).toBe(true);
  });

  it("reports missing files distinctly here too", async () => {
    manip.fail = true;
    fsx.failures.set("readAsStringAsync", new Error("ENOENT"));
    await expect(buildShortScenes(route, [mem("a")])).rejects.toThrow("noFiles");
  });
});

describe("buildShortPayload", () => {
  it("hands the page a flat scene list plus the timeline", async () => {
    const p = await buildShortPayload(route, [mem("a"), mem("b")], labels);
    expect(p.scenes).toHaveLength(2);
    expect(p.scenes[0]).toHaveProperty("dataUrl");
    expect(p.scenes[0]).toHaveProperty("sec");
    expect(p.starts).toEqual([0, DEFAULT_SEC]);
    expect(p.photoTime).toBeCloseTo(2 * DEFAULT_SEC, 5);
  });

  it("does not carry the whole photo record across the bridge", async () => {
    const p = await buildShortPayload(route, [mem("a")], labels);
    expect(p.scenes[0]).not.toHaveProperty("photo");
    expect(p.scenes[0]).not.toHaveProperty("tripId");
  });

  it("honours a recipe: excluded photos are gone, order is the recipe's", async () => {
    const scenes = await buildShortScenes(route, [mem("a"), mem("b"), mem("c")]);
    let recipe = makeRecipe(scenes);
    recipe = toggleAt(recipe, 1);        // drop b
    recipe = moveItem(recipe, 2, 0);     // c first
    const p = await buildShortPayload(route, [mem("a"), mem("b"), mem("c")], labels, recipe);
    expect(p.scenes.map((s) => s.caption)).toEqual(["poza c", "poza a"]);
  });

  it("honours per-photo durations in the timeline it computes", async () => {
    const scenes = await buildShortScenes(route, [mem("a"), mem("b")]);
    const recipe = setSecAt(makeRecipe(scenes), 0, 3);
    const p = await buildShortPayload(route, [mem("a"), mem("b")], labels, recipe);
    expect(p.scenes[0].sec).toBe(3);
    expect(p.starts).toEqual([0, 3]);
  });

  it("refuses a recipe that excludes everything, rather than rendering an empty video", async () => {
    const scenes = await buildShortScenes(route, [mem("a"), mem("b")]);
    let recipe = makeRecipe(scenes);
    recipe = toggleAt(toggleAt(recipe, 0), 1);
    await expect(buildShortPayload(route, [mem("a"), mem("b")], labels, recipe)).rejects.toThrow("tooFew");
  });
});

describe("shareShort", () => {
  it("shares an mp4 with the right type", async () => {
    expect(await shareShort("file:///cache/shorts/x.mp4")).toBe("shared");
    expect(sharing.state.shared[0].opts.mimeType).toBe("video/mp4");
  });

  it("falls back to webm's type when that is what was produced", async () => {
    await shareShort("file:///cache/shorts/x.webm");
    expect(sharing.state.shared[0].opts.mimeType).toBe("video/webm");
  });

  it("reports 'saved' when the OS offers no share sheet", async () => {
    sharing.state.available = false;
    expect(await shareShort("file:///cache/shorts/x.mp4")).toBe("saved");
  });
});
