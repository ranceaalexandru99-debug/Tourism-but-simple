// Map exploration, ported from src/screens/Explore.jsx.
//
// The map asks the question instead of the user: rather than having to know
// where you want to go and type it, you pan the world and the cities in view
// come to you.
//
// One real difference from the web. There the cities come out of Supabase, and
// a query can fail — hence its "can't reach the city list" state. Here the
// 5000-city index is inside the bundle, so the lookup is a filter over memory:
// instant, offline, and with no failure mode beyond "there is nothing here".
// The map TILES still need a network, which is a visible enough failure on its
// own; drawing a message over a blank map would only obscure the gold dots
// that did load.
//
// There is no "my location" button either. expo-location is not installed, and
// adding it would mean a location permission in the manifest and a new answer
// on the Play Data Safety form — a real cost for a convenience the map already
// gives you by panning.

import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { C, themedStyles } from "../lib/theme.js";
import { useI18n } from "../lib/i18n.js";
import { FONT } from "../fonts.js";
import { getCitiesInBounds } from "../lib/destinations.js";
import { countryName } from "../lib/countryNames.js";
import { buildExploreMapHtml, DEFAULT_VIEW } from "../lib/exploreMapHtml.js";
import PoiImage from "../components/PoiImage.js";
import { X, ArrowRight } from "../icons.js";

// Remember where the user left off, so reopening Explore continues the same
// journey instead of snapping back to a default view of Europe.
const VIEW_KEY = "vai_explore_view";

function loadView() {
  try {
    const v = JSON.parse(localStorage.getItem(VIEW_KEY));
    if (Array.isArray(v?.center) && v.center.length === 2 && typeof v.zoom === "number") return v;
  } catch { /* corrupt or absent — fall through */ }
  return DEFAULT_VIEW;
}

// Only what the page actually draws crosses the bridge. The full record carries
// a photo filename, a population and a country that the map has no use for, and
// this runs on every pan.
const forMap = (c) => ({ id: c.id, ll: c.ll, t: c.t, r: c.r });

export default function Explore({ onQuick, onClose }) {
  const { t, lang } = useI18n();
  const webRef = useRef(null);
  // Every lookup gets a number; only the newest one is allowed to paint.
  // Panning fires overlapping lookups and they need not settle in order —
  // without this, a stale viewport can overwrite the one being looked at.
  const seqRef = useRef(0);

  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [zoom, setZoom] = useState(loadView().zoom);
  const [html] = useState(() => buildExploreMapHtml(loadView(), {
    gold: C.gold, cream: C.cream, bg: C.bg,
  }));

  // Run a script inside the page. Everything it is handed is JSON we built.
  const post = useCallback((js) => { webRef.current?.injectJavaScript(js + ";true;"); }, []);

  useEffect(() => () => { seqRef.current++; }, []); // discard anything in flight

  const onView = useCallback(async ({ bounds, center, zoom: z }) => {
    setZoom(z);
    try {
      localStorage.setItem(VIEW_KEY, JSON.stringify({ center, zoom: z }));
    } catch { /* storage full — the map still works, it just won't be remembered */ }

    const mine = ++seqRef.current;
    setLoading(true);
    try {
      const rows = await getCitiesInBounds(bounds, { zoom: z });
      if (mine !== seqRef.current) return;  // a newer viewport won
      setCities(rows);
      post(`window.setCities(${JSON.stringify(rows.map(forMap))})`);
    } catch {
      if (mine !== seqRef.current) return;
      setCities([]);
      post("window.setCities([])");
    } finally {
      if (mine === seqRef.current) setLoading(false);
    }
  }, [post]);

  const onMessage = useCallback((e) => {
    // Everything arriving here is untrusted input, even though the page is
    // ours: it is a string from a WebView, and a malformed one must do nothing
    // rather than throw inside a handler.
    let msg;
    try { msg = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (!msg || typeof msg !== "object") return;

    if (msg.type === "view") {
      const b = msg.bounds;
      if (!b || typeof msg.zoom !== "number") return;
      onView({ bounds: b, center: msg.center, zoom: msg.zoom });
      return;
    }
    if (msg.type === "pick") {
      const hit = cities.find((c) => c.id === msg.id);
      if (hit) setSelected(hit);
    }
  }, [cities, onView]);

  const closeCard = () => {
    setSelected(null);
    post("window.clearSelection()");
  };

  return (
    <View style={styles.wrap}>
      <WebView
        ref={webRef}
        source={{ html }}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled={false}
        allowFileAccess={false}
        onMessage={onMessage}
        style={{ flex: 1, backgroundColor: C.bg }}
      />

      {/* Top bar */}
      <View style={styles.topBar} pointerEvents="box-none">
        <Pressable onPress={onClose} accessibilityLabel={t("back")} style={styles.roundBtn}>
          <X size={20} color={C.cream} />
        </Pressable>
        <View pointerEvents="none">
          <Text style={styles.title}>{t("exploreTitle")}</Text>
          <Text style={styles.sub}>
            {loading ? t("exploreHint") : `${cities.length} · ${t("exploreHint")}`}
          </Text>
        </View>
        {loading && <ActivityIndicator color={C.gold} style={{ marginLeft: "auto" }} />}
      </View>

      {/* Zoom, out of the thumb's way of the bottom card */}
      <View style={styles.zoomCol}>
        <Pressable onPress={() => post("window.zoomBy(1)")} accessibilityLabel="+" style={styles.roundBtn}>
          <Text style={styles.zoomTxt}>+</Text>
        </Pressable>
        <Pressable onPress={() => post("window.zoomBy(-1)")} accessibilityLabel="−" style={styles.roundBtn}>
          <Text style={styles.zoomTxt}>−</Text>
        </Pressable>
      </View>

      {/* Only one of these is ever worth saying */}
      {!loading && cities.length === 0 && (
        <View style={styles.strip}>
          <Text style={styles.stripTxt}>{t("exploreEmpty")}</Text>
        </View>
      )}
      {!loading && cities.length > 0 && !selected && zoom < 9 && (
        <View style={styles.hintWrap} pointerEvents="none">
          <Text style={styles.hint}>{t("exploreZoomHint")}</Text>
        </View>
      )}

      {/* Selected city */}
      {selected && (
        <View style={styles.card}>
          {/* contain: this thumbnail is the only look at the city someone gets
              before deciding to plan a trip there, and a cityscape cropped to a
              square loses the sides — which is usually where the skyline is. */}
          <PoiImage
            name={selected.n}
            context={countryName(selected.c, lang) || selected.c}
            width={104} height={78} radius={14} fit="contain"
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.cityName} numberOfLines={1}>{selected.n}</Text>
            <Text style={styles.sub}>{countryName(selected.c, lang) || selected.c}</Text>
            <Pressable onPress={() => onQuick(selected.n)} style={styles.planBtn}>
              <Text style={styles.planTxt}>{t("explorePlan")}</Text>
              <ArrowRight size={15} color={C.bg} />
            </Pressable>
          </View>
          <Pressable onPress={closeCard} accessibilityLabel={t("back")} hitSlop={10} style={{ alignSelf: "flex-start" }}>
            <X size={17} color={C.muted} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  topBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12,
    flexDirection: "row", alignItems: "center", gap: 10,
  },
  roundBtn: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.surface, alignItems: "center", justifyContent: "center",
  },
  zoomCol: { position: "absolute", right: 14, top: "45%", gap: 8 },
  zoomTxt: { color: C.cream, fontSize: 22, fontFamily: FONT.body, lineHeight: 26 },
  title: { fontFamily: FONT.display, fontSize: 20, color: C.cream },
  sub: { fontSize: 11, color: C.mutedLight, marginTop: 2, fontFamily: FONT.body },

  strip: {
    position: "absolute", left: 14, right: 14, bottom: 20,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
  },
  stripTxt: { color: C.mutedLight, fontSize: 13, textAlign: "center", fontFamily: FONT.body },
  hintWrap: { position: "absolute", left: 0, right: 0, bottom: 20, alignItems: "center" },
  hint: {
    backgroundColor: C.bg + "cc", color: C.mutedLight, fontSize: 11,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, fontFamily: FONT.body,
  },

  card: {
    position: "absolute", left: 12, right: 12, bottom: 16,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 20, padding: 12, flexDirection: "row", gap: 12, alignItems: "center",
  },
  cityName: { fontFamily: FONT.display, fontSize: 19, color: C.cream },
  planBtn: {
    marginTop: 8, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: C.gold, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8,
  },
  planTxt: { color: C.bg, fontFamily: FONT.bold, fontSize: 13 },
}));
