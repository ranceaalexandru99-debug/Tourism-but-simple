// The page that renders a short inside a hidden WebView.
//
// React Native has no video encoder, and the ecosystem no longer offers one:
// ffmpeg-kit-react-native is marked "Package no longer supported" on npm with
// its binaries withdrawn, and react-native-video-processing has not been
// touched since 2022. Writing one in Kotlin would mean reimplementing the
// drawing too — MediaCodec encodes frames, it does not paint them.
//
// But Android's WebView IS Chromium, so the canvas + MediaRecorder pipeline the
// web app already uses works unchanged. This file is that pipeline, as a string,
// loaded into an off-screen WebView. Same approach, same output, no native code
// and no ejecting from the managed workflow.
//
// Two deliberate differences from the web version:
//   • 720×1280 rather than 1080×1920, and a lower bitrate. The finished file
//     has to cross the RN bridge as base64, which inflates it by a third; 4 MB
//     is a manageable message, 20 MB is not.
//   • The result is chunked on the way out, because a single postMessage of
//     several megabytes stalls the bridge.

import { DRAW_SOURCE } from "./shortDraw.js";

/**
 * Serialise a value for embedding inside an HTML <script> block.
 *
 * JSON.stringify alone is NOT safe here. The payload carries the user's own
 * photo captions, and a caption containing "</script>" closed the tag and
 * everything after it ran as markup — verified: one <script> became four.
 * In this app that is not merely self-XSS: the injected code runs inside a
 * WebView holding window.ReactNativeWebView.postMessage, so it can drive the
 * React Native side, which writes files from what it is told.
 *
 * Escaping "<" covers "</script>" and "<!--" both; U+2028 and U+2029 are legal
 * in JSON strings but are line terminators in JavaScript, which would end the
 * statement early.
 */
export function jsonForScript(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003C")
    .replace(/>/g, "\\u003E")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export const SHORT_W = 720;
export const SHORT_H = 1280;

// `payload` is { scenes: [{ dataUrl, day, place, caption }], labels: {...} }.
export function buildShortRenderHtml(payload) {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;background:#0A1628;overflow:hidden}canvas{display:none}</style>
</head><body><canvas id="c" width="${SHORT_W}" height="${SHORT_H}"></canvas>
<script>
const PAYLOAD = ${jsonForScript(payload)};
// The drawing, serialised from shortDraw.js — the very functions the web
// encoder calls, not a copy of them. This page decides nothing about how the
// video looks; it only drives the clock and the recorder.
${DRAW_SOURCE}
const W = ${SHORT_W}, H = ${SHORT_H}, FPS = 30;
const INTRO = 2.0, OUTRO = 1.5;
const CHUNK = 512 * 1024;

const send = (msg) => window.ReactNativeWebView.postMessage(JSON.stringify(msg));

const MIMES = ["video/mp4;codecs=avc1.42E01E","video/mp4","video/webm;codecs=vp8","video/webm"];
const pickMime = () => {
  try { return MIMES.find(m => MediaRecorder.isTypeSupported(m)) || null; } catch { return null; }
};

const loadImage = (src) => new Promise(res => {
  const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src;
});

(async () => {
  try {
    const mime = pickMime();
    // Say so rather than producing a broken file: the caller turns this into a
    // real message instead of a silent failure.
    if (!mime) return send({ type: "error", reason: "unsupported" });

    const scenes = PAYLOAD.scenes;
    const imgs = [];
    for (let i = 0; i < scenes.length; i++) {
      imgs.push(await loadImage(scenes[i].dataUrl));
      send({ type: "progress", value: (i / scenes.length) * 0.2 });
    }

    const cv = document.getElementById("c");
    const ctx = cv.getContext("2d");
    const rec = new MediaRecorder(cv.captureStream(FPS), { mimeType: mime, videoBitsPerSecond: 2500000 });
    const chunks = [];
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    // onstop alone is not an exit: a recorder that fails mid-capture never
    // fires it. onerror rejects into the outer catch, which reports back.
    // Mirrors the same fix in the web encoder — these two drift otherwise.
    const stopped = new Promise((r, reject) => {
      rec.onstop = r;
      rec.onerror = e => reject(new Error((e && e.error && e.error.name) || "recorder"));
    });

    // starts/photoTime are computed on the React Native side by shortEdit.js,
    // the module the web app uses too. Nothing about timing is decided here:
    // this page only draws what it is told, so the two encoders cannot drift.
    const starts = PAYLOAD.starts, photoTime = PAYLOAD.photoTime;
    const total = INTRO + photoTime + OUTRO;
    const frame = (el) => {
      if (el < INTRO) return DRAW.card(ctx, W, H, { title: PAYLOAD.labels.title, sub: PAYLOAD.labels.subtitle, t: el, dur: INTRO });
      const a = el - INTRO;
      var idx = -1;
      for (var i = 0; i < scenes.length; i++) { if (a < starts[i] + scenes[i].sec) { idx = i; break; } }
      if (idx === -1) return DRAW.card(ctx, W, H, { title: PAYLOAD.labels.outro, sub: "", t: a - photoTime, dur: OUTRO });
      const sc = scenes[idx];
      DRAW.photo(ctx, W, H, {
        img: imgs[idx],
        next: imgs[idx + 1],
        t: Math.min(1, Math.max(0, (a - starts[idx]) / scenes[idx].sec)),
        caption: sc.caption || sc.place || "",
        dayText: sc.day ? PAYLOAD.labels.dayPrefix + " " + sc.day : "",
      });
    };

    // Pause alongside the recorder when the WebView is backgrounded: rAF stops
    // firing but MediaRecorder keeps capturing, which would bake a frozen
    // stretch into the middle of the video.
    document.addEventListener("visibilitychange", () => {
      try {
        if (document.hidden && rec.state === "recording") rec.pause();
        else if (!document.hidden && rec.state === "paused") rec.resume();
      } catch (e) {}
    });

    rec.start();
    let elapsed = 0, last = performance.now();
    while (elapsed < total) {
      await new Promise(r => requestAnimationFrame(r));
      const now = performance.now(), dt = (now - last) / 1000; last = now;
      if (dt < 0.25) elapsed += dt;
      frame(elapsed);
      send({ type: "progress", value: 0.2 + Math.min(1, elapsed / total) * 0.75 });
    }
    try { if (rec.state === "paused") rec.resume(); } catch (e) {}
    rec.stop();
    await stopped;

    const blob = new Blob(chunks, { type: mime });
    const b64 = await new Promise(res => {
      const fr = new FileReader();
      fr.onloadend = () => res(String(fr.result).split(",")[1] || "");
      fr.readAsDataURL(blob);
    });

    // Chunked: one postMessage of several megabytes stalls the bridge.
    const parts = Math.ceil(b64.length / CHUNK);
    send({ type: "begin", parts, mime: mime.indexOf("mp4") === 0 || mime.indexOf("video/mp4") === 0 ? "mp4" : "webm", bytes: blob.size });
    for (let i = 0; i < parts; i++) {
      send({ type: "chunk", i, data: b64.slice(i * CHUNK, (i + 1) * CHUNK) });
      send({ type: "progress", value: 0.95 + (i / parts) * 0.05 });
    }
    send({ type: "done" });
  } catch (e) {
    send({ type: "error", reason: String((e && e.message) || e) });
  }
})();
</script></body></html>`;
}
