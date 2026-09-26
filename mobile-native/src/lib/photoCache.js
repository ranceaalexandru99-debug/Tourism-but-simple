// Downloading a Wikimedia photo to the device, because <Image> cannot fetch it.
//
// Measured on a phone, with the error React Native handed back:
//
//   [img] EROARE {"error":"Unexpected HTTP code Response{protocol=h2, code=403,
//   url=https://thumb.wikimedia.org/.../330px-Split2.JPG}"}
//
// The API requests are fine — every one of them answers 200 with our user agent
// — but React Native loads images through a separate native client, and it does
// not send the `headers` given on the image source, whatever the type says.
// Wikimedia refuses the agent that client uses, so the photo resolves correctly
// and then never draws. That is exactly the white tile on the home screen.
//
// So the bytes are fetched the way everything else is fetched, with headers
// that work, and handed to <Image> as a local file.
//
// The OS may clear the cache directory whenever it likes, which is the right
// place for this: a missing file costs one download, and the URL itself is
// still remembered by photos.js.

import * as FileSystem from "expo-file-system/legacy";
import { WIKI_HEADERS } from "./userAgent.js";

const DIR = FileSystem.cacheDirectory + "poi-photos/";

// One request per URL, however many tiles ask for it at once. A grid of six
// cities showing the same photo should not download it six times.
const inflight = new Map();

let dirReady = null;
function ensureDir() {
  if (!dirReady) {
    dirReady = (async () => {
      const info = await FileSystem.getInfoAsync(DIR);
      if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
    })().catch(() => { dirReady = null; throw new Error("nodir"); });
  }
  return dirReady;
}

// A stable file name for a URL. FNV-1a: short, dependency-free, and collisions
// only ever cost a wrong cached thumbnail, never correctness elsewhere.
function fileNameFor(url) {
  let h = 0x811c9dc5;
  for (let i = 0; i < url.length; i++) {
    h ^= url.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const ext = (url.split("?")[0].match(/\.(jpe?g|png|webp)$/i) || [, "jpg"])[1].toLowerCase();
  return `${h.toString(36)}.${ext}`;
}

/**
 * A file:// URI for a remote photo, downloading it once if needed.
 * Returns null when it cannot be had — the caller shows its placeholder.
 */
export async function localPhoto(url) {
  if (!url || !/^https?:\/\//i.test(url)) return url || null;
  if (inflight.has(url)) return inflight.get(url);

  const task = (async () => {
    try {
      await ensureDir();
      const dest = DIR + fileNameFor(url);

      // Already downloaded. Size matters: a previous failure can leave a
      // zero-byte file behind, and <Image> would fail on it forever.
      const have = await FileSystem.getInfoAsync(dest);
      if (have.exists && have.size > 0) return dest;

      const res = await FileSystem.downloadAsync(url, dest, { headers: WIKI_HEADERS });
      if (res.status !== 200) {
        await FileSystem.deleteAsync(dest, { idempotent: true }).catch(() => {});
        return null;
      }
      return dest;
    } catch {
      return null;
    } finally {
      // Kept only for the duration of the download: caching the promise forever
      // would pin every photo of the session in memory.
      inflight.delete(url);
    }
  })();

  inflight.set(url, task);
  return task;
}
