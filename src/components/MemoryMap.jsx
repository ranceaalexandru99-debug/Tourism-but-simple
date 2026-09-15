import { useEffect, useRef } from "react";
import L from "leaflet";
import { C } from "../theme.js";

// Leaflet's divIcon takes raw HTML, which puts this file outside React's
// escaping. Anything interpolated into an attribute goes through here.
const escAttr = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

// Renders gallery memories that have coordinates as photo-thumbnail pins on a
// dark map. Tapping a pin opens a popup with the photo + caption.
export default function MemoryMap({ memories, onPick }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const withGeo = memories.filter((m) => Array.isArray(m.ll) && m.ll.length === 2);

    const map = L.map(elRef.current, {
      zoomControl: false, attributionControl: false, scrollWheelZoom: false,
    });
    mapRef.current = map;

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(map);

    const pts = [];
    withGeo.forEach((m) => {
      pts.push(m.ll);
      const marker = L.marker(m.ll, {
        icon: L.divIcon({
          className: "",
          // A circle cannot letterbox, so the photo used to be centre-cropped
          // into it — and a portrait shot lost its top and bottom entirely,
          // which on a 44px pin is most of the subject. Same answer as the
          // gallery grid: a blurred copy fills the circle, the photo sits whole
          // on top of it. Slightly larger too, because a contained photo needs
          // the room to stay recognisable.
          // The photo is a canvas-produced data URL today, so it cannot carry a
          // quote — but this is a raw HTML string handed to Leaflet, and that
          // guarantee lives three modules away. Escaping it here means the
          // safety is local to the code that needs it.
          html: `<div style="
            position:relative;width:52px;height:52px;border-radius:50%;overflow:hidden;
            border:2px solid ${C.gold};box-shadow:0 4px 12px #000a;background:${C.card}">
            <img src="${escAttr(m.dataUrl)}" aria-hidden="true" style="
              position:absolute;inset:0;width:100%;height:100%;object-fit:cover;
              filter:blur(6px) saturate(1.15);transform:scale(1.3)" />
            <img src="${escAttr(m.dataUrl)}" style="
              position:absolute;inset:0;width:100%;height:100%;object-fit:contain" />
          </div>`,
          iconSize: [52, 52],
          iconAnchor: [26, 26],
        }),
      }).addTo(map);
      if (onPick) marker.on("click", () => onPick(m));
    });

    if (pts.length > 1) map.fitBounds(L.latLngBounds(pts).pad(0.3));
    else if (pts.length === 1) map.setView(pts[0], 14);
    else map.setView([48.85, 2.35], 3);

    setTimeout(() => map.invalidateSize(), 100);
    return () => { map.remove(); mapRef.current = null; };
  }, [memories, onPick]);

  return <div ref={elRef} style={{ width: "100%", height: "100%", background: C.bg, filter: "saturate(0.9)" }} />;
}
