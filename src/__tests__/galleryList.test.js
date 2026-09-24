import { describe, it, expect } from "vitest";
import fs from "node:fs";

// The gallery grid, and the one thing about it that only shows up on a phone
// with a full gallery.
//
// Each tile draws the photo TWICE — a blurred copy behind, the whole picture in
// front, so a portrait shot is not cropped. Inside a ScrollView that meant a
// hundred memories mounted two hundred images, every one of them decoded
// whether or not it was on screen. Nothing in a test suite feels that; the
// screen just gets slower the more someone uses it.

const src = fs.readFileSync("mobile-native/src/screens/Gallery.js", "utf8");

describe("the photo grid", () => {
  it("is windowed, not a ScrollView holding everything", () => {
    expect(src).toContain("<FlatList");
    // The tiles must not be produced by mapping the whole array.
    expect(src).not.toMatch(/\{memories\.map\(/);
    expect(src).toMatch(/renderItem=/);
  });

  it("keeps few tiles alive off-screen", () => {
    expect(src).toMatch(/windowSize=\{\d+\}/);
    expect(src).toMatch(/initialNumToRender=\{\d+\}/);
    expect(src).toContain("removeClippedSubviews");
  });

  it("still draws the whole photo over a blurred copy", () => {
    // The reason the tile is expensive is also the reason it looks right. If a
    // later change makes it cheap by cropping, that is a different decision and
    // should be made deliberately.
    expect(src).toContain('resizeMode="cover" blurRadius={18}');
    expect(src).toContain('resizeMode="contain"');
  });

  it("caps a tile's width so an odd photo does not span the row", () => {
    // With flex alone and numColumns, the last item in an odd-length list is
    // the only thing in its row and stretches across it.
    expect(src).toMatch(/maxWidth: "4\d%"/);
    expect(src).toMatch(/numColumns=\{2\}/);
  });

  it("still shows the empty state and the map when there are no tiles", () => {
    // `data` is empty in two different situations, and they need different
    // things on screen — an invitation to add a photo, or the map tab.
    expect(src).toContain("ListEmptyComponent");
    expect(src).toContain("galEmpty");
    expect(src).toContain("<MemoryMap");
  });

  it("keeps everything above the grid scrolling with it", () => {
    expect(src).toContain("ListHeaderComponent");
    // A few things that were in the scroll view before and must still be.
    for (const marker of ["navGallery", "galLimitWarn", "styles.viewToggle"]) {
      expect(src).toContain(marker);
    }
  });
});
