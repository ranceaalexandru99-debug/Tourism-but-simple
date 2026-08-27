import { describe, it, expect, vi, afterEach } from "vitest";
import { toScenes, MAX_PHOTOS, pickMime, canRenderShort } from "../shortVideo.js";

// The drawing and encoding need a real browser, so what is pinned here is the
// part that decides WHAT goes into the video and in which order — and the
// capability checks, which are what stand between a user and a silent failure.

const photo = (id) => ({ id, dataUrl: "data:image/jpeg;base64,x", caption: `c${id}` });

const album = (over = {}) => ({
  chapters: [
    {
      day: 1, date: "2026-05-10",
      stops: [
        { name: "Colosseum", time: "9:00", photos: [photo("a"), photo("b")] },
        { name: "Trevi", time: "13:30", photos: [photo("c")] },
      ],
      loose: [photo("d")],
    },
    { day: 2, date: "2026-05-11", stops: [{ name: "Vatican", time: "9:00", photos: [photo("e")] }], loose: [] },
  ],
  extras: [photo("x")],
  photoCount: 6,
  ...over,
});

afterEach(() => { vi.unstubAllGlobals(); });

describe("toScenes", () => {
  it("walks days in order, stops before that day's loose photos", () => {
    expect(toScenes(album()).map((s) => s.photo.id)).toEqual(["a", "b", "c", "d", "e", "x"]);
  });

  it("labels each photo with its day and place", () => {
    const scenes = toScenes(album());
    expect(scenes[0]).toMatchObject({ day: 1, place: "Colosseum" });
    // A loose photo belongs to the day but to no particular place.
    expect(scenes[3]).toMatchObject({ day: 1, place: null });
    // Extras belong to neither.
    expect(scenes[5]).toMatchObject({ day: null, place: null });
  });

  it("caps the length — rendering is real time, so more photos means more waiting", () => {
    const many = album({
      chapters: [{
        day: 1, date: null, loose: [],
        stops: [{ name: "S", time: "9:00", photos: Array.from({ length: 50 }, (_, i) => photo(`p${i}`)) }],
      }],
      extras: [],
    });
    expect(toScenes(many)).toHaveLength(MAX_PHOTOS);
  });

  it("handles an album with nothing in it", () => {
    expect(toScenes({ chapters: [], extras: [] })).toEqual([]);
  });
});

describe("capability checks", () => {
  it("prefers mp4/H.264 — it is what phones and social apps expect", () => {
    vi.stubGlobal("MediaRecorder", { isTypeSupported: () => true });
    expect(pickMime()).toBe("video/mp4;codecs=avc1.42E01E");
  });

  it("falls back to WebM rather than refusing outright", () => {
    vi.stubGlobal("MediaRecorder", { isTypeSupported: (m) => m.startsWith("video/webm") });
    expect(pickMime()).toBe("video/webm;codecs=vp9");
  });

  it("reports honestly when nothing is supported, so the UI can say why", () => {
    vi.stubGlobal("MediaRecorder", { isTypeSupported: () => false });
    expect(pickMime()).toBeNull();
    expect(canRenderShort()).toBe(false);
  });

  it("does not throw where MediaRecorder is absent entirely", () => {
    vi.stubGlobal("MediaRecorder", undefined);
    expect(pickMime()).toBeNull();
    expect(canRenderShort()).toBe(false);
  });
});
