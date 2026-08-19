import { useEffect, useRef } from "react";
import L from "leaflet";
import { C } from "../theme.js";

// Renders all stops across all days as numbered pins, connected by a line.
// `days` is route.itinerary. Day boundaries get a slightly different hue.
export default function RouteMap({ days, center, onPick }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  // Keeps the latest handler reachable from markers without making it an
  // effect dependency (see the note on the effect's dep array below).
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    if (!elRef.current || mapRef.current) return;

    const map = L.map(elRef.current, {
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false,
    });
    mapRef.current = map;

    // Dark Carto basemap — fits the app's palette.
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
    }).addTo(map);

    const all = [];
    let n = 0;
    const path = [];

    days.forEach((day) => {
      day.stops.forEach((stop) => {
        if (!stop.ll) return; // skip user-added stops without coordinates
        n += 1;
        path.push(stop.ll);
        const marker = L.marker(stop.ll, {
          icon: L.divIcon({
            className: "",
            html: `<div style="
              width:30px;height:30px;border-radius:50% 50% 50% 0;
              transform:rotate(-45deg);
              background:${C.gold};border:2px solid ${C.bg};
              box-shadow:0 4px 10px #0008;
              display:flex;align-items:center;justify-content:center;">
              <span style="transform:rotate(45deg);color:${C.bg};font-weight:800;font-size:13px;font-family:sans-serif">${n}</span>
            </div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 30],
          }),
        }).addTo(map);
        marker.on("click", () => onPickRef.current && onPickRef.current(stop));
        all.push(stop.ll);
      });
    });

    if (path.length > 1) {
      L.polyline(path, { color: C.gold, weight: 3, opacity: 0.7, dashArray: "1 8", lineCap: "round" }).addTo(map);
    }

    if (all.length > 0) {
      map.fitBounds(L.latLngBounds(all).pad(0.25));
    } else if (center) {
      map.setView(center, 13);
    }

    setTimeout(() => map.invalidateSize(), 100);

    return () => { map.remove(); mapRef.current = null; };
    // `onPick` is deliberately NOT a dependency: callers pass an inline arrow,
    // so a new identity every render would tear the Leaflet instance down and
    // rebuild it — the parent re-renders once a minute (clock tick), which
    // snapped the user's pan/zoom back and re-flashed the tiles. Markers read
    // the handler through onPickRef, so it never goes stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, center]);

  return (
    <div
      ref={elRef}
      style={{
        width: "100%", height: "100%", borderRadius: 0,
        background: C.bg, filter: "saturate(0.9)",
      }}
    />
  );
}
