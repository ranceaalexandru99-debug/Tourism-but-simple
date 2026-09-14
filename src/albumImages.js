// Downscales album photos to the size they are actually printed at.
//
// The gallery stores pictures at up to 1200px, which is right for viewing one
// full-screen. The album shows them in a grid cell a few centimetres wide — at
// six columns, about 250px on paper. Embedding the full-size image there is
// roughly twenty times more data than the cell can show.
//
// It is not a cosmetic saving. Measured with realistic photos, a thirty-picture
// album came to 10 MB of HTML: a string that large has to be written into a new
// document and decoded as thirty full-resolution images, on a phone. Sized to
// the cell it drops to a fraction of that.
//
// Web only — it needs a canvas. The native path has its own resizer.

import { columnsFor, PAGE_W, PAD, GAP } from "./albumHtml.js";

// Print resolution to aim for. 200 DPI is well past what a photo in a small
// grid cell can show, and far below what the original carries.
const DPI = 200;
const MM_PER_INCH = 25.4;

// The pixel size one grid cell occupies on paper, for this many photos.
export function cellPixels(count) {
  const cols = columnsFor(count);
  const cellMm = (PAGE_W - PAD * 2 - GAP * (cols - 1)) / cols;
  return Math.round((cellMm / MM_PER_INCH) * DPI);
}

/**
 * The size a `w`×`h` photo becomes when scaled to fit a `target`-square box,
 * keeping its proportions. Never a crop — the album page contains the photo
 * rather than cropping it, so it has to be handed a whole one.
 */
export function fitWithin(w, h, target) {
  const scale = target / Math.max(w, h);
  return {
    w: Math.max(1, Math.round(w * scale)),
    h: Math.max(1, Math.round(h * scale)),
  };
}

function shrink(dataUrl, target) {
  return new Promise((resolve) => {
    const img = new Image();
    // Neither event is guaranteed — an empty or malformed data URL can leave an
    // Image silently inert in some browsers. Without this the promise never
    // settles and the album button stays disabled for the rest of the session,
    // with no error and nothing to retry. The original is a fine answer.
    const bail = setTimeout(() => resolve(dataUrl), 10000);
    const done = (value) => { clearTimeout(bail); resolve(value); };
    img.onerror = () => done(dataUrl);      // unreadable: keep the original
    img.onload = () => {
      try {
        // Already smaller than the cell — re-encoding would only lose quality.
        if (Math.max(img.width, img.height) <= target) { done(dataUrl); return; }
        // Scaled to fit the cell, NOT cropped to it. This used to render into a
        // square canvas with a cover crop, which threw away the edges of every
        // photo that was not square — before the album had any say in it. The
        // page shows the photo contained now, so it must be handed a whole one.
        const { w, h } = fitWithin(img.width, img.height, target);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        done(canvas.toDataURL("image/jpeg", 0.82));
      } catch {
        done(dataUrl);
      }
    };
    img.src = dataUrl;
  });
}

// Return a copy of the album with every photo sized for the page.
export async function shrinkAlbumPhotos(album) {
  if (!album) return album;
  const target = cellPixels(album.photoCount);
  const cache = new Map();

  const one = async (photo) => {
    // Keyed on the image itself, not on photo.id: an id is normally present,
    // but any photo missing one would share the key `undefined` with every
    // other such photo and be handed back the first one's picture — the album
    // would silently show the wrong images.
    const key = photo.dataUrl;
    if (!cache.has(key)) cache.set(key, await shrink(photo.dataUrl, target));
    return { ...photo, dataUrl: cache.get(key) };
  };
  const many = async (list) => Promise.all(list.map(one));

  return {
    ...album,
    chapters: await Promise.all(album.chapters.map(async (c) => ({
      ...c,
      stops: await Promise.all(c.stops.map(async (s) => ({ ...s, photos: await many(s.photos) }))),
      loose: await many(c.loose),
    }))),
    extras: await many(album.extras),
  };
}
