import { describe, it, expect } from "vitest";
import fs from "node:fs";
import {
  makeRecipe, moveItem, toggleAt, setSecAt, applyRecipe, timeline, sceneAt,
  clampSec, totalSeconds, DEFAULT_SEC, MIN_SEC, MAX_SEC,
} from "../shortEdit.js";

const scene = (id, over = {}) => ({ photo: { id, dataUrl: `d${id}`, caption: `c${id}` }, day: 1, place: "P", ...over });
const scenes = [scene("a"), scene("b"), scene("c")];

describe("clampSec", () => {
  it("holds the allowed range", () => {
    expect(clampSec(0.1)).toBe(MIN_SEC);
    expect(clampSec(99)).toBe(MAX_SEC);
    expect(clampSec(2.34)).toBe(2.3);
  });

  it("falls back to the default rather than producing NaN", () => {
    expect(clampSec("abc")).toBe(DEFAULT_SEC);
    expect(clampSec(undefined)).toBe(DEFAULT_SEC);
  });
});

describe("makeRecipe", () => {
  it("includes everything at the default length, in album order", () => {
    const r = makeRecipe(scenes);
    expect(r.map((x) => x.key)).toEqual(["a", "b", "c"]);
    expect(r.every((x) => x.include && x.sec === DEFAULT_SEC)).toBe(true);
  });

  it("survives photos with no id", () => {
    const r = makeRecipe([{ photo: {} }, { photo: {} }]);
    expect(new Set(r.map((x) => x.key)).size).toBe(2);
  });
});

describe("moveItem", () => {
  it("reorders without mutating the original", () => {
    const list = makeRecipe(scenes);
    const moved = moveItem(list, 2, 0);
    expect(moved.map((x) => x.key)).toEqual(["c", "a", "b"]);
    expect(list.map((x) => x.key)).toEqual(["a", "b", "c"]);
  });

  it("ignores an out-of-range move instead of corrupting the list", () => {
    const list = makeRecipe(scenes);
    expect(moveItem(list, 0, -1)).toBe(list);
    expect(moveItem(list, 5, 0)).toBe(list);
  });
});

describe("applyRecipe", () => {
  it("drops excluded photos and honours the order", () => {
    let r = makeRecipe(scenes);
    r = toggleAt(r, 1);              // drop "b"
    r = moveItem(r, 2, 0);           // "c" first
    const out = applyRecipe(scenes, r);
    expect(out.map((s) => s.photo.id)).toEqual(["c", "a"]);
  });

  it("carries each photo's own duration", () => {
    let r = makeRecipe(scenes);
    r = setSecAt(r, 0, 3.5);
    const out = applyRecipe(scenes, r);
    expect(out[0].sec).toBe(3.5);
    expect(out[1].sec).toBe(DEFAULT_SEC);
  });

  it("silently skips a photo deleted since the recipe was made", () => {
    const r = makeRecipe(scenes);
    const out = applyRecipe([scene("a"), scene("c")], r);
    expect(out.map((s) => s.photo.id)).toEqual(["a", "c"]);
  });

  it("with no recipe renders everything at the default", () => {
    const out = applyRecipe(scenes, []);
    expect(out).toHaveLength(3);
    expect(out.every((s) => s.sec === DEFAULT_SEC)).toBe(true);
  });
});

describe("timeline and sceneAt", () => {
  it("starts each scene where the previous one ended", () => {
    const list = [{ sec: 2 }, { sec: 1 }, { sec: 3 }];
    const { starts, photoTime } = timeline(list);
    expect(starts).toEqual([0, 2, 3]);
    expect(photoTime).toBe(6);
  });

  it("picks the scene on screen and how far through it is", () => {
    const list = [{ sec: 2 }, { sec: 1 }];
    const { starts } = timeline(list);
    expect(sceneAt(list, starts, 0)).toEqual({ idx: 0, t: 0 });
    expect(sceneAt(list, starts, 1)).toEqual({ idx: 0, t: 0.5 });
    expect(sceneAt(list, starts, 2)).toEqual({ idx: 1, t: 0 });
    expect(sceneAt(list, starts, 2.5)).toEqual({ idx: 1, t: 0.5 });
  });

  it("returns null past the end, which is the cue for the outro", () => {
    const list = [{ sec: 2 }];
    const { starts } = timeline(list);
    expect(sceneAt(list, starts, 2)).toBeNull();
    expect(sceneAt(list, starts, 99)).toBeNull();
  });

  it("never leaves a gap between scenes", () => {
    const list = [{ sec: 1.3 }, { sec: 2.1 }, { sec: 0.9 }];
    const { starts, photoTime } = timeline(list);
    for (let t = 0; t < photoTime - 0.001; t += 0.05) {
      expect(sceneAt(list, starts, t)).not.toBeNull();
    }
  });

  it("an untouched recipe lasts exactly as long as the old fixed-length short", () => {
    const out = applyRecipe(scenes, makeRecipe(scenes));
    expect(totalSeconds(out, 2.0, 1.5)).toBe(2.0 + 3 * DEFAULT_SEC + 1.5);
  });
});

describe("the shared copy", () => {
  it("is byte-identical to the native one", () => {
    const web = fs.readFileSync("src/shortEdit.js", "utf8");
    const native = fs.readFileSync("mobile-native/src/lib/shortEdit.js", "utf8");
    // Line endings are the one thing allowed to differ: git normalises them.
    expect(native.replace(/\r\n/g, "\n")).toBe(web.replace(/\r\n/g, "\n"));
  });
});
