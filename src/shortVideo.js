// Renders a trip's photos into a vertical short — 1080×1920 mp4 — entirely on
// the device.
//
// No server and no ffmpeg.wasm: a canvas is drawn frame by frame and
// `MediaRecorder` encodes the stream it exposes. Both are built into the
// browser, so this adds nothing to the bundle. Measured on Chromium: five
// seconds of 1080×1920 H.264 comes out at 1.6 MB.
//
// Doing it on-device is not an optimisation, it is the requirement. The privacy
// policy promises photos never leave the phone, so uploading them to render
// server-side was never available.
//
// The one hard constraint: MediaRecorder captures a LIVE stream, so rendering
// runs in real time — a 30-second short takes 30 seconds to make. Hence the
// progress callback and the cap on length; a two-minute wait with no feedback
// would feel broken.

import { applyRecipe, timeline, sceneAt, DEFAULT_SEC } from "./shortEdit.js";
import { DRAW } from "./shortDraw.js";

const W = 1080;
const H = 1920;
const FPS = 30;

// Timing, in seconds. Photos no longer share one length — each scene carries
// its own `sec`, chosen in the editor — but the default is the old constant,
// so a short nobody edited is the same video it always was.
export const INTRO = 2.0;
export const OUTRO = 1.5;
// Beyond this the wait costs more than the video is worth.
export const MAX_PHOTOS = 18;

// Preferred first: H.264 in mp4 is what phones and social apps expect. WebM is
// the fallback where mp4 encoding is unavailable rather than a failure.
const MIME_CANDIDATES = [
  "video/mp4;codecs=avc1.42E01E",
  "video/mp4",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

export function pickMime() {
  if (typeof MediaRecorder === "undefined") return null;
  return MIME_CANDIDATES.find((m) => {
    try { return MediaRecorder.isTypeSupported(m); } catch { return false; }
  }) || null;
}

export function canRenderShort() {
  try {
    return typeof MediaRecorder !== "undefined"
      && typeof document.createElement("canvas").captureStream === "function"
      && !!pickMime();
  } catch { return false; }
}

// Flatten the album into the sequence the video walks through, carrying the day
// and place labels each photo should be captioned with.
export function toScenes(album) {
  const scenes = [];
  for (const chapter of album.chapters) {
    for (const place of chapter.stops) {
      for (const photo of place.photos) {
        scenes.push({ photo, day: chapter.day, place: place.name });
      }
    }
    for (const photo of chapter.loose) {
      scenes.push({ photo, day: chapter.day, place: null });
    }
  }
  for (const photo of album.extras) scenes.push({ photo, day: null, place: null });
  return scenes.slice(0, MAX_PHOTOS);
}

const loadImage = (src) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);   // a broken photo skips, never aborts
  img.src = src;
});

/**
 * Render the short. Resolves to a Blob.
 *
 * @param album   the model from album.js
 * @param labels  { title, subtitle, dayLabel(n), outro }  — already localised
 * @param opts    { onProgress(0..1), signal }
 */
export async function renderShort(album, labels, opts = {}) {
  const mime = pickMime();
  if (!mime) throw new Error("unsupported");

  // opts.recipe is what the editor produced: which photos, in what order, each
  // with its own length. Without one, every photo plays at the default — the
  // behaviour before the editor existed.
  const scenes = applyRecipe(toScenes(album), opts.recipe);
  if (!scenes.length) throw new Error("empty");
  const { starts, photoTime } = timeline(scenes);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Decode up front: a mid-render decode would stall the live stream and show
  // up as a frozen frame in the finished video.
  const images = [];
  for (let i = 0; i < scenes.length; i++) {
    images.push(await loadImage(scenes[i].photo.dataUrl));
    opts.onProgress?.((i / scenes.length) * 0.2);   // decoding is the first fifth
  }

  const stream = canvas.captureStream(FPS);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  // onstop was the only way out of this promise. A MediaRecorder that fails
  // mid-recording — an unsupported codec, memory pressure on a phone — never
  // fires it, so `await finished` waited forever: the progress bar frozen, the
  // button disabled, and nothing ever telling the user it had died.
  const finished = new Promise((resolve, reject) => {
    rec.onstop = resolve;
    rec.onerror = (e) => reject(new Error(e?.error?.name || "recorder"));
  });

  const total = INTRO + photoTime + OUTRO;
  const frame = (elapsed) => {
    // Every pixel below comes from shortDraw.js, the module the WebView
    // encoder runs too, so the two can no longer diverge.
    if (elapsed < INTRO) {
      DRAW.card(ctx, W, H, { title: labels.title, sub: labels.subtitle, t: elapsed, dur: INTRO });
      return;
    }

    const afterIntro = elapsed - INTRO;
    const at = sceneAt(scenes, starts, afterIntro);
    if (!at) {
      DRAW.card(ctx, W, H, { title: labels.outro, sub: "", t: afterIntro - photoTime, dur: OUTRO });
      return;
    }

    const { idx, t } = at;                            // 0..1 within this photo
    const scene = scenes[idx];
    DRAW.photo(ctx, W, H, {
      img: images[idx],
      next: images[idx + 1],
      t,
      caption: scene.photo.caption || scene.place || "",
      dayText: scene.day ? labels.dayLabel(scene.day) : "",
    });
  };

  // Browsers stop firing requestAnimationFrame for a hidden tab, but
  // MediaRecorder keeps capturing whatever the canvas last held. Left alone
  // that produces a video with a long frozen stretch in the middle — exactly
  // what happens when someone switches apps or their screen locks mid-render.
  // So pause the recorder alongside the drawing and resume together: the wait
  // gets longer, the video stays right.
  const onVisibility = () => {
    try {
      if (document.hidden && rec.state === "recording") rec.pause();
      else if (!document.hidden && rec.state === "paused") rec.resume();
    } catch { /* pause/resume unsupported — the frozen-frame risk remains */ }
  };
  document.addEventListener("visibilitychange", onVisibility);

  rec.start();
  try {
    // Elapsed counts only the time actually spent drawing. Using the wall clock
    // would let a spell in the background skip the timeline forward, dropping
    // photos out of the finished video entirely.
    let elapsed = 0;
    let last = performance.now();
    while (elapsed < total) {
      if (opts.signal?.aborted) break;
      await new Promise((r) => requestAnimationFrame(r));
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      // A gap far longer than a frame means the tab was hidden; the recorder
      // was paused for it, so it must not count toward the timeline either.
      if (dt < 0.25) elapsed += dt;
      frame(elapsed);
      opts.onProgress?.(0.2 + Math.min(1, elapsed / total) * 0.8);
    }
  } finally {
    document.removeEventListener("visibilitychange", onVisibility);
    try { if (rec.state === "paused") rec.resume(); } catch {}
    try { rec.stop(); } catch {}
    stream.getTracks().forEach((tr) => { try { tr.stop(); } catch {} });
  }
  // Bounded, because rec.stop() throws when the recorder is already inactive —
  // that throw is swallowed above, and then onstop never comes. Flushing the
  // last chunks takes well under a second, so ten is generous.
  await Promise.race([
    finished,
    new Promise((_, reject) => setTimeout(() => reject(new Error("stalled")), 10000)),
  ]);

  opts.onProgress?.(1);
  if (opts.signal?.aborted) throw new Error("aborted");
  return new Blob(chunks, { type: mime.startsWith("video/mp4") ? "video/mp4" : "video/webm" });
}

// Hand the finished file to the user: the share sheet where the platform has
// one (phones), a download everywhere else.
export async function saveOrShareShort(blob, filename) {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return "shared"; }
    catch { /* user dismissed — fall through to a download */ }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return "downloaded";
}
