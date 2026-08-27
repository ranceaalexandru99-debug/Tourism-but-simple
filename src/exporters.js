import { buildAlbumHtml, albumLabels } from "./albumHtml.js";
import { shrinkAlbumPhotos } from "./albumImages.js";
// Export helpers: an .ics calendar file and a clean printable itinerary (PDF
// via the browser's print dialog). No dependencies.

const pad = (n) => String(n).padStart(2, "0");
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const addDaysISO = (iso, n) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const icsEsc = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

function localDateTime(dateISO, timeStr, addMin = 0) {
  let [h, m] = String(timeStr || "9:00").split(":").map((x) => parseInt(x, 10));
  if (isNaN(h)) h = 9;
  if (isNaN(m)) m = 0;
  const d = new Date(dateISO + "T00:00:00");
  d.setHours(h, m + addMin, 0, 0);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

function stampUTC() {
  const d = new Date();
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

export function buildICS(route) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Turism dar simplu//Trip//RO", "CALSCALE:GREGORIAN"];
  const stamp = stampUTC();
  route.itinerary.forEach((day, di) => {
    const dateISO = day.date || addDaysISO(todayISO(), di);
    day.stops.forEach((stop, si) => {
      lines.push(
        "BEGIN:VEVENT",
        `UID:${route.id}-${di}-${si}@turismdarsimplu.app`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${localDateTime(dateISO, stop.time, 0)}`,
        `DTEND:${localDateTime(dateISO, stop.time, stop.dur || 60)}`,
        `SUMMARY:${icsEsc(`${stop.emoji || "📍"} ${stop.name}`)}`,
        // Fold the local tip and any personal note into the event description.
        (stop.tip || stop.note)
          ? `DESCRIPTION:${icsEsc([stop.tip, stop.note && `📝 ${stop.note}`].filter(Boolean).join("\n\n"))}`
          : null,
        stop.ll ? `GEO:${stop.ll[0]};${stop.ll[1]}` : null,
        `LOCATION:${icsEsc([stop.name, route.destName, route.country].filter(Boolean).join(", "))}`,
        "END:VEVENT"
      );
    });
  });
  lines.push("END:VCALENDAR");
  return lines.filter((l) => l != null).join("\r\n");
}

export function downloadICS(route) {
  const blob = new Blob([buildICS(route)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(route.destName || "trip").replace(/[^\w-]+/g, "_")}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const esc = (s) => String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

// Opens a clean, print-optimised itinerary in a new tab and triggers print
// (the user picks "Save as PDF"). Localised via the passed t() and title.
export function printItinerary(route, t, title, fmtDate) {
  const days = route.itinerary.map((day) => {
    const dateLabel = day.date && fmtDate ? esc(fmtDate(day.date)) : "";
    const stops = day.stops.map((s) => `
      <div class="stop">
        <div class="time">${esc(s.time)}</div>
        <div class="body">
          <div class="name">${esc(s.emoji || "📍")} ${esc(s.name)} <span class="price">${s.cost > 0 ? "€" + s.cost : esc(t("free"))}</span></div>
          ${s.tip ? `<div class="tip">${esc(s.tip)}</div>` : ""}
          ${s.note ? `<div class="note">📝 ${esc(s.note)}</div>` : ""}
        </div>
      </div>`).join("");
    return `
      <section class="day">
        <h2>${esc(t("day", { n: day.day }))}${dateLabel ? ` · <span class="date">${dateLabel}</span>` : ""}</h2>
        ${stops}
        <div class="extra">${esc(day.lunch || "")} · ${esc(day.transport || "")}</div>
      </section>`;
  }).join("");

  return printHtml(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
    <style>
      * { box-sizing: border-box; }
      /* Porcelain + antique-gold palette — matches the app's premium light theme. */
      /* Porcelain + antique-gold palette — matches the app's premium light theme.
         All text colours pass WCAG AA on white. */
      body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #24211B; max-width: 760px; margin: 28px auto; padding: 0 22px; }
      h1 { font-size: 26px; margin: 0 0 4px; }
      .sub { color: #6B6455; margin: 0 0 14px; font-size: 14px; }
      .budget { background: #F8F5EE; border: 1px solid #EDE8DC; border-radius: 10px; padding: 10px 14px; font-size: 14px; margin-bottom: 18px; }
      h2 { font-size: 16px; margin: 20px 0 8px; border-bottom: 2px solid #8B6E27; padding-bottom: 4px; }
      .date { color: #8B6E27; font-weight: 500; }
      .stop { display: flex; gap: 12px; padding: 8px 0; border-bottom: 1px solid #EDE8DC; }
      .time { color: #8B6E27; font-weight: 700; width: 58px; flex-shrink: 0; }
      .name { font-weight: 600; }
      .price { color: #6B6455; font-weight: 400; font-size: 13px; }
      .tip { color: #6B6455; font-size: 13px; margin-top: 2px; }
      .note { color: #8B6E27; font-size: 13px; margin-top: 3px; font-style: italic; }
      .extra { color: #777163; font-size: 13px; margin-top: 8px; }
      .foot { color: #777163; font-size: 12px; margin-top: 26px; text-align: center; }
      @media print { body { margin: 0; } section.day { break-inside: avoid; } }
    </style></head><body>
    <h1>${esc(route.emoji || "🗺")} ${esc(title)}</h1>
    <p class="sub">📍 ${route.totalStops} ${esc(t("stops"))} · ⏱ ~${route.totalHours}h${route.country ? " · " + esc(route.country) : ""}</p>
    <div class="budget">${esc(t("budgetTitle"))}: ~€${route.budget.total} · ${esc(t("perDay", { x: route.budget.perDay }))}</div>
    ${days}
    <p class="foot">Turism, dar simplu! — ${esc(t("tagline"))}</p>
    </body></html>`);
}

// ---------------------------------------------------------------- album -----
// Opens the printable album. The HTML itself comes from albumHtml.js, shared
// verbatim with the native app so the two can never drift — the same print
// route as the itinerary, and for the same reason: no library, and the photos
// never leave the device.
export async function printAlbum(album, t, title, fmtDate) {
  if (!album) throw new Error("noalbum");

  // Printed from a hidden same-page iframe, NOT a popup window.
  //
  // The popup version could not work on a phone: shrinking the photos is async,
  // so by the time window.open() ran it was no longer inside the click that
  // started it, and every mobile browser blocks that. It returned null, the
  // function returned silently, and the button did nothing at all — no album,
  // no error, nothing to tell the user what had happened.
  //
  // An iframe needs no popup permission and no user gesture, so the async work
  // can happen first. Anything that still goes wrong throws, so the caller can
  // say so instead of failing quietly.
  const sized = await shrinkAlbumPhotos(album);
  await printHtml(buildAlbumHtml(sized, albumLabels(sized, t, title, fmtDate)));
}

// Renders `html` in a hidden same-page iframe and opens the print dialog on it.
// Throws if the document cannot be prepared, so the caller can report it.
async function printHtml(html) {
  const frame = document.createElement("iframe");
  // Off-screen rather than display:none or hidden — a frame with no layout box
  // does not paint, and printing it yields blank pages.
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;opacity:0;border:0;";
  document.body.appendChild(frame);

  const cleanup = () => { try { frame.remove(); } catch {} };

  try {
    await new Promise((resolve, reject) => {
      const failed = setTimeout(() => reject(new Error("timeout")), 20000);
      frame.onload = () => { clearTimeout(failed); resolve(); };
      frame.onerror = () => { clearTimeout(failed); reject(new Error("frame")); };
      frame.srcdoc = html;
    });

    const win = frame.contentWindow;
    if (!win) throw new Error("noframe");

    // Wait for the photos themselves. The load event fires for the document,
    // but inline data URLs can still be decoding — printing then gives a page
    // of empty boxes, which is what the old 800ms guess was trying to avoid.
    const imgs = [...(win.document.images || [])];
    await Promise.all(imgs.map((img) => (
      img.complete ? Promise.resolve() : new Promise((res) => {
        img.addEventListener("load", res, { once: true });
        img.addEventListener("error", res, { once: true });
      })
    )));

    win.focus();
    win.print();
  } catch (e) {
    cleanup();
    throw e;
  }

  // Kept alive briefly: some browsers run print() asynchronously and print a
  // blank page if the frame is removed while the dialog is still open.
  setTimeout(cleanup, 60000);
}
