// The photo album, as one page whose size is computed from the content.
//
// Pure: no window, no DOM, no imports. Deliberately separate from how it gets
// printed, because the two platforms print differently — the browser opens a
// window and calls print(), Expo hands the same string to expo-print — and
// every time this project kept "the same" logic in two files it drifted.
//
// One page, not chapters across many. Five photos or fifteen, everything lands
// on page 1: the page grows instead of the album spilling over. `@page` takes
// an explicit height for exactly this, and both Chrome's print pipeline and
// expo-print honour it.
//
// Photos are inlined as data URLs: nothing to fetch, nothing to go missing at
// print time, and — the point of the whole design — nothing that leaves the
// device.

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

// Page geometry, in millimetres. A4 width so it prints on ordinary paper and
// reads naturally on a phone.
export const PAGE_W = 210;
export const PAD = 12;
export const GAP = 4;
const HEADER = 26;
const FOOTER = 10;
const CAPTION = 7;   // room under each tile for its label

// More photos means a denser grid rather than a longer page — the album should
// read as one composition whatever its size.
//
// Tuned so the grid stays roughly as tall as it is wide. An earlier version put
// two photos in a single column, which produced a 450mm page for two pictures:
// technically one page, absurd to look at.
export function columnsFor(n) {
  if (n <= 1) return 1;
  if (n <= 4) return 2;
  if (n <= 9) return 3;
  if (n <= 16) return 4;
  if (n <= 25) return 5;
  return 6;
}

// Flatten the album into tiles, keeping the day and place each photo belongs to
// so the information survives losing the chapter headings.
function toTiles(album) {
  const tiles = [];
  for (const chapter of album.chapters) {
    for (const place of chapter.stops) {
      for (const photo of place.photos) tiles.push({ photo, day: chapter.day, place: place.name });
    }
    for (const photo of chapter.loose) tiles.push({ photo, day: chapter.day, place: null });
  }
  for (const photo of album.extras) tiles.push({ photo, day: null, place: null });
  return tiles;
}

// The localised strings the page needs, gathered in one place so every caller —
// web print, native PDF — passes the same set and none can drift.
// `fmtDate` is optional; without it the footer simply carries no dates.
export function albumLabels(album, t, title, fmtDate) {
  const days = album.chapters.map((c) => c.date).filter(Boolean).sort();
  const range = days.length && fmtDate
    ? (days[0] === days[days.length - 1]
      ? fmtDate(days[0])
      : `${fmtDate(days[0])} – ${fmtDate(days[days.length - 1])}`)
    : "";
  return {
    title,
    photos: t("albumPhotos"),
    day: (n) => t("day", { n }),
    subtitle: range,
  };
}

/**
 * @param album   the model from album.js
 * @param labels  { title, photos, day(n), subtitle? } — already localised.
 */
export function buildAlbumHtml(album, labels) {
  if (!album) return "";

  const tiles = toTiles(album);
  const cols = columnsFor(tiles.length);
  const rows = Math.ceil(tiles.length / cols) || 1;

  // Square cells, because the page height has to be exactly computable before
  // anything is laid out and the photos' dimensions are not knowable from a
  // data URL without decoding. The cell stays fixed; what happens inside it
  // does not have to be a crop (see .img img below).
  const cell = (PAGE_W - PAD * 2 - GAP * (cols - 1)) / cols;
  const pageH = Math.round(
    PAD * 2 + HEADER + rows * (cell + CAPTION) + (rows - 1) * GAP + FOOTER,
  );

  const tileHtml = tiles.map(({ photo, day, place }) => {
    const label = photo.caption || place || "";
    return `
    <figure class="t">
      <div class="img"><img src="${esc(photo.dataUrl)}" alt="${esc(label)}">
        ${day ? `<span class="d">${esc(labels.day(day))}</span>` : ""}
      </div>
      ${label ? `<figcaption>${esc(label)}</figcaption>` : "<figcaption></figcaption>"}
    </figure>`;
  }).join("");

  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(labels.title)}</title>
<style>
  @page { size: ${PAGE_W}mm ${pageH}mm; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: ${PAGE_W}mm; height: ${pageH}mm; padding: ${PAD}mm;
    background: #FBFAF7; color: #24211B;
    font-family: -apple-system, "Segoe UI", Roboto, sans-serif;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  header { height: ${HEADER}mm; display: flex; flex-direction: column; justify-content: center;
           border-bottom: 0.6mm solid #8B6E27; margin-bottom: ${GAP}mm; }
  h1 { font-family: Georgia, "Times New Roman", serif; font-size: 9mm; line-height: 1.05;
       letter-spacing: -0.15mm; color: #24211B; }
  .sub { font-size: 3.2mm; color: #777163; margin-top: 1.4mm; letter-spacing: 0.2mm;
         text-transform: uppercase; }
  .grid { display: grid; grid-template-columns: repeat(${cols}, 1fr); gap: ${GAP}mm; }
  .t { break-inside: avoid; }
  .img { position: relative; width: 100%; height: ${cell.toFixed(2)}mm;
         border-radius: 2mm; overflow: hidden; background: #EDE8DC; }
  /* contain, not cover. cover hard-cropped every photo to a square, and phone
     photos are mostly portrait — a picture of a tower came out without the
     tower. The cell keeps its size, so the page height is still exact; the
     photo simply sits inside it whole, on the warm mat colour, the way a
     print album mounts a photograph. Deliberately not a blurred fill like the
     on-screen gallery: this is going to a PDF and then possibly to paper,
     where a CSS filter is the first thing a print engine gives up on. */
  .img img { width: 100%; height: 100%; object-fit: contain; display: block; }
  /* Day badge sits on the picture: the chapter headings are gone, the
     information they carried is not. */
  .d { position: absolute; left: 1.6mm; top: 1.6mm;
       background: rgba(10,22,40,.72); color: #F0EBE0;
       font-size: 2.4mm; font-weight: 700; letter-spacing: .1mm;
       padding: .8mm 1.6mm; border-radius: 1mm; }
  figcaption { height: ${CAPTION}mm; padding-top: 1mm; font-size: 2.7mm; line-height: 1.25;
               color: #6B6455; overflow: hidden;
               display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  footer { height: ${FOOTER}mm; display: flex; align-items: flex-end; justify-content: space-between;
           font-size: 2.6mm; color: #A39A88; letter-spacing: .3mm; }
</style></head><body>
  <header>
    <h1>${esc(labels.title)}</h1>
    <div class="sub">${album.photoCount} ${esc(labels.photos)}${album.country ? " · " + esc(album.country) : ""}</div>
  </header>
  <div class="grid">${tileHtml}</div>
  <footer><span>Turism, dar simplu!</span><span>${esc(labels.subtitle || "")}</span></footer>
</body></html>`;
}
