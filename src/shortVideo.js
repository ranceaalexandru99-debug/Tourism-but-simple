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

const W = 1080;
const H = 1920;
const FPS = 30;

// Timing, in seconds.
const INTRO = 2.0;
const PER_PHOTO = 1.7;
const OUTRO = 1.5;
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

// Cover-fit: fill the frame, crop the overflow. `zoom` slowly enlarges the
// source rectangle so a still photo drifts instead of sitting dead on screen.
function drawCover(ctx, img, zoom) {
  const scale = Math.max(W / img.width, H / img.height) * zoom;
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Wrap text to a width, returning the lines. Canvas has no text wrapping.
function wrap(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) { lines.push(line); line = word; }
    else line = next;
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

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

  const scenes = toScenes(album);
  if (!scenes.length) throw new Error("empty");

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
  const finished = new Promise((resolve) => { rec.onstop = resolve; });

  const total = INTRO + scenes.length * PER_PHOTO + OUTRO;
  const gold = "#C9A84C";
  const ink = "#0A1628";

  const card = (title, sub, t, dur) => {
    // Fade in over the first third, hold, fade out over the last sixth.
    const a = Math.min(1, t / (dur * 0.33)) * (1 - Math.max(0, (t - dur * 0.83) / (dur * 0.17)));
    ctx.fillStyle = ink;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = Math.max(0, a);
    ctx.textAlign = "center";
    ctx.fillStyle = gold;
    ctx.font = `700 96px "Fraunces", Georgia, serif`;
    for (const [i, line] of wrap(ctx, title, W - 160).entries()) {
      ctx.fillText(line, W / 2, H / 2 - 40 + i * 112);
    }
    if (sub) {
      ctx.fillStyle = "#F0EBE0";
      ctx.font = `500 44px "Plus Jakarta Sans", sans-serif`;
      ctx.fillText(sub, W / 2, H / 2 + 90);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
  };

  const frame = (elapsed) => {
    if (elapsed < INTRO) { card(labels.title, labels.subtitle, elapsed, INTRO); return; }

    const afterIntro = elapsed - INTRO;
    const idx = Math.floor(afterIntro / PER_PHOTO);

    if (idx >= scenes.length) {
      card(labels.outro, "", elapsed - INTRO - scenes.length * PER_PHOTO, OUTRO);
      return;
    }

    const t = (afterIntro % PER_PHOTO) / PER_PHOTO;   // 0..1 within this photo
    const img = images[idx];
    ctx.fillStyle = ink;
    ctx.fillRect(0, 0, W, H);
    if (img) drawCover(ctx, img, 1 + t * 0.08);       // slow push-in

    // Crossfade the next photo over the last 15% so cuts are not abrupt.
    const nextImg = images[idx + 1];
    if (nextImg && t > 0.85) {
      ctx.globalAlpha = (t - 0.85) / 0.15;
      drawCover(ctx, nextImg, 1);
      ctx.globalAlpha = 1;
    }

    // Legibility scrim, then the labels over it.
    const grad = ctx.createLinearGradient(0, H - 620, 0, H);
    grad.addColorStop(0, "rgba(10,22,40,0)");
    grad.addColorStop(1, "rgba(10,22,40,0.88)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, H - 620, W, 620);

    const scene = scenes[idx];
    let y = H - 210;
    const caption = scene.photo.caption || scene.place || "";
    if (caption) {
      ctx.fillStyle = "#F0EBE0";
      ctx.font = `700 60px "Plus Jakarta Sans", sans-serif`;
      const lines = wrap(ctx, caption, W - 160);
      y -= (lines.length - 1) * 70;
      lines.forEach((line, i) => ctx.fillText(line, 80, y + i * 70));
      y += (lines.length - 1) * 70;
    }
    if (scene.day) {
      const text = labels.dayLabel(scene.day);
      ctx.font = `700 38px "Plus Jakarta Sans", sans-serif`;
      const tw = ctx.measureText(text).width;
      ctx.fillStyle = gold;
      roundRect(ctx, 80, y + 40, tw + 44, 62, 31);
      ctx.fill();
      ctx.fillStyle = ink;
      ctx.fillText(text, 102, y + 82);
    }
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
  await finished;

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
