import { useState, useEffect , useRef } from "react";
import { useEscape, useFocusTrap } from "../useEscape.js";
import { C, F } from "../theme.js";
import { Btn } from "./ui.jsx";
import { useI18n, tripTitle } from "../i18n.js";
import { computeTripStats } from "../utils.js";
import { listMemories } from "../gallery.js";
import PoiImage from "./PoiImage.jsx";
import { PartyPopper, CircleCheck, Footprints, Camera, Share2, CategoryIcon } from "../icons.jsx";

// A celebratory end-of-trip recap: cover, headline stats, and a collage of the
// photos the user snapped along the way (gallery memories linked to this trip).
export default function RecapSheet({ route, onClose, onShare }) {
  const sheetRef = useRef(null);
  useEscape(onClose);
  useFocusTrap(sheetRef);
  const { t } = useI18n();
  const [photos, setPhotos] = useState(null); // null = loading
  const stats = computeTripStats(route);

  useEffect(() => {
    let on = true;
    listMemories()
      .then((all) => { if (on) setPhotos(all.filter((m) => m.tripId === route.id)); })
      .catch(() => { if (on) setPhotos([]); });
    return () => { on = false; };
  }, [route.id]);

  const cats = stats ? Object.entries(stats.categories).sort((a, b) => b[1] - a[1]).slice(0, 4) : [];

  const statCards = stats ? [
    { Icon: CircleCheck, label: t("statsVisited"), value: `${stats.visitedCount}/${stats.totalCount}` },
    { Icon: Footprints, label: t("statsWalked"), value: stats.kmWalked > 0 ? `${stats.kmWalked.toFixed(1)} km` : "—" },
    { Icon: Camera, label: t("recapPhotos"), value: photos ? String(photos.length) : "…" },
  ] : [];

  return (
    <div onClick={onClose} style={{
      position: "absolute", inset: 0, background: "#000c", zIndex: 46,
      display: "flex", alignItems: "flex-end", animation: "vai-pop .2s both",
    }}>
      <div ref={sheetRef} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{
        width: "100%", background: C.surface, borderRadius: "26px 26px 0 0",
        maxHeight: "92%", overflowY: "auto", animation: "vai-rise .25s both",
      }}>
        {/* Cover */}
        <div style={{ position: "relative", height: 150 }}>
          <PoiImage name={route.destName} emoji={route.emoji} tags={route.interests} credit height={150} radius={0} fontSize={70} style={{ width: "100%" }} />
          {/* Was a wash starting at 40%, which bleached most of a 150px photo
              to make the content below legible. The content has a solid
              background of its own now, so this only blends the edge. */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: `linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0) 24%), linear-gradient(180deg, ${C.surface}00 80%, ${C.surface} 100%)`,
          }} />
          <div style={{ position: "absolute", left: "50%", top: 14, transform: "translateX(-50%)", width: 40, height: 5, background: "#fff8", borderRadius: 3 }} />
        </div>

        <div style={{ padding: "10px 22px 26px", background: C.surface, position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", justifyContent: "center" }}><PartyPopper size={28} color={C.gold} /></div>
          <div style={{ fontFamily: F.display, color: C.cream, fontSize: 24, fontWeight: 700, letterSpacing: -0.4, textAlign: "center", marginBottom: 2 }}>
            {t("recapTitle")}
          </div>
          <div style={{ color: C.gold, fontFamily: F.display, fontSize: 17, fontStyle: "italic", textAlign: "center", marginBottom: 18 }}>
            {tripTitle(route, t)}
          </div>

          {/* Stat cards */}
          <div style={{ display: "flex", gap: 8, marginBottom: cats.length ? 14 : 18 }}>
            {statCards.map((s) => (
              <div key={s.label} style={{
                flex: 1, background: C.card, borderRadius: 14, padding: "12px 10px",
                border: `1px solid ${C.border}`, textAlign: "center",
              }}>
                <div style={{ display: "flex", justifyContent: "center" }}><s.Icon size={17} color={C.gold} /></div>
                <div style={{ fontFamily: F.display, color: C.cream, fontSize: 19, fontWeight: 700, marginTop: 4, letterSpacing: -0.3 }}>{s.value}</div>
                <div style={{ color: C.muted, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {cats.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18, justifyContent: "center" }}>
              {cats.map(([cat, n]) => (
                <span key={cat} style={{ background: `${C.gold}18`, color: C.gold, borderRadius: 999, padding: "5px 12px", fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <CategoryIcon tags={cat} size={12} />{t("int" + cat) || cat} · {n}
                </span>
              ))}
            </div>
          )}

          {/* Photo collage */}
          <div style={{ color: C.muted, fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <Camera size={13} />{t("recapPhotos")}
          </div>
          {photos && photos.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 18 }}>
              {photos.map((m) => (
                <div key={m.id} style={{ position: "relative", aspectRatio: "1 / 1", borderRadius: 10, overflow: "hidden", background: C.card }}>
                  {/* Same as the gallery grid: the whole photo over a blurred
                      copy of itself, rather than a square crop of it. */}
                  <div aria-hidden="true" style={{
                    position: "absolute", inset: 0,
                    backgroundImage: `url(${m.dataUrl})`, backgroundSize: "cover", backgroundPosition: "center",
                    filter: "blur(10px) saturate(1.15)", transform: "scale(1.3)",
                  }} />
                  <img src={m.dataUrl} alt="" loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              background: C.card, border: `1px dashed ${C.border}`, borderRadius: 14,
              padding: "20px", textAlign: "center", color: C.muted, fontSize: 13, marginBottom: 18,
            }}>{t("recapNoPhotos")}</div>
          )}

          <Btn onClick={onShare}><Share2 size={16} style={{ verticalAlign: -2.5, marginRight: 8 }} />{t("recapShare")}</Btn>
        </div>
      </div>
    </div>
  );
}
