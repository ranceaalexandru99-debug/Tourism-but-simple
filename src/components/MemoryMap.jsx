import { useEffect, useRef } from "react";
import L from "leaflet";
import { C } from "../theme.js";

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
          html: `<div style="
            width:44px;height:44px;border-radius:50%;overflow:hidden;
            border:2px solid ${C.gold};box-shadow:0 4px 12px #000a;background:${C.card}">
            <img src="${m.dataUrl}" style="width:100%;height:100%;object-fit:cover" />
          </div>`,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
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
