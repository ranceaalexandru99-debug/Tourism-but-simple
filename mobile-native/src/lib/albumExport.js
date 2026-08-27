// Builds the photo album as a PDF and hands it to the OS share sheet.
//
// The grouping (album.js) and the page itself (albumHtml.js) are copied
// verbatim from the web app, so the two platforms cannot drift — several fixes
// made on the web this week had never reached here precisely because the logic
// existed twice.
//
// The one genuine difference is where a photo lives. On the web a memory
// carries `dataUrl`; here it carries `uri`, a path in the app's document
// directory, because base64 in AsyncStorage would be ruinous. So the files are
// read and inlined just before printing — and only then, so the encoded copies
// are short-lived rather than sitting in memory for the life of the app.
//
// Everything happens on the device. The privacy policy promises photos never
// leave it, which also ruled out rendering this on a server.

import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { buildAlbum, hasEnoughForAlbum, MIN_PHOTOS } from "./album.js";
import { buildAlbumHtml, albumLabels, columnsFor, PAGE_W, PAD, GAP } from "./albumHtml.js";

// Read a photo, resized to the size it is actually printed at.
//
// The gallery keeps pictures at full capture size; the album shows them in a
// grid cell a few centimetres wide — at six columns, about 220px on paper.
// Embedding the original there is roughly twenty times more data than the cell
// can show, and every byte of it crosses into the PDF.
//
// `target` is the cell's pixel size, computed from the page geometry. Failing
// to resize is not fatal: the original is used, the album is just heavier.
async function toDataUrl(uri, target) {
  try {
    if (target) {
      try {
        // Render once with no transform first, purely to learn the size. An
        // image already narrower than the cell must be left alone: resizing it
        // up costs bytes and gains nothing, and re-encoding only loses quality.
        const original = await ImageManipulator.manipulate(uri).renderAsync();
        const ref = original.width > target
          // One dimension only, so the aspect ratio survives; the page crops to
          // a square with object-fit, exactly as the web version does.
          ? await ImageManipulator.manipulate(original).resize({ width: target }).renderAsync()
          : original;
        const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.82, base64: true });
        if (out?.base64) return `data:image/jpeg;base64,${out.base64}`;
      } catch { /* fall through and embed the file as it is */ }
    }
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    return `data:image/jpeg;base64,${base64}`;
  } catch {
    // A photo whose file went missing must not take the whole album with it.
    return null;
  }
}

// The pixel width one grid cell occupies on paper, from the same geometry the
// page itself uses — so the two can never disagree about how big a cell is.
// 200 DPI is well past what a photo that size can show and far below what the
// original carries.
function cellPixels(count) {
  const cols = columnsFor(count);
  const cellMm = (PAGE_W - PAD * 2 - GAP * (cols - 1)) / cols;
  return Math.round((cellMm / 25.4) * 200);
}

/**
 * @param route     the trip
 * @param memories  everything from gallery.listMemories()
 * @param labels    built by albumLabels() in albumHtml.js
 * @returns "shared" | "saved"
 * @throws Error("tooFew")
 */
export async function exportAlbumPdf(route, memories, labels) {
  const mine = (memories || []).filter((m) => m && m.tripId === route.id && m.uri);
  if (mine.length < MIN_PHOTOS) throw new Error("tooFew");

  // Inline the images at the size the page will print them, dropping any whose
  // file has gone.
  const target = cellPixels(mine.length);
  const inlined = [];
  for (const m of mine) {
    const dataUrl = await toDataUrl(m.uri, target);
    if (dataUrl) inlined.push({ ...m, dataUrl });
  }

  // The trip HAS photos, but none of their files could be read — they were
  // moved, or the app's storage was cleared while the index survived. Falling
  // through to "tooFew" would tell someone staring at a full gallery to add
  // more photos, which is nonsense; this is a different problem and needs to
  // say so.
  if (!inlined.length) throw new Error("noFiles");

  const album = buildAlbum(route, inlined);
  if (!hasEnoughForAlbum(album)) throw new Error("tooFew");

  const { uri } = await Print.printToFileAsync({
    html: buildAlbumHtml(album, labels),
    base64: false,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
    return "shared";
  }
  // No share sheet (rare, and some Android builds): the file still exists, so
  // say where rather than pretending nothing happened.
  return "saved";
}

// ---------------------------------------------------------------- short -----
// Assemble the payload the WebView renderer needs: the same scene order the web
// app uses, with each photo inlined as a data URL because the WebView cannot
// reach the app's document directory.
//
// Capped harder than on the web (12 rather than 18): the finished file crosses
// the RN bridge as base64, and every extra second is roughly another 300 KB of
// message traffic on top of another second of real-time rendering.
export const SHORT_MAX_PHOTOS = 12;

export async function buildShortPayload(route, memories, labels) {
  const mine = (memories || []).filter((m) => m && m.tripId === route.id && m.uri);
  if (mine.length < MIN_PHOTOS) throw new Error("tooFew");

  // The video renders at 720×1280 and each photo fills the frame, so 720 wide
  // is exactly enough — anything larger is bytes that cross the RN bridge as
  // base64 and are then scaled back down before they are ever seen.
  const inlined = [];
  for (const m of mine) {
    const dataUrl = await toDataUrl(m.uri, 720);
    if (dataUrl) inlined.push({ ...m, dataUrl });
  }
  if (!inlined.length) throw new Error("noFiles");
  const album = buildAlbum(route, inlined);
  if (!hasEnoughForAlbum(album)) throw new Error("tooFew");

  const scenes = [];
  for (const chapter of album.chapters) {
    for (const place of chapter.stops) {
      for (const photo of place.photos) {
        scenes.push({ dataUrl: photo.dataUrl, day: chapter.day, place: place.name, caption: photo.caption || "" });
      }
    }
    for (const photo of chapter.loose) {
      scenes.push({ dataUrl: photo.dataUrl, day: chapter.day, place: null, caption: photo.caption || "" });
    }
  }
  for (const photo of album.extras) {
    scenes.push({ dataUrl: photo.dataUrl, day: null, place: null, caption: photo.caption || "" });
  }

  return { scenes: scenes.slice(0, SHORT_MAX_PHOTOS), labels };
}

// Hand a finished short to the OS share sheet.
export async function shareShort(uri) {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: uri.endsWith(".mp4") ? "video/mp4" : "video/webm" });
    return "shared";
  }
  return "saved";
}
