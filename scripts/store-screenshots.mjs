// Turns raw phone captures into store-ready screenshots.
//
//   1. take the screenshots on your phone (Expo Go shows the real native app)
//   2. copy them into store/raw/ named 01.png, 02.png, … in the order below
//   3. node scripts/store-screenshots.mjs
//
// Writes store/screenshots/, sized 1080×1920, each with a caption above the
// shot. Play allows between 2 and 8 phone screenshots.
//
// Why this only composes and never invents: Play requires screenshots to be of
// the app as it actually runs. A picture assembled from the web build would
// look close — the two share a design — but close is exactly what gets a
// listing rejected, and it would be a promise about software the buyer is not
// being sold.

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { fileURLToPath } from "node:url";

const RAW = "store/raw";
const OUT = "store/screenshots";
const W = 1080;
const H = 1920;

const CREAM = "#F8F5EE";
const INK = "#24211B";
const GOLD = "#8B6E27";

// In shot order. Kept short: Play shows these small, and a caption longer than
// a breath is a caption nobody reads.
export const CAPTIONS = [
  "Spui unde. Primești traseul.",
  "Descoperă orașe pe hartă",
  "Pe zile, cu ore, vreme și costuri",
  "Fiecare oprire, cu sfatul ei",
  "Tot traseul pe hartă",
  "Pozele tale, pe harta excursiei",
  "Album foto, gata de tipărit",
  "Un clip scurt din excursie",
];

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

function captionSvg(text) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <text x="${W / 2}" y="132" text-anchor="middle"
          font-family="Georgia, 'Times New Roman', serif" font-size="54"
          font-weight="bold" fill="${INK}">${esc(text)}</text>
    <rect x="${W / 2 - 40}" y="168" width="80" height="6" rx="3" fill="${GOLD}"/>
  </svg>`);
}

// Everything below runs only when this script is started directly.
// check-listing.mjs imports CAPTIONS from here to check them against the
// shot list in the document, and an import must not create directories,
// write files, or exit the process.
async function main() {
  if (!fs.existsSync(RAW)) {
    fs.mkdirSync(RAW, { recursive: true });
    console.log(`Am creat ${RAW}/ — pune acolo capturile de pe telefon (01.png, 02.png, …).`);
    console.log("\nCe să fotografiezi, în ordine:");
    CAPTIONS.forEach((c, i) => console.log(`  ${String(i + 1).padStart(2, "0")}. ${c}`));
    return;
  }

  const files = fs.readdirSync(RAW)
    .filter((f) => /\.(png|jpe?g)$/i.test(f))
    .sort();

  if (!files.length) {
    console.log(`${RAW}/ e gol. Pune acolo capturile de pe telefon.`);
    return 1;
  }

  fs.mkdirSync(OUT, { recursive: true });

  // The shot sits below the caption, with a margin so the phone's own status bar
  // does not touch the edge of the store image.
  const TOP = 230;
  const MARGIN = 60;
  const boxW = W - MARGIN * 2;
  const boxH = H - TOP - MARGIN;

  let written = 0;
  for (const [i, file] of files.entries()) {
    const shot = await sharp(path.join(RAW, file))
      .resize({ width: boxW, height: boxH, fit: "inside", withoutEnlargement: false })
      .toBuffer();
    const meta = await sharp(shot).metadata();

    const out = path.join(OUT, `${String(i + 1).padStart(2, "0")}.png`);
    await sharp({
      create: { width: W, height: H, channels: 4, background: CREAM },
    })
      .composite([
        { input: shot, left: Math.round((W - meta.width) / 2), top: TOP },
        { input: captionSvg(CAPTIONS[i] || ""), left: 0, top: 0 },
      ])
      .png()
      .toFile(out);

    const m = await sharp(out).metadata();
    const ok = m.width === W && m.height === H;
    console.log(`  ${out}  ${m.width}×${m.height}  ${ok ? "ok" : "DIMENSIUNE GREȘITĂ"}`);
    if (ok) written++;
  }

  console.log(`\n${written} capturi scrise în ${OUT}/`);
  if (written < 2) console.log("Play cere minimum 2. Mai fă câteva.");
  if (written > 8) console.log("Play acceptă maximum 8 — le încarci doar pe primele 8.");

}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  const code = await main();
  if (code) process.exit(code);
}
