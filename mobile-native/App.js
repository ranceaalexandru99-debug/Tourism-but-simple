import { useEffect, useState } from "react";
import { View, SafeAreaView, ActivityIndicator, Platform, StatusBar as RNStatusBar } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";

import { hydrate } from "./src/polyfill.js";
import { installMonitor } from "./src/lib/monitor.js";
import { FONT_MAP } from "./src/fonts.js";
import { ThemeProvider, useTheme, C } from "./src/lib/theme.js";
import { I18nProvider } from "./src/lib/i18n.js";
import { generateRoute } from "./src/lib/mockEngine.js";
import ErrorBoundary from "./src/components/ErrorBoundary.js";

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
import BottomNav from "./src/components/BottomNav.js";
import ConsentBanner from "./src/components/ConsentBanner.js";
import { currentUser, clearSession } from "./src/lib/auth.js";

const SAVED_KEY = "vai_saved_routes";
const LAST_KEY = "vai_last_opened";
const loadSaved = () => { try { return JSON.parse(localStorage.getItem(SAVED_KEY)) || []; } catch { return []; } };

const TABS = ["home", "trips", "gallery", "me"];

function Root() {
  const { mode } = useTheme();
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

  useEffect(() => { try { localStorage.setItem(SAVED_KEY, JSON.stringify(saved)); } catch {} }, [saved]);

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
  // screens use SafeAreaView (iOS notch) + an Android status-bar inset.
  const fullBleed = screen === "route" || screen === "splash" || screen === "loading";
  const Container = fullBleed ? View : SafeAreaView;
  const androidInset = !fullBleed && Platform.OS === "android" ? RNStatusBar.currentHeight || 0 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Dark glyphs on the porcelain light theme, light ones on dark. The old
          check compared C.bg to "#F4F1EA", a colour in neither palette, so it
          was always false — white status icons on a white bar for every user
          on the default theme. */}
      <StatusBar style={mode === "light" ? "dark" : "light"} />
      <Container style={{ flex: 1, paddingTop: androidInset }}>
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
          />
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
      </Container>
      {!consent && <ConsentBanner onAccept={acceptConsent} />}
    </View>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [fontsLoaded] = useFonts(FONT_MAP);

  useEffect(() => { hydrate().finally(() => setReady(true)); }, []);

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
      <ThemeProvider>
        <I18nProvider>
          <Root />
        </I18nProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
