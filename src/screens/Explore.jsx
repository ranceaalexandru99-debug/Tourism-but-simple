// Map exploration — pan and zoom the world, and the cities in view come out of
// Supabase as you go.
//
// This is the capability the database unlocked: the old bundled index could
// only be searched by name, so a user had to already know where they wanted to
// go. Here the map asks the question instead — "what's around here?" — and the
// answer is a bounding-box query, which a static JSON blob could never serve
// without shipping all 5000 rows to every device.

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { C, F } from "../theme.js";
import { useI18n } from "../i18n.js";
import { getCitiesInBounds } from "../destinations.js";
import PoiImage from "../components/PoiImage.jsx";
import { X, LocateFixed, ArrowRight, Loader } from "../icons.jsx";

// Remember where the user left off, so reopening Explore continues the same
// journey instead of snapping back to a default view of Europe.
const VIEW_KEY = "vai_explore_view";
const DEFAULT_VIEW = { center: [46.5, 14.0], zoom: 4 };

function loadView() {
  try {
    const v = JSON.parse(localStorage.getItem(VIEW_KEY));
    if (Array.isArray(v?.center) && v.center.length === 2 && typeof v.zoom === "number") return v;
  } catch { /* corrupt or absent — fall through */ }
  return DEFAULT_VIEW;
}

// Bigger dot for a more recognisable city, so the eye lands on Paris before it
// lands on the town next to it.
const DOT = { mega: 15, major: 12, notable: 9, hidden: 7 };

function markerHtml(city, selected) {
  const size = DOT[city.t] || 9;
  const ring = selected ? `border:3px solid ${C.cream};` : `border:2px solid ${C.bg};`;
  return `<div style="
    width:${size}px;height:${size}px;border-radius:50%;
    background:${selected ? C.cream : C.gold};${ring}
    box-shadow:0 2px 8px rgba(0,0,0,.55);
    transition:transform .12s ease;"></div>`;
}

export default function Explore({ onQuick, onClose }) {
  const { t, lang } = useI18n();
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  // Every fetch gets a number; only the newest one is allowed to paint. Panning
  // fires overlapping requests and they do not come back in order — without
  // this, a slow query for a viewport the user already left can overwrite the
  // markers for the one they are actually looking at.
  const seqRef = useRef(0);
  const debounceRef = useRef(null);

  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [locateError, setLocateError] = useState(false);
  // Latest zoom, so the hint about smaller towns only shows when zooming in
  // would actually reveal any.
  const [zoom, setZoom] = useState(loadView().zoom);

  const countryName = useMemo(() => {
    try {
      const dn = new Intl.DisplayNames([lang, "en"], { type: "region" });
      return (code) => (code ? dn.of(code) : null);
    } catch { return () => null; }
  }, [lang]);

  // ---- map lifecycle -------------------------------------------------------
  useEffect(() => {
    if (!elRef.current || mapRef.current) return;

    const view = loadView();
    const map = L.map(elRef.current, {
      zoomControl: false,
      attributionControl: false,
      worldCopyJump: true,   // panning past the antimeridian wraps cleanly
      minZoom: 2,
    }).setView(view.center, view.zoom);
    mapRef.current = map;

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
    }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);

    const run = () => {
      const b = map.getBounds();
      const z = map.getZoom();
      setZoom(z);
      try {
        localStorage.setItem(VIEW_KEY, JSON.stringify({
          center: [map.getCenter().lat, map.getCenter().lng], zoom: z,
        }));
      } catch { /* private mode — the map still works, it just won't be remembered */ }

      const mine = ++seqRef.current;
      setLoading(true);
      getCitiesInBounds({
        south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast(),
      }, { zoom: z }).then((rows) => {
        if (mine !== seqRef.current) return;  // a newer viewport won
        setCities(rows);
        setLoading(false);
      });
    };

    // Debounced: a drag emits one moveend, but a pinch-zoom emits several in
    // quick succession, and each one would otherwise be a round-trip.
    const schedule = () => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(run, 350);
    };
    map.on("moveend", schedule);

    run();
    setTimeout(() => map.invalidateSize(), 80);

    return () => {
      clearTimeout(debounceRef.current);
      seqRef.current++;          // discard any query still in flight
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // ---- markers -------------------------------------------------------------
  // Rebuilt whenever the result set or the selection changes. At most `limit`
  // (120) markers exist at a time, so a full clear-and-refill is cheaper than
  // diffing and keeps the selected-state styling trivially correct.
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();

    cities.forEach((city) => {
      const isSel = selected?.id === city.id;
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
      }).addTo(layer).on("click", () => setSelected(city));
    });
  }, [cities, selected]);

  // ---- locate --------------------------------------------------------------
  const locate = () => {
    if (!navigator.geolocation) { setLocateError(true); return; }
    setLocateError(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => mapRef.current?.setView([pos.coords.latitude, pos.coords.longitude], 8),
      () => setLocateError(true),
      { timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
  };

  const roundBtn = {
    width: 44, height: 44, borderRadius: 22, border: `1px solid ${C.border}`,
    background: C.surface, color: C.cream, display: "flex",
    alignItems: "center", justifyContent: "center", cursor: "pointer",
    boxShadow: C.shadowSoft,
  };

  return (
    <div style={{ position: "relative", height: "100dvh", width: "100%", overflow: "hidden", background: C.bg }}>
      <div ref={elRef} style={{ position: "absolute", inset: 0, filter: "saturate(0.9)" }} />

      {/* Top bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 500,
        padding: "calc(env(safe-area-inset-top, 0px) + 12px) 14px 12px",
        display: "flex", alignItems: "center", gap: 10,
        background: `linear-gradient(${C.bg}dd, ${C.bg}00)`,
        pointerEvents: "none",
      }}>
        <button className="vai-press" onClick={onClose} aria-label={t("back")}
          style={{ ...roundBtn, pointerEvents: "auto" }}>
          <X size={20} />
        </button>
        <div style={{ pointerEvents: "none" }}>
          <div style={{ fontFamily: F.display, fontSize: 20, color: C.cream, lineHeight: 1.1 }}>
            {t("exploreTitle")}
          </div>
          <div style={{ fontSize: 11, color: C.mutedLight, marginTop: 2 }}>
            {loading ? t("exploreHint") : `${cities.length} · ${t("exploreHint")}`}
          </div>
        </div>
        {loading && (
          <span style={{ marginLeft: "auto", color: C.gold, display: "flex", pointerEvents: "none" }}>
            <Loader size={18} style={{ animation: "vai-spin 1s linear infinite" }} />
          </span>
        )}
      </div>

      {/* Locate + zoom, out of the thumb's way of the bottom card */}
      <div style={{
        position: "absolute", right: 14, top: "45%", zIndex: 500,
        display: "flex", flexDirection: "column", gap: 8,
      }}>
        <button className="vai-press" onClick={locate} aria-label={t("exploreLocate")} style={roundBtn}>
          <LocateFixed size={19} color={C.gold} />
        </button>
        <button className="vai-press" onClick={() => mapRef.current?.zoomIn()} aria-label="+" style={{ ...roundBtn, fontSize: 22, fontWeight: 300 }}>+</button>
        <button className="vai-press" onClick={() => mapRef.current?.zoomOut()} aria-label="−" style={{ ...roundBtn, fontSize: 22, fontWeight: 300 }}>−</button>
      </div>

      {/* Status strip: only one of these is ever worth saying */}
      {!loading && cities.length === 0 && (
        <div style={{
          position: "absolute", left: 14, right: 14, bottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)",
          zIndex: 500, background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 14, padding: "12px 14px", color: C.mutedLight,
          fontSize: 13, textAlign: "center", boxShadow: C.shadow,
        }}>{t("exploreEmpty")}</div>
      )}
      {locateError && (
        <div style={{
          position: "absolute", left: 14, right: 14, top: "calc(env(safe-area-inset-top, 0px) + 76px)",
          zIndex: 500, background: C.surface, border: `1px solid ${C.red}55`,
          borderRadius: 12, padding: "10px 12px", color: C.red, fontSize: 12, textAlign: "center",
        }}>{t("exploreLocateFail")}</div>
      )}
      {!loading && cities.length > 0 && !selected && zoom < 9 && (
        <div style={{
          position: "absolute", left: 0, right: 0, bottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)",
          zIndex: 400, textAlign: "center", pointerEvents: "none",
        }}>
          <span style={{
            background: `${C.bg}cc`, color: C.mutedLight, fontSize: 11,
            padding: "6px 12px", borderRadius: 999, backdropFilter: "blur(6px)",
          }}>{t("exploreZoomHint")}</span>
        </div>
      )}

      {/* Selected city */}
      {selected && (
        <div style={{
          position: "absolute", left: 12, right: 12,
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)", zIndex: 600,
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20,
          boxShadow: C.shadow, padding: 12, display: "flex", gap: 12, alignItems: "center",
          animation: "vai-rise .22s ease both",
        }}>
          <PoiImage
            name={selected.n}
            img={selected.img}
            context={countryName(selected.c) || selected.c}
            width={76} height={76} radius={14} fontSize={40}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: F.display, fontSize: 19, color: C.cream,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>{selected.n}</div>
            <div style={{ fontSize: 12, color: C.mutedLight, marginTop: 2 }}>
              {countryName(selected.c) || selected.c}
            </div>
            <button
              className="vai-press"
              onClick={() => onQuick(selected.n)}
              style={{
                marginTop: 8, border: "none", borderRadius: 999, cursor: "pointer",
                background: C.goldGrad || C.gold, color: C.bg,
                fontWeight: 700, fontSize: 13, padding: "8px 14px",
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              {t("explorePlan")} <ArrowRight size={15} />
            </button>
          </div>
          <button
            className="vai-press"
            onClick={() => setSelected(null)}
            aria-label={t("back")}
            style={{
              alignSelf: "flex-start", background: "none", border: "none",
              color: C.muted, cursor: "pointer", padding: 4, display: "flex",
            }}
          ><X size={17} /></button>
        </div>
      )}
    </div>
  );
}
