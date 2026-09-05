// Every pixel the short puts on screen, defined once.
//
// There are two encoders — a canvas in the browser, and the same canvas inside
// a WebView on the phone — and until now each carried its own copy of the
// drawing: the same title cards, the same crossfade, the same scrim and day
// chip, written twice at two resolutions. That is exactly how the recorder's
// missing `onerror` came to be fixed on the web in the morning and on native
// in the afternoon, as a separate discovery.
//
// The numbers were never really different, only scaled: 96px title against
// 64px, 620px scrim against 410px, and so on — all of it H/1920. So everything
// here derives from that ratio and one definition serves both.
//
// The native page cannot import this: it is a string injected into a WebView.
// DRAW_SOURCE below is that same object serialised from itself, so the phone
// runs the very functions this file defines rather than a copy of them.

export const PALETTE = {
  gold: "#C9A84C",
  ink: "#0A1628",
  cream: "#F0EBE0",
};

// Methods reference each other through `DRAW.` rather than by bare name, which
// is what lets the serialised copy work: the injected script declares one
// `DRAW` object and the cross-references resolve inside it. Property names in
// an object literal also survive minification, which bare function names would
// not reliably do once Metro has been through them.
export const DRAW = {
  // Canvas has no text wrapping.
  wrapText(ctx, text, maxWidth, maxLines) {
    const words = String(text == null ? "" : text).split(/\s+/);
    const lines = [];
    let line = "";
    for (const word of words) {
      const next = line ? line + " " + word : word;
      if (ctx.measureText(next).width > maxWidth && line) { lines.push(line); line = word; }
      else line = next;
    }
    if (line) lines.push(line);
    return lines.slice(0, maxLines || 3);
  },

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },

  // Fill the frame, crop the overflow. `zoom` enlarges the source rectangle so
  // a still photo drifts instead of sitting dead on screen.
  cover(ctx, img, W, H, zoom) {
    const scale = Math.max(W / img.width, H / img.height) * zoom;
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  },

  // Title and outro cards. Fades in over the first third, holds, fades out over
  // the last sixth.
  card(ctx, W, H, o) {
    const S = H / 1920;
    const dur = o.dur;
    const a = Math.min(1, o.t / (dur * 0.33)) * (1 - Math.max(0, (o.t - dur * 0.83) / (dur * 0.17)));
    ctx.fillStyle = "#0A1628";
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = Math.max(0, a);
    ctx.textAlign = "center";
    ctx.fillStyle = "#C9A84C";
    // The phone's WebView has neither font and falls back to Georgia, which is
    // the intended second choice rather than an accident.
    ctx.font = '700 ' + Math.round(96 * S) + 'px "Fraunces", Georgia, serif';
    const lines = DRAW.wrapText(ctx, o.title, W - 160 * S);
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], W / 2, H / 2 - 40 * S + i * 112 * S);
    }
    if (o.sub) {
      ctx.fillStyle = "#F0EBE0";
      ctx.font = '500 ' + Math.round(44 * S) + 'px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(o.sub, W / 2, H / 2 + 90 * S);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
  },

  // One photo: the push-in, the crossfade into the next, the legibility scrim,
  // then the caption and day chip over it.
  photo(ctx, W, H, o) {
    const S = H / 1920;
    const t = o.t;
    ctx.fillStyle = "#0A1628";
    ctx.fillRect(0, 0, W, H);
    if (o.img) DRAW.cover(ctx, o.img, W, H, 1 + t * 0.08);

    // Crossfade the next photo over the last 15% so cuts are not abrupt.
    if (o.next && t > 0.85) {
      ctx.globalAlpha = (t - 0.85) / 0.15;
      DRAW.cover(ctx, o.next, W, H, 1);
      ctx.globalAlpha = 1;
    }

    const scrim = 620 * S;
    const grad = ctx.createLinearGradient(0, H - scrim, 0, H);
    grad.addColorStop(0, "rgba(10,22,40,0)");
    grad.addColorStop(1, "rgba(10,22,40,0.88)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, H - scrim, W, scrim);

    let y = H - 210 * S;
    const step = 70 * S;
    if (o.caption) {
      ctx.fillStyle = "#F0EBE0";
      ctx.font = '700 ' + Math.round(60 * S) + 'px "Plus Jakarta Sans", sans-serif';
      const lines = DRAW.wrapText(ctx, o.caption, W - 160 * S);
      y -= (lines.length - 1) * step;
      for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], 80 * S, y + i * step);
      y += (lines.length - 1) * step;
    }

    if (o.dayText) {
      ctx.font = '700 ' + Math.round(38 * S) + 'px "Plus Jakarta Sans", sans-serif';
      const tw = ctx.measureText(o.dayText).width;
      ctx.fillStyle = "#C9A84C";
      DRAW.roundRect(ctx, 80 * S, y + 40 * S, tw + 44 * S, 62 * S, 31 * S);
      ctx.fill();
      ctx.fillStyle = "#0A1628";
      ctx.fillText(o.dayText, 102 * S, y + 82 * S);
    }
  },
};

/**
 * The same object, as source, for the WebView page to run.
 *
 * Serialised from the live functions rather than kept as a parallel string —
 * a string copy would be a second definition, which is the whole thing this
 * module exists to prevent.
 */
export const DRAW_SOURCE =
  "const DRAW = {" +
  Object.keys(DRAW).map((k) => DRAW[k].toString()).join(",\n") +
  "};";
