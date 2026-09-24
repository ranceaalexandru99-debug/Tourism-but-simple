import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";

import { hydrate } from "./src/polyfill.js";
import { installMonitor } from "./src/lib/monitor.js";
import { initPremium } from "./src/lib/premium.js";
import { FONT_MAP, FONT } from "./src/fonts.js";
import { ThemeProvider, useTheme, C } from "./src/lib/theme.js";
import { I18nProvider, useI18n } from "./src/lib/i18n.js";
import { generateRoute } from "./src/lib/mockEngine.js";
import ErrorBoundary from "./src/components/ErrorBoundary.js";
import { persist } from "./src/shared/persist.js";

// Global crash visibility from the first moment of boot.
installMonitor();

import Splash from "./src/screens/Splash.js";
import Welcome from "./src/screens/Welcome.js";
import Auth from "./src/screens/Auth.js";
import Home from "./src/screens/Home.js";
import Trips from "./src/screens/Trips.js";
import Me from "./src/screens/Me.js";
import Input from "./src/screens/Input.js";
import Preferences from "./src/screens/Preferences.js";
import Loading from "./src/screens/Loading.js";
import Route from "./src/screens/Route.js";
import Gallery from "./src/screens/Gallery.js";
import Explore from "./src/screens/Explore.js";
import BottomNav from "./src/components/BottomNav.js";
import ConsentBanner from "./src/components/ConsentBanner.js";
import { currentUser, clearSession } from "./src/lib/auth.js";
import { TriangleAlert } from "./src/icons.js";

const SAVED_KEY = "vai_saved_routes";
const LAST_KEY = "vai_last_opened";
const loadSaved = () => { try { return JSON.parse(localStorage.getItem(SAVED_KEY)) || []; } catch { return []; } };

const TABS = ["home", "trips", "gallery", "me"];

function Root() {
  const { mode } = useTheme();
  const { t } = useI18n();
  const restored = currentUser(); // restore a prior session (localStorage hydrated by now)
  const [screen, setScreen] = useState("splash");
  const [user, setUser] = useState(restored);
  const [consent, setConsent] = useState(() => {
    try { return localStorage.getItem("vai_consent") === "1"; } catch { return true; }
  });
  const acceptConsent = () => { try { localStorage.setItem("vai_consent", "1"); } catch {} setConsent(true); };
  const [saved, setSaved] = useState(loadSaved);
  const [query, setQuery] = useState("");
  const [prefs, setPrefs] = useState(null);
  const [route, setRoute] = useState(null);
  const [lastOpenedId, setLastOpenedId] = useState(() => { try { return localStorage.getItem(LAST_KEY); } catch { return null; } });

  // Trips go through persist(), which discards disposable caches rather than
  // the user's trip, and reports whether the write actually landed. It was a
  // bare try/catch here: storage fills with cached photos (photos.js writes
  // base64 into it), the write failed, the app still showed the trip as saved,
  // and it was gone on the next launch with nothing ever having said so. The
  // web app was fixed for exactly this; the fix had never crossed over.
  const [saveFailed, setSaveFailed] = useState(false);
  useEffect(() => { setSaveFailed(!persist(SAVED_KEY, JSON.stringify(saved))); }, [saved]);

  const go = (s) => setScreen(s);

  const handleAuth = (u) => { setUser(u); go("home"); };
  const logout = () => { clearSession(); setUser(null); go("auth"); };

  // Erase everything stored on the device: all app storage (trips, account,
  // session, theme, consent, photo metadata) then reset to a fresh start.
  const eraseAll = () => {
    try { localStorage.clear(); } catch {}
    setUser(null); setSaved([]); setRoute(null); setPrefs(null);
    setLastOpenedId(null); setConsent(false);
    go("welcome");
  };

  // Show the loading screen, build the route, and leave once it's ready — with a
  // minimum on-screen time so the animation doesn't just flash by.
  const generate = async (p) => {
    setPrefs(p);
    go("loading");
    const t0 = Date.now();
    const r = generateRoute(p);
    const wait = 2600 - (Date.now() - t0);
    if (wait > 0) await new Promise((res) => setTimeout(res, wait));
    setRoute(r);
    go("route");
  };
  const openSaved = (r) => {
    setRoute(r);
    setLastOpenedId(r.id);
    try { localStorage.setItem(LAST_KEY, r.id); } catch {}
    go("route");
  };
  const saveRoute = (r) => setSaved((prev) => (prev.find((x) => x.id === r.id) ? prev : [r, ...prev]));
  const deleteRoute = (id) => {
    setSaved((prev) => prev.filter((r) => r.id !== id));
    setLastOpenedId((cur) => (cur === id ? null : cur));
  };

  const showTabs = TABS.includes(screen);
  // Full-bleed screens (cover art / centered logos) go edge-to-edge; content
  // screens are inset away from the system UI.
  const fullBleed = screen === "route" || screen === "splash" || screen === "loading" || screen === "explore";
  // Real insets on both platforms. This used to be React Native's own
  // SafeAreaView plus a hand-rolled Android status-bar offset — but that
  // SafeAreaView is iOS-only (a no-op on Android), and nothing accounted for
  // the BOTTOM at all. Under Android 15's mandatory edge-to-edge that put the
  // tab bar underneath the gesture pill, where it can't be tapped.
  const insets = useSafeAreaInsets();
  const pad = fullBleed
    ? { paddingTop: 0, paddingBottom: 0 }
    : { paddingTop: insets.top, paddingBottom: insets.bottom };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Dark glyphs on the porcelain light theme, light ones on dark. The old
          check compared C.bg to "#F4F1EA", a colour in neither palette, so it
          was always false — white status icons on a white bar for every user
          on the default theme. */}
      <StatusBar style={mode === "light" ? "dark" : "light"} />
      {/* Storage full, and even discarding every cache did not free enough.
          Saying so is the whole point: the silence let someone believe a trip
          was saved when it was not. */}
      {saveFailed && (
        <View style={{ backgroundColor: C.red, paddingVertical: 5, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 }}>
          <TriangleAlert size={12} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 12, fontFamily: FONT.bold, textAlign: "center" }}>{t("storageFull")}</Text>
        </View>
      )}
      <View style={{ flex: 1, ...pad }}>
        {screen === "splash" && <Splash onDone={() => go(user ? "home" : "welcome")} />}
        {screen === "welcome" && <Welcome onDone={() => go("auth")} />}
        {screen === "auth" && <Auth onAuth={handleAuth} />}
        {screen === "home" && (
          <Home
            user={user}
            saved={saved}
            onSearch={() => { setQuery(""); go("input"); }}
            onQuick={(q) => { setQuery(q); go("input"); }}
            onOpenSaved={openSaved}
            onExplore={() => go("explore")}
          />
        )}
        {screen === "explore" && (
          <Explore onQuick={(q) => { setQuery(q); go("input"); }} onClose={() => go("home")} />
        )}
        {screen === "trips" && <Trips saved={saved} onOpen={openSaved} onDelete={deleteRoute} onRestore={saveRoute} />}
        {screen === "gallery" && <Gallery saved={saved} />}
        {screen === "me" && <Me user={user} saved={saved} onLogout={logout} onErase={eraseAll} />}
        {screen === "input" && (
          <Input initial={query} onBack={() => go("home")} onSubmit={(q) => { setQuery(q); go("preferences"); }} />
        )}
        {screen === "preferences" && (
          <Preferences destination={query} onBack={() => go("input")} onGenerate={generate} />
        )}
        {screen === "loading" && (
          <Loading destName={(query || "").split(/[ ,]/)[0]} />
        )}
        {screen === "route" && route && (
          <Route route={route} onBack={() => go("home")} onSaved={saveRoute} />
        )}
        {showTabs && <BottomNav active={screen} onGo={go} badge={saved.length} />}
      </View>
      {!consent && <ConsentBanner onAccept={acceptConsent} />}
    </View>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [fontsLoaded] = useFonts(FONT_MAP);

  useEffect(() => { hydrate().finally(() => { initPremium(); setReady(true); }); }, []);

  if (!ready || !fontsLoaded) {
    // Porcelain + antique gold to match the default (light) theme — the real
    // persisted theme isn't known until the storage polyfill hydrates.
    return (
      <View style={{ flex: 1, backgroundColor: "#FBFAF7", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#A9862F" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      {/* Must sit above anything calling useSafeAreaInsets(). */}
      <SafeAreaProvider>
        <ThemeProvider>
          <I18nProvider>
            <Root />
          </I18nProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
