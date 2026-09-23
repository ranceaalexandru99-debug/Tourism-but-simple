// The photo map, as a page for a WebView.
//
// react-native-maps would mean a Google Maps API key for Android, a native
// module, and a second map style to keep in step with the web one. A WebView
// with Leaflet needs none of that: it is the same library, the same tiles and
// the same dark style the web app already uses, so a photo pin looks identical
// on both.
//
// Leaflet is loaded from a CDN. A map is useless without a network anyway —
// the tiles come from one — so this adds no offline limitation that was not
// already there. The caller shows a plain message when there is nothing to
// plot, and never mounts this.

import { jsonForScript } from "./shortRenderHtml.js";

export const TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

/**
 * @param {Array<{id:string, ll:[number,number], dataUrl:string}>} pins
 *        Photos with coordinates, already inlined as small data URLs — a
 *        WebView cannot read the app's own file:// paths, and should not be
 *        given the access to try.
 * @param {{gold:string, card:string, bg:string}} colors
 */
export function buildMemoryMapHtml(pins, colors) {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  html,body,#m{margin:0;padding:0;height:100%;width:100%;background:${colors.bg}}
  .leaflet-container{background:${colors.bg}}
  .pin{width:52px;height:52px;border-radius:50%;overflow:hidden;position:relative;
       border:2px solid ${colors.gold};box-shadow:0 4px 12px #000a;background:${colors.card}}
  .pin img{position:absolute;inset:0;width:100%;height:100%}
  .pin .bg{object-fit:cover;filter:blur(6px) saturate(1.15);transform:scale(1.3)}
  .pin .fg{object-fit:contain}
</style>
</head><body><div id="m"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
const PINS = ${jsonForScript(pins)};
const send = (msg) => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg));

try {
  const map = L.map("m", { zoomControl: false, attributionControl: false });
  L.tileLayer(${JSON.stringify(TILE_URL)}, { maxZoom: 19 }).addTo(map);

  const pts = [];
  for (const p of PINS) {
    pts.push(p.ll);
    // Same treatment as the gallery grid: the whole photo over a blurred copy
    // of itself, so a portrait shot does not lose its top and bottom.
    const marker = L.marker(p.ll, {
      icon: L.divIcon({
        className: "",
        html: '<div class="pin"><img class="bg" src="' + p.dataUrl + '"/><img class="fg" src="' + p.dataUrl + '"/></div>',
        iconSize: [52, 52], iconAnchor: [26, 26],
      }),
    }).addTo(map);
    marker.on("click", () => send({ type: "pick", id: p.id }));
  }

  if (pts.length > 1) map.fitBounds(L.latLngBounds(pts).pad(0.3));
  else if (pts.length === 1) map.setView(pts[0], 14);
  else map.setView([48.85, 2.35], 3);

  send({ type: "ready", pins: PINS.length });
} catch (e) {
  send({ type: "error", reason: String((e && e.message) || e) });
}
</script></body></html>`;
}
