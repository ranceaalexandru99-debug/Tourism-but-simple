import { useState, useRef } from "react";
import { useEscape, useFocusTrap } from "../useEscape.js";
import { C, F } from "../theme.js";
import { Btn } from "./ui.jsx";
import { useI18n, tripTitle } from "../i18n.js";
import { addMemory, resizeImage } from "../gallery.js";
import PoiImage from "./PoiImage.jsx";
import RatingStars from "./RatingStars.jsx";
import {
  Clock, Ticket, Hourglass, TriangleAlert, Search, Lightbulb, NotebookPen,
  Map, Navigation, Camera, Check, Loader, X
} from "../icons.jsx";

export default function StopDetail({ stop, prevStop, onClose, onToggleDone, onRate, onNote, destName, country, route }) {
  const sheetRef = useRef(null);
  useEscape(onClose);
  useFocusTrap(sheetRef);
  const { t } = useI18n();
  const fileRef = useRef(null);
  const [photoState, setPhotoState] = useState("idle"); // idle | saving | saved
  // Personal note: edited locally, committed on blur so we don't churn the
  // whole route on every keystroke.
  const [note, setNote] = useState(stop.note || "");
  const commitNote = () => { if ((note || "") !== (stop.note || "")) onNote(note.trim()); };

  // Capture a photo for THIS attraction and store it as a gallery memory,
  // pre-linked to the trip and stop (and its coordinates, for the map).
  const onPickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoState("saving");
    try {
      const dataUrl = await resizeImage(file);
      await addMemory({
        id: `m${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
        ts: Date.now(), dataUrl, caption: stop.name,
        tripId: route?.id || null,
        tripTitle: route ? tripTitle(route, t) : null,
        stopName: stop.name,
        ll: stop.ll || null,
      });
      setPhotoState("saved");
    } catch {
      setPhotoState("idle");
    }
  };
  // Use exact coordinates when we have them (avoids Maps resolving the name to
  // a wrong same-named place near the user). Otherwise search name + city + country.
  const openMaps = () => {
    // Pure coordinates resolve to an exact pin (a parenthetical label breaks
    // Maps search for names with & or diacritics). Fall back to name + city.
    const q = stop.ll
      ? `${stop.ll[0]},${stop.ll[1]}`
      : [stop.name, destName, country].filter(Boolean).join(", ");
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`, "_blank");
  };
  // Directions from the previous stop to this one — the most useful nav call
  // while walking the itinerary. Only offered when both endpoints have coords.
  const canRouteFromPrev = prevStop && prevStop.ll && stop.ll;
  const openDirectionsFromPrev = () => {
    if (!canRouteFromPrev) return;
    const origin = `${prevStop.ll[0]},${prevStop.ll[1]}`;
    const destination = `${stop.ll[0]},${stop.ll[1]}`;
    window.open(
      `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`,
      "_blank",
    );
  };
  return (
    <div onClick={onClose} style={{
      position: "absolute", inset: 0, background: "#000a", zIndex: 30,
      display: "flex", alignItems: "flex-end", animation: "vai-pop .2s both",
    }}>
      <div ref={sheetRef} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{
        width: "100%", background: C.surface, borderRadius: "26px 26px 0 0",
        padding: "10px 22px 28px", maxHeight: "85%", overflowY: "auto",
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
        {/* contain: this is the one place someone actually looks at the
            attraction, and a 2:1 band cropped out of a tall photo of a tower
            keeps the middle of the tower and nothing else. */}
        <PoiImage name={stop.name} wiki={stop.wiki} img={stop.img} category={stop.category} context={destName} credit emoji={stop.emoji} tags={stop.tags} height={190} radius={18} fontSize={64} fit="contain" style={{ marginBottom: 16 }} />

        <div style={{ fontFamily: F.display, color: C.cream, fontSize: 26, fontWeight: 700, letterSpacing: -0.4 }}>{stop.name}</div>
        <div style={{ color: C.gold, fontSize: 14, marginTop: 4, marginBottom: 16, display: "flex", alignItems: "center", gap: 5 }}>
          <Clock size={14} />{stop.time} · {t("durationLabel", { x: stop.durLabel })}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
          {[
            // "~" for hours too: nightlife is barely mapped for opening times,
            // so a bar or club often shows a typical range rather than its own.
            { Icon: Clock, txt: `${stop.hoursEstimated ? "~" : ""}${stop.hours}`, warn: stop.unverified },
            // "~€12" when the price is a per-category estimate (OSM has no
            // price for this place) — never present a guess as a fact.
            { Icon: Ticket, txt: stop.cost > 0 ? `${stop.costEstimated ? "~" : ""}€${stop.cost}` : t("free"), warn: stop.unverified },
            { Icon: Hourglass, txt: `${stop.durLabel} ${t("recommended")}`, warn: false },
          ].map((c) => (
            <span key={c.txt} title={c.warn ? t("toReconfirm") : undefined} style={{
              background: c.warn ? `${C.red}1c` : `${C.gold}1c`, color: c.warn ? C.red : C.gold,
              borderRadius: 8, padding: "7px 11px", fontSize: 13, fontWeight: 600,
              display: "inline-flex", alignItems: "center", gap: 6,
            }}>{c.warn ? <TriangleAlert size={13} /> : <c.Icon size={13} />}{c.txt}</span>
          ))}
        </div>

        {stop.unverified && (
          <div style={{
            background: `${C.red}12`, border: `1px solid ${C.red}40`, borderRadius: 14,
            padding: "12px 14px", marginBottom: 16, display: "flex", flexDirection: "column", gap: 10,
          }}>
            <div style={{ color: C.red, fontSize: 13, lineHeight: 1.5 }}>
              <TriangleAlert size={13} style={{ verticalAlign: -2, marginRight: 5 }} />{t("verifyNote")}
            </div>
            <button onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(`${stop.name} ${destName || ""} opening hours price`)}`, "_blank")} style={{
              alignSelf: "flex-start", background: "transparent", border: `1px solid ${C.red}66`, color: C.red,
              borderRadius: 999, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}><Search size={13} />{t("verifyOnline")}</button>
          </div>
        )}

        {/* Only when there's something to say — OSM stops often have no tip,
            and an empty gold-accented card just looks broken. */}
        {stop.tip && (
          <div style={{
            background: C.card, borderRadius: 14, padding: "14px 16px", marginBottom: 18,
            borderLeft: `3px solid ${C.gold}`,
          }}>
            <div style={{ color: C.gold, fontSize: 12, fontWeight: 800, marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}>
              <Lightbulb size={13} />{t("localTip")}
            </div>
            <div style={{ color: C.cream, fontSize: 15, lineHeight: 1.5 }}>{stop.tip}</div>
          </div>
        )}

        {/* Personal notes — bookings, reminders, anything the traveler wants */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ color: C.mutedLight, fontSize: 12, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
            <NotebookPen size={13} />{t("notesLabel")}
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={commitNote}
            placeholder={t("notesPh")}
            rows={2}
            style={{
              width: "100%", background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
              padding: "12px 14px", color: C.cream, fontSize: 14, fontFamily: "inherit",
              outline: "none", resize: "vertical", lineHeight: 1.5,
            }}
          />
        </div>

        <Btn onClick={openMaps}>
          <Map size={16} style={{ verticalAlign: -2.5, marginRight: 8 }} />{t("openMaps")}
        </Btn>
        {canRouteFromPrev && (
          <Btn variant="soft" color={C.blue} onClick={openDirectionsFromPrev} style={{ marginTop: 10 }}>
            <Navigation size={15} style={{ verticalAlign: -2, marginRight: 8 }} />{t("directionsFromPrev", { name: prevStop.name })}
          </Btn>
        )}

        {/* Snap a memory for this attraction, pre-linked to the trip + stop */}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPickPhoto} style={{ display: "none" }} />
        <Btn
          variant="soft"
          color={photoState === "saved" ? C.green : C.gold}
          onClick={() => photoState !== "saving" && fileRef.current?.click()}
          style={{ marginTop: 10 }}
        >
          {photoState === "saving" ? <><Loader size={15} style={{ verticalAlign: -2, marginRight: 7, animation: "vai-spin 1s linear infinite" }} />…</>
            : photoState === "saved" ? <><Check size={15} style={{ verticalAlign: -2, marginRight: 7 }} />{t("galPhotoSaved")}</>
            : <><Camera size={15} style={{ verticalAlign: -2, marginRight: 7 }} />{t("galAddPhoto")}</>}
        </Btn>

        <Btn variant="ghost" color={stop.done ? C.green : C.muted} onClick={onToggleDone} style={{ marginTop: 10 }}>
          {stop.done ? <><Check size={15} style={{ verticalAlign: -2, marginRight: 7 }} />{t("visited")}</> : t("markVisited")}
        </Btn>
        {stop.done && onRate && (
          <RatingStars value={stop.rating || 0} onChange={onRate} />
        )}
      </div>
    </div>
  );
}
