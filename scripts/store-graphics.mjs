// Generates the Play Store feature graphic.
//
//   node scripts/store-graphics.mjs
//
// The feature graphic is 1024×500 branded artwork, not a screenshot — which is
// why it can be generated here. Screenshots of the app itself cannot: Play
// requires them to be of the real thing, and the real thing is the Android
// build. See scripts/store-screenshots.mjs for turning phone captures into
// store-ready images.
//
// Play crops and overlays this graphic on some surfaces, so nothing important
// goes near the edges and there is no small text.

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const OUT = "store";
const W = 1024;
const H = 500;

const GOLD = "#8B6E27";
const INK = "#24211B";
const CREAM = "#F8F5EE";
const MUTED = "#6B6455";

// A route across the card: three stops joined by a path, which is what the app
// makes. Drawn rather than illustrated, so it stays legible when Play scales it
// down to a thumbnail.
const dot = (x, y, r = 9) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${GOLD}"/>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FBFAF7"/>
      <stop offset="1" stop-color="#EFE9DC"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- The route motif, kept to the right so a cropped left edge loses nothing -->
  <path d="M 620 400 C 700 330, 660 250, 740 200 S 880 170, 930 110"
        fill="none" stroke="${GOLD}" stroke-opacity="0.35"
        stroke-width="6" stroke-linecap="round" stroke-dasharray="2 18"/>
  ${dot(620, 400, 13)}
  ${dot(740, 200, 11)}
  ${dot(930, 110, 15)}

  <!-- Name and line. Large enough to survive a thumbnail. -->
  <text x="70" y="235" font-family="Georgia, 'Times New Roman', serif"
        font-size="68" font-weight="bold" fill="${INK}">Turism,</text>
  <text x="70" y="315" font-family="Georgia, 'Times New Roman', serif"
        font-size="68" font-weight="bold" fill="${GOLD}">dar simplu!</text>
  <text x="74" y="372" font-family="Arial, Helvetica, sans-serif"
        font-size="27" fill="${MUTED}">Traseul tău, pe zile.</text>

  <rect x="70" y="120" width="86" height="7" rx="3.5" fill="${GOLD}"/>
</svg>`;

fs.mkdirSync(OUT, { recursive: true });
const file = path.join(OUT, "feature-graphic.png");

await sharp(Buffer.from(svg)).png().toFile(file);

const { width, height, format } = await sharp(file).metadata();
const bytes = fs.statSync(file).size;

console.log(`${file}`);
console.log(`  ${width}×${height} ${format}, ${(bytes / 1024).toFixed(0)} KB`);

// Play's requirements, checked rather than trusted.
const ok = width === 1024 && height === 500 && format === "png" && bytes < 15 * 1024 * 1024;
console.log(ok ? "  respectă cerințele Play (1024×500 PNG)" : "  NU respectă cerințele Play");
process.exit(ok ? 0 : 1);
