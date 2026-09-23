// The explore map, as a page for a WebView.
//
// Same reasoning as memoryMapHtml.js: Leaflet in a WebView rather than
// react-native-maps means no Google Maps API key, no native module, and the
// same tiles and dark style the web map already uses.
//
// Unlike the photo map this one talks BOTH ways. The page owns the viewport —
// it is the thing being panned — and reports it; React Native owns the city
// index and sends back the dots to draw. Keeping the 5000-city list out of the
// WebView matters: shipping it across the bridge on every pan would be far more
// data than the at-most-120 markers that are actually visible.
//
// Messages out: {type:"view", bounds, zoom} on every settled move,
//               {type:"pick", id} when a dot is tapped,
//               {type:"ready"} once Leaflet is up.
// Messages in:  window.setCities(json) — an array of {id, ll, t, r}.

import { jsonForScript } from "./shortRenderHtml.js";

export const TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

// Bigger dot for a more recognisable city, so the eye lands on Paris before it
// lands on the town next to it.
export const DOT = { mega: 15, major: 12, notable: 9, hidden: 7 };

export const DEFAULT_VIEW = { center: [46.5, 14.0], zoom: 4 };

/**
 * @param {{center:[number,number], zoom:number}} view  where to open
 * @param {{gold:string, cream:string, bg:string}} colors
 */
export function buildExploreMapHtml(view, colors) {
  // The stored view comes off the device and can be anything — half-written,
  // or left by an older version. `[45]` passes an Array.isArray check and then
  // opens the map on a grey nothing, so the length is part of the test.
  const ok = view
    && Array.isArray(view.center) && view.center.length === 2
    && view.center.every((n) => typeof n === "number" && Number.isFinite(n))
    && typeof view.zoom === "number" && Number.isFinite(view.zoom);
  const start = ok ? { center: view.center, zoom: view.zoom } : DEFAULT_VIEW;
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  html,body,#m{margin:0;padding:0;height:100%;width:100%;background:${colors.bg}}
  .leaflet-container{background:${colors.bg}}
  .dot{border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.55)}
</style>
</head><body><div id="m"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
const START = ${jsonForScript(start)};
const DOT = ${jsonForScript(DOT)};
const GOLD = ${jsonForScript(colors.gold)};
const CREAM = ${jsonForScript(colors.cream)};
const BG = ${jsonForScript(colors.bg)};
const send = (msg) => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg));

try {
  const map = L.map("m", {
    zoomControl: false, attributionControl: false,
    worldCopyJump: true,   // panning past the antimeridian wraps cleanly
    minZoom: 2,
  }).setView(START.center, START.zoom);
  L.tileLayer(${JSON.stringify(TILE_URL)}, { maxZoom: 19 }).addTo(map);

  const layer = L.layerGroup().addTo(map);
  let selected = null;

  function markerHtml(city, isSel) {
    const size = DOT[city.t] || 9;
    // String concatenation, not innerHTML of city fields: nothing from the city
    // record is interpolated into markup here beyond its tier, which is one of
    // four known words.
    return '<div class="dot" style="width:' + size + 'px;height:' + size + 'px;'
      + 'background:' + (isSel ? CREAM : GOLD) + ';'
      + 'border:' + (isSel ? '3px solid ' + CREAM : '2px solid ' + BG) + ';"></div>';
  }

  // Called from React Native with the cities for the current viewport. A full
  // clear-and-refill: at most 120 markers exist at a time, so it is cheaper
  // than diffing and keeps the selected styling trivially correct.
  window.setCities = function (list) {
    layer.clearLayers();
    for (const city of list || []) {
      if (!city || !Array.isArray(city.ll)) continue;
      const isSel = selected === city.id;
      const size = DOT[city.t] || 9;
      L.marker(city.ll, {
        icon: L.divIcon({
          className: "",
          html: markerHtml(city, isSel),
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        }),
        // Selected pin draws above its neighbours instead of behind them.
        zIndexOffset: isSel ? 1000 : Math.round((city.r || 0) / 10),
        keyboard: false,
      }).addTo(layer).on("click", function () {
        selected = city.id;
        send({ type: "pick", id: city.id });
      });
    }
  };

  window.clearSelection = function () { selected = null; };
  window.zoomBy = function (d) { map.setZoom(map.getZoom() + d); };

  function report() {
    const b = map.getBounds();
    send({
      type: "view",
      bounds: { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() },
      center: [map.getCenter().lat, map.getCenter().lng],
      zoom: map.getZoom(),
    });
  }

  // Debounced: a drag emits one moveend, but a pinch-zoom emits several in
  // quick succession, and each one would otherwise be a round-trip.
  let timer = null;
  map.on("moveend", function () {
    clearTimeout(timer);
    timer = setTimeout(report, 350);
  });

  report();
  send({ type: "ready" });
} catch (e) {
  send({ type: "error", reason: String((e && e.message) || e) });
}
</script></body></html>`;
}
