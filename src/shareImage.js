// Client-side share card renderer: generates a 1080×1350 PNG (Instagram feed
// 4:5, works fine cropped for stories/whatsapp/facebook) that shows the trip
// as a shareable poster — hero photo, destination name, day count, first few
// stops, brand mark. Everything runs in canvas so no server round-trip.
//
// Photos are fetched through fetchPhoto (Wikipedia summary → search → Commons)
// and drawn with `crossorigin="anonymous"` so the canvas stays untainted and
// exportable. If a photo fails to load we render a warm gradient placeholder.

import { fetchPhoto } from "./photos.js";
import { countryFlag } from "./locale.js";

const WIDTH = 1080;
const HEIGHT = 1350;

// Porcelain + antique-gold palette (baked in, so the card looks the same no
// matter what accent the user picked for the app itself).
const INK = "#24211B";
const MUTED = "#6B6455";
const GOLD_DEEP = "#8B6E27"; // AA on porcelain — matches theme.js
const GOLD_LIGHT = "#D9BE72";
const HAIRLINE = "#EDE8DC";
const CREAM_1 = "#FFFFFF";
const CREAM_2 = "#F2EFE8";

function loadImage(url) {
  return new Promise((resolve) => {
    if (!url) { resolve(null); return; }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// Center-crop draw: cover mode, from the middle of the source image.
function drawCover(ctx, img, dx, dy, dw, dh) {
  const scale = Math.max(dw / img.width, dh / img.height);
  const sw = dw / scale, sh = dh / scale;
  const sx = (img.width - sw) / 2, sy = (img.height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

// Break text at word boundaries to at most `maxWidth`, up to `maxLines`.
// Falls back to hard truncation with an ellipsis on the last line.
function wrapLines(ctx, text, maxWidth, maxLines) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width <= maxWidth) line = test;
    else {
      if (line) lines.push(line);
      line = w;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (line) lines.push(line);
  // ellipsis on last line if we still overflow
  if (lines.length === maxLines && words.length > lines.join(" ").split(/\s+/).length) {
    let last = lines[maxLines - 1];
    while (ctx.measureText(last + "…").width > maxWidth && last.length > 3) last = last.slice(0, -1);
    lines[maxLines - 1] = last + "…";
  }
  return lines;
}

// Filled rounded rectangle path — used for chips and card frames.
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Renders the share poster into an HTMLCanvasElement.
 *
 * @param {object} route          - the trip object from mockEngine/aiEngine
 * @param {object} [i18n]         - { t } — supplies localized labels
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function renderShareCard(route, { t } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");

  // Warm porcelain background with a subtle radial highlight.
  const bg = ctx.createRadialGradient(WIDTH / 2, -80, 40, WIDTH / 2, HEIGHT / 2, HEIGHT);
  bg.addColorStop(0, CREAM_1);
  bg.addColorStop(0.55, CREAM_1);
  bg.addColorStop(1, CREAM_2);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Hairline frame — feels like fine stationery.
  ctx.strokeStyle = HAIRLINE;
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, WIDTH - 3, HEIGHT - 3);

  // -------- Hero photo (top ~60%) with rounded corners at the bottom ---------
  const heroH = 780;
  const heroPad = 40;
  const heroX = heroPad;
  const heroY = heroPad;
  const heroW = WIDTH - heroPad * 2;

  ctx.save();
  roundRect(ctx, heroX, heroY, heroW, heroH, 32);
  ctx.clip();
  const heroImg = await loadImage(await fetchPhoto(route.destName));
  if (heroImg) {
    drawCover(ctx, heroImg, heroX, heroY, heroW, heroH);
  } else {
    // Fallback: soft champagne wash so it never looks broken.
    const g = ctx.createLinearGradient(heroX, heroY, heroX + heroW, heroY + heroH);
    g.addColorStop(0, GOLD_LIGHT);
    g.addColorStop(1, GOLD_DEEP);
    ctx.fillStyle = g;
    ctx.fillRect(heroX, heroY, heroW, heroH);
  }
  // Bottom gradient for legibility of the overlay title
  const overlay = ctx.createLinearGradient(0, heroY + heroH - 380, 0, heroY + heroH);
  overlay.addColorStop(0, "rgba(0,0,0,0)");
  overlay.addColorStop(1, "rgba(0,0,0,0.68)");
  ctx.fillStyle = overlay;
  ctx.fillRect(heroX, heroY, heroW, heroH);
  ctx.restore();

  // Country chip on the hero (top-left)
  const flag = countryFlag(route.country) || "";
  if (flag || route.country) {
    const label = `${flag ? flag + "  " : ""}${route.country || ""}`.trim();
    ctx.font = '600 32px "Plus Jakarta Sans", -apple-system, "Segoe UI", Roboto, sans-serif';
    const chipPadX = 22, chipPadY = 14;
    const chipW = ctx.measureText(label).width + chipPadX * 2;
    const chipH = 60;
    ctx.fillStyle = "rgba(0,0,0,0.42)";
    roundRect(ctx, heroX + 24, heroY + 24, chipW, chipH, 999);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "middle";
    ctx.fillText(label, heroX + 24 + chipPadX, heroY + 24 + chipH / 2 + 1);
  }

  // Trip title on the hero, editorial serif, up to 2 lines
  const titleText = route.destName || "";
  const subTextParts = [];
  if (route.days) subTextParts.push(`${route.days} ${route.days === 1 ? (t?.("dayOne") || "day") : (t?.("dayMany") || "days")}`);
  if (route.totalStops) subTextParts.push(`${route.totalStops} ${t?.("stops") || "stops"}`);
  const subText = subTextParts.join("  ·  ");

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#fff";
  ctx.font = '700 96px Fraunces, Georgia, "Times New Roman", serif';
  const titleLines = wrapLines(ctx, titleText, heroW - 80, 2);
  let ty = heroY + heroH - 46 - (titleLines.length - 1) * 96 - (subText ? 54 : 0);
  for (const line of titleLines) {
    ctx.fillText(line, heroX + 40, ty);
    ty += 96;
  }
  if (subText) {
    ctx.font = '600 32px "Plus Jakarta Sans", -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillText(subText, heroX + 40, heroY + heroH - 46);
  }

  // -------- Stops preview (up to 4 of the first day) ------------------------
  const stopsY = heroY + heroH + 44;
  const stops = (route.itinerary?.[0]?.stops || []).slice(0, 4);
  ctx.font = '800 20px "Plus Jakarta Sans", -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = GOLD_DEEP;
  ctx.textBaseline = "alphabetic";
  ctx.fillText((t?.("day", { n: 1 }) || "DAY 1").toUpperCase(), heroX, stopsY);

  ctx.strokeStyle = GOLD_DEEP;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(heroX, stopsY + 12);
  ctx.lineTo(heroX + 44, stopsY + 12);
  ctx.stroke();

  let sy = stopsY + 62;
  ctx.font = '600 32px "Plus Jakarta Sans", -apple-system, "Segoe UI", Roboto, sans-serif';
  for (let i = 0; i < stops.length; i++) {
    const s = stops[i];
    // Numbered badge
    ctx.fillStyle = GOLD_DEEP;
    ctx.beginPath();
    ctx.arc(heroX + 20, sy - 12, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = '800 22px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText(String(i + 1), heroX + 20, sy - 5);
    ctx.textAlign = "left";
    // Time
    ctx.fillStyle = GOLD_DEEP;
    ctx.font = '700 30px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(s.time || "", heroX + 62, sy);
    // Name
    ctx.fillStyle = INK;
    ctx.font = '500 32px Fraunces, Georgia, serif';
    const nameMaxW = WIDTH - (heroX + 62 + 130) - heroPad;
    const nameLines = wrapLines(ctx, s.name || "", nameMaxW, 1);
    ctx.fillText(nameLines[0] || "", heroX + 62 + 130, sy);
    sy += 62;
  }

  // Brand mark + tagline pinned to the bottom
  ctx.fillStyle = INK;
  ctx.font = '700 44px Fraunces, Georgia, serif';
  ctx.fillText("Turism,", heroX, HEIGHT - 82);
  const w1 = ctx.measureText("Turism,").width;
  ctx.fillStyle = GOLD_DEEP;
  ctx.font = 'italic 700 44px Fraunces, Georgia, serif';
  ctx.fillText(" dar simplu!", heroX + w1, HEIGHT - 82);
  ctx.font = '500 22px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = MUTED;
  ctx.fillText(t?.("tagline") || "Planificator AI de călătorii", heroX, HEIGHT - 50);

  return canvas;
}

/** Turn the canvas into a PNG Blob (async — avoids blocking the UI thread). */
export function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

/** Force-download the poster with a friendly filename. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Best-available share flow: Web Share API with a File on supporting browsers
 * (mobile), plain download elsewhere. Returns "shared" | "downloaded".
 */
export async function shareOrDownload(blob, filename, title, text) {
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title, text }); return "shared"; } catch {}
  }
  downloadBlob(blob, filename);
  return "downloaded";
}
