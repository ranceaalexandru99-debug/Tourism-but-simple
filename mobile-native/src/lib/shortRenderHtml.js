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

export const SHORT_W = 720;
export const SHORT_H = 1280;

// `payload` is { scenes: [{ dataUrl, day, place, caption }], labels: {...} }.
export function buildShortRenderHtml(payload) {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;background:#0A1628;overflow:hidden}canvas{display:none}</style>
</head><body><canvas id="c" width="${SHORT_W}" height="${SHORT_H}"></canvas>
<script>
const PAYLOAD = ${JSON.stringify(payload)};
const W = ${SHORT_W}, H = ${SHORT_H}, FPS = 30;
const INTRO = 2.0, PER = 1.7, OUTRO = 1.5;
const CHUNK = 512 * 1024;

const send = (msg) => window.ReactNativeWebView.postMessage(JSON.stringify(msg));

const MIMES = ["video/mp4;codecs=avc1.42E01E","video/mp4","video/webm;codecs=vp8","video/webm"];
const pickMime = () => {
  try { return MIMES.find(m => MediaRecorder.isTypeSupported(m)) || null; } catch { return null; }
};

const loadImage = (src) => new Promise(res => {
  const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src;
});

function cover(ctx, img, zoom) {
  const s = Math.max(W / img.width, H / img.height) * zoom;
  const w = img.width * s, h = img.height * s;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}

function wrap(ctx, text, maxW) {
  const words = String(text).split(/\\s+/); const lines = []; let line = "";
  for (const word of words) {
    const next = line ? line + " " + word : word;
    if (ctx.measureText(next).width > maxW && line) { lines.push(line); line = word; }
    else line = next;
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

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
    const stopped = new Promise(r => rec.onstop = r);

    const total = INTRO + scenes.length * PER + OUTRO;
    const gold = "#C9A84C", ink = "#0A1628";

    const card = (title, sub, t, dur) => {
      const a = Math.min(1, t / (dur * 0.33)) * (1 - Math.max(0, (t - dur * 0.83) / (dur * 0.17)));
      ctx.fillStyle = ink; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = Math.max(0, a); ctx.textAlign = "center";
      ctx.fillStyle = gold; ctx.font = "700 64px Georgia, serif";
      wrap(ctx, title, W - 110).forEach((l, i) => ctx.fillText(l, W / 2, H / 2 - 26 + i * 74));
      if (sub) { ctx.fillStyle = "#F0EBE0"; ctx.font = "500 30px sans-serif"; ctx.fillText(sub, W / 2, H / 2 + 60); }
      ctx.globalAlpha = 1; ctx.textAlign = "left";
    };

    const frame = (el) => {
      if (el < INTRO) return card(PAYLOAD.labels.title, PAYLOAD.labels.subtitle, el, INTRO);
      const a = el - INTRO, idx = Math.floor(a / PER);
      if (idx >= scenes.length) return card(PAYLOAD.labels.outro, "", a - scenes.length * PER, OUTRO);
      const t = (a % PER) / PER, img = imgs[idx];
      ctx.fillStyle = ink; ctx.fillRect(0, 0, W, H);
      if (img) cover(ctx, img, 1 + t * 0.08);
      const nx = imgs[idx + 1];
      if (nx && t > 0.85) { ctx.globalAlpha = (t - 0.85) / 0.15; cover(ctx, nx, 1); ctx.globalAlpha = 1; }
      const g = ctx.createLinearGradient(0, H - 410, 0, H);
      g.addColorStop(0, "rgba(10,22,40,0)"); g.addColorStop(1, "rgba(10,22,40,.88)");
      ctx.fillStyle = g; ctx.fillRect(0, H - 410, W, 410);
      const sc = scenes[idx];
      let y = H - 140;
      const cap = sc.caption || sc.place || "";
      if (cap) {
        ctx.fillStyle = "#F0EBE0"; ctx.font = "700 40px sans-serif";
        const lines = wrap(ctx, cap, W - 110);
        y -= (lines.length - 1) * 47;
        lines.forEach((l, i) => ctx.fillText(l, 55, y + i * 47));
        y += (lines.length - 1) * 47;
      }
      if (sc.day) {
        const txt = PAYLOAD.labels.dayPrefix + " " + sc.day;
        ctx.font = "700 26px sans-serif";
        const tw = ctx.measureText(txt).width;
        ctx.fillStyle = gold;
        ctx.beginPath();
        const bx = 55, by = y + 26, bw = tw + 30, bh = 42, r = 21;
        ctx.moveTo(bx + r, by); ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
        ctx.arcTo(bx + bw, by + bh, bx, by + bh, r); ctx.arcTo(bx, by + bh, bx, by, r);
        ctx.arcTo(bx, by, bx + bw, by, r); ctx.closePath(); ctx.fill();
        ctx.fillStyle = ink; ctx.fillText(txt, bx + 15, by + 29);
      }
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
