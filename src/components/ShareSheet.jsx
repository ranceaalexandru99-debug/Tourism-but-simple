import { useState , useRef } from "react";
import { useEscape, useFocusTrap } from "../useEscape.js";
import QRCode from "qrcode";
import LZString from "lz-string";
import { sanitizeRouteForShare } from "../shareCodec.js";
import { C, F } from "../theme.js";
import { useI18n, tripTitle } from "../i18n.js";
import { downloadICS, printItinerary } from "../exporters.js";
import { renderShareCard, canvasToBlob, shareOrDownload } from "../shareImage.js";
import { FileText, Calendar, QrCode, Link2, MessageCircle, Mail, Share2, Check, Image as ImageIcon, Loader , X} from "../icons.jsx";

// Build a self-contained URL that encodes the whole trip in the hash. When
// opened, App decodes it and shows the itinerary — no server, no account.
// Payload is compressed with LZ-string so it fits in a QR code (~3x smaller
// than raw base64). The `#tripz=` fragment identifies the compressed format.
export function buildShareUrl(route) {
  // Personal state (notes / done / ratings) never leaves the device.
  const clean = sanitizeRouteForShare(route);
  const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(clean));
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#tripz=${compressed}`;
}

// Bottom-sheet with PDF / Calendar / QR / Copy-link / WhatsApp / Email options.
// Reused by the Route screen (contextual share) and the Me tab (share a saved
// trip). `printCtx` provides { t, fmtDate } for the printable PDF.
export default function ShareSheet({ route, onClose, printCtx }) {
  const sheetRef = useRef(null);
  useEscape(onClose);
  useFocusTrap(sheetRef);
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [qrSvg, setQrSvg] = useState(null); // when non-null, replaces the sheet with the QR view
  const [poster, setPoster] = useState(null); // { blob, dataUrl } — image share view
  const [posterBusy, setPosterBusy] = useState(false);
  const title = tripTitle(route, t);
  const shareUrl = buildShareUrl(route);

  // Render the shareable poster PNG and open the preview view.
  const showPoster = async () => {
    if (posterBusy) return;
    setPosterBusy(true);
    try {
      const canvas = await renderShareCard(route, { t });
      const blob = await canvasToBlob(canvas);
      const dataUrl = canvas.toDataURL("image/png");
      setPoster({ blob, dataUrl });
    } catch (e) {
      console.warn("Poster generation failed", e);
    } finally {
      setPosterBusy(false);
    }
  };
  const sharePoster = async () => {
    if (!poster) return;
    const safe = (route.destName || "trip").replace(/[^\w-]+/g, "_");
    await shareOrDownload(poster.blob, `${safe}.png`, title, t("shareText", { title }));
  };

  const showQr = async () => {
    try {
      // Lowest error-correction level so the full LZ-compressed URL (~2.4KB)
      // fits in the biggest supported QR (version 40, byte mode ~2953).
      const svg = await QRCode.toString(shareUrl, {
        type: "svg", errorCorrectionLevel: "L", margin: 1,
        color: { dark: C.cream, light: "#00000000" },
      });
      setQrSvg(svg);
    } catch (e) { console.warn("QR generation failed", e); }
  };

  const opts = [
    { id: "image", label: t("shareImage"), Icon: ImageIcon, action: showPoster, busy: posterBusy },
    { id: "pdf", label: t("sharePdf"), Icon: FileText, action: () => printItinerary(route, printCtx.t, title, printCtx.fmtDate) },
    { id: "cal", label: t("shareCalendar"), Icon: Calendar, action: () => downloadICS(route) },
    { id: "qr",  label: t("shareQr"),  Icon: QrCode, action: showQr },
    { id: "link", label: t("shareLink"), Icon: Link2, action: () => { navigator.clipboard?.writeText(shareUrl); setCopied(true); } },
    { id: "wa", label: t("shareWa"), Icon: MessageCircle, action: () => window.open(`https://wa.me/?text=${encodeURIComponent(t("shareText", { title }) + " " + shareUrl)}`, "_blank") },
    { id: "email", label: t("shareEmail"), Icon: Mail, action: () => window.open(`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(t("shareBody") + "\n\n" + shareUrl)}`) },
  ];
  return (
    <div onClick={onClose} style={{
      position: "absolute", inset: 0, background: "#000a", zIndex: 30,
      display: "flex", alignItems: "flex-end", animation: "vai-pop .2s both",
    }}>
      <div ref={sheetRef} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{
        width: "100%", background: C.surface, borderRadius: "26px 26px 0 0", padding: "10px 22px 28px",
        // The QR panel and poster preview make this sheet tall; without a cap
        // it can cover the backdrop, which is the only way to dismiss it.
        maxHeight: "88%", overflowY: "auto", overflowX: "hidden",
        animation: "vai-rise .25s both",
      }}>
        {/* Grab handle plus an explicit close button — tapping the backdrop is not
                    discoverable, and on a tall sheet it may not even be reachable. */}
                <div style={{ position: "relative", height: 21, marginBottom: 10 }}>
                  <div style={{ width: 40, height: 5, background: C.border, borderRadius: 3, margin: "6px auto 0" }} />
                  <button onClick={onClose} aria-label={t("back")} style={{
                    position: "absolute", right: -6, top: -4, background: "none", border: "none",
                    color: C.muted, cursor: "pointer", lineHeight: 0, padding: 6,
                  }}><X size={20} /></button>
                </div>
        {poster ? (
          <>
            <div style={{ fontFamily: F.display, color: C.cream, fontSize: 21, fontWeight: 700, letterSpacing: -0.3, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
              <ImageIcon size={19} color={C.gold} />{t("shareImage")}
            </div>
            <div style={{ color: C.muted, fontSize: 13, marginBottom: 14 }}>{t("shareImageHint")}</div>
            <div style={{
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 20,
              padding: 12, display: "flex", justifyContent: "center", alignItems: "center",
            }}>
              <img src={poster.dataUrl} alt="" style={{ width: "100%", maxWidth: 420, borderRadius: 12, display: "block" }} />
            </div>
            <button className="vai-press" onClick={sharePoster} style={{
              marginTop: 14, width: "100%", background: C.goldGrad, color: C.bg,
              border: "none", borderRadius: 14, padding: "14px",
              fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
              boxShadow: C.goldGlow,
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}><Share2 size={16} />{t("shareImageAction")}</button>
            <button className="vai-press" onClick={() => setPoster(null)} style={{
              marginTop: 8, width: "100%", background: "transparent", color: C.mutedLight,
              border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px",
              fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            }}>‹ {t("back")}</button>
          </>
        ) : qrSvg ? (
          <>
            <div style={{ fontFamily: F.display, color: C.cream, fontSize: 21, fontWeight: 700, letterSpacing: -0.3, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
              <QrCode size={19} color={C.gold} />{t("shareQr")}
            </div>
            <div style={{ color: C.muted, fontSize: 13, marginBottom: 14 }}>{t("shareQrHint")}</div>
            <div style={{
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 20,
              padding: 22, display: "flex", justifyContent: "center", alignItems: "center",
            }} dangerouslySetInnerHTML={{ __html: qrSvg }} />
            <button className="vai-press" onClick={() => setQrSvg(null)} style={{
              marginTop: 14, width: "100%", background: "transparent", color: C.mutedLight,
              border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px",
              fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            }}>‹ {t("back")}</button>
          </>
        ) : (
          <>
            <div style={{ fontFamily: F.display, color: C.cream, fontSize: 21, fontWeight: 700, letterSpacing: -0.3, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <Share2 size={19} color={C.gold} />{t("shareTitle")}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {opts.map((o) => (
                <button className="vai-lift" key={o.id} onClick={o.action} disabled={o.busy} style={{
                  background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
                  padding: "20px", cursor: o.busy ? "wait" : "pointer", display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 8, opacity: o.busy ? 0.7 : 1,
                }}>
                  {o.busy ? <Loader size={26} color={C.gold} strokeWidth={1.8} style={{ animation: "vai-spin 1s linear infinite" }} />
                          : <o.Icon size={26} color={C.gold} strokeWidth={1.8} />}
                  <span style={{ color: C.cream, fontSize: 14, fontWeight: 600 }}>
                    {o.id === "link" && copied ? <><Check size={13} style={{ verticalAlign: -1.5, marginRight: 4 }} />{t("shareCopied")}</> : o.label}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
