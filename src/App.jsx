import { useState, useRef, useEffect, Suspense } from "react";
import { C, F, useTheme } from "./theme.js";
import { Phone } from "./components/ui.jsx";
import { generateRoute } from "./mockEngine.js";
import { generateRouteSmart } from "./aiEngine.js";
import { useI18n } from "./i18n.js";
import { useOnline } from "./useOnline.js";
import { decodeSharedRouteFromHash } from "./shareCodec.js";
import Hint, { hasSeenHint } from "./components/Hint.jsx";
import { persist } from "./shared/persist.js";
import lazyWithRetry, { clearChunkReloadGuard } from "./lazyWithRetry.js";
import { clearCrashStreak } from "./components/ErrorBoundary.jsx";

const SAVED_KEY = "vai_saved_routes";
const RECENT_KEY = "vai_recent_searches";
const LAST_KEY = "vai_last_opened";
const loadSaved = () => {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY)) || []; } catch { return []; }
};
const loadRecent = () => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; }
};
const loadLastOpenedId = () => {
  try { return localStorage.getItem(LAST_KEY) || null; } catch { return null; }
};

// If the URL hash carries a shared trip, decode + validate it (shareCodec) and
// use it as the initial route so the app boots straight into the itinerary.
function decodeSharedRoute() {
  return decodeSharedRouteFromHash(window.location.hash);
}

import Splash from "./screens/Splash.jsx";
import Welcome from "./screens/Welcome.jsx";
import Auth from "./screens/Auth.jsx";
import Home from "./screens/Home.jsx";
import Trips from "./screens/Trips.jsx";
import Me from "./screens/Me.jsx";
import Input from "./screens/Input.jsx";
import Preferences from "./screens/Preferences.jsx";
import Loading from "./screens/Loading.jsx";
// Route and Gallery pull the heavy map library (leaflet); load them on demand
// so the initial bundle stays small and the app starts faster on mobile.
const Route = lazyWithRetry(() => import("./screens/Route.jsx"));
const Gallery = lazyWithRetry(() => import("./screens/Gallery.jsx"));
// Lazy for the same reason as Route: it pulls in Leaflet, which no one needs
// until they actually open a map.
const Explore = lazyWithRetry(() => import("./screens/Explore.jsx"));
import BottomNav from "./components/BottomNav.jsx";
import ConsentBanner from "./components/ConsentBanner.jsx";
import { currentUser, clearSession, deleteAccount } from "./auth.js";
import { WifiOff, TriangleAlert } from "./icons.jsx";

export default function App() {
  useTheme(); // subscribe so the tree re-renders when theme/accent changes
  const { t } = useI18n();
  const online = useOnline();
  const shared = useRef(decodeSharedRoute()).current;
  // Restore a previously signed-in account so returning users skip onboarding.
  const restored = useRef(shared ? null : currentUser()).current;
  const [screen, setScreen] = useState(shared ? "route" : "splash");
  const [user, setUser] = useState(
    shared ? { name: null, guest: true, method: "share" } : restored
  );
  const [saved, setSaved] = useState(loadSaved);
  const [recent, setRecent] = useState(loadRecent);
  const [lastOpenedId, setLastOpenedId] = useState(loadLastOpenedId);
  const [query, setQuery] = useState(shared?.destName || "");
  const [hints, setHints] = useState(null);
  const [prefs, setPrefs] = useState(shared ? {
    destination: shared.destName, days: shared.days, interests: shared.interests || [],
    pace: shared.pace || "balanced", startDate: shared.startDate,
  } : null);
  const [route, setRoute] = useState(shared || null);
  const [consent, setConsent] = useState(() => {
    try { return localStorage.getItem("vai_consent") === "1"; } catch { return true; }
  });
  const acceptConsent = () => {
    try { localStorage.setItem("vai_consent", "1"); } catch {}
    setConsent(true);
  };

  // Rendering at all means the app started cleanly, so whatever went wrong
  // before was not a loop. Both guards are cleared only here: the recovery
  // screen leaves the crash counter alone so a repeat failure can escalate
  // instead of offering the same useless "Reload" forever, and the chunk guard
  // resets so a later deploy in this same long-lived tab still gets its one
  // reload.
  useEffect(() => {
    clearCrashStreak();
    clearChunkReloadGuard();
  }, []);

  // Persist saved routes / recent searches / last opened across reloads.
  //
  // Trips go through persist(), which sacrifices disposable caches rather than
  // the trip when the quota is full. The old `try { setItem } catch {}` failed
  // silently: the app said "Saved!", the user closed it, and the trip was gone —
  // evicted in effect by a photo cache that costs one request to rebuild.
  const [saveFailed, setSaveFailed] = useState(false);
  useEffect(() => {
    setSaveFailed(!persist(SAVED_KEY, JSON.stringify(saved)));
  }, [saved]);
  useEffect(() => {
    persist(RECENT_KEY, JSON.stringify(recent));
  }, [recent]);
  useEffect(() => {
    try {
      if (lastOpenedId) localStorage.setItem(LAST_KEY, lastOpenedId);
      else localStorage.removeItem(LAST_KEY);
    } catch {}
  }, [lastOpenedId]);

  const go = (s) => setScreen(s);

  // Auth screen hands back a full user object (real account or a guest).
  const handleAuth = (u) => {
    setUser(u);
    go("home");
  };

  const logout = () => {
    clearSession();
    setUser(null);
    go("auth");
  };

  // Remove the account itself. Trips and photos stay on the device — the Me
  // screen offers "erase all data" separately for a full wipe.
  const removeAccount = () => {
    deleteAccount(user?.email);
    setUser(null);
    go("auth");
  };

  const startSearch = (initial = "") => { setQuery(initial); go("input"); };

  const submitQuery = (q, h) => {
    setQuery(q); setHints(h || null); go("preferences");
    // Track destinations (before comma) as recent searches — dedupe, keep last 5.
    const dest = q.split(",")[0].trim();
    if (dest) setRecent((prev) => [dest, ...prev.filter((x) => x.toLowerCase() !== dest.toLowerCase())].slice(0, 5));
  };

  // Show the loading screen, run generation in parallel, and leave for the
  // route exactly when it's ready — with a minimum on-screen time so the
  // animation doesn't flash by. The loading screen holds its last step
  // "active" until we navigate, so it never looks finished-but-stuck.
  // `genToken` lets the user cancel a slow AI generation: bumping it makes any
  // in-flight run a no-op when it eventually resolves.
  const genToken = useRef(0);
  const generate = async (p) => {
    const my = ++genToken.current;
    setPrefs(p);
    go("loading");
    const t0 = Date.now();
    let r;
    try { r = await generateRouteSmart(p); } catch { /* fall through to mock */ }
    if (genToken.current !== my) return; // canceled while waiting on the AI
    if (!r) r = generateRoute(p);
    const MIN_MS = 2600;
    const wait = MIN_MS - (Date.now() - t0);
    if (wait > 0) await new Promise((res) => setTimeout(res, wait));
    if (genToken.current !== my) return;
    setRoute(r);
    // Resolve "flex" (or any clamped value) to the actual day count so later
    // refine/tier edits work with a real number.
    setPrefs((prev) => (prev && prev.days !== r.days ? { ...prev, days: r.days } : prev));
    go("route");
  };
  // Back to preferences (selections intact) — the late AI result is discarded.
  const cancelGenerate = () => { genToken.current++; go("preferences"); };

  const openSaved = (r) => {
    setRoute(r);
    setPrefs({ destination: r.destName, days: r.days, interests: r.interests, pace: r.pace, startDate: r.startDate });
    setLastOpenedId(r.id);
    go("route");
  };

  // First-time hint pointing at the Trips tab — dismisses forever after tap.
  const [savedHint, setSavedHint] = useState(false);
  const saveRoute = (r) => {
    setSaved((prev) => {
      if (prev.find((x) => x.id === r.id)) return prev;
      // First save in this device's lifetime — close the "where did it go?"
      // cognitive loop by pointing at the Trips tab.
      if (prev.length === 0 && !hasSeenHint("post-save")) setSavedHint(true);
      return [r, ...prev];
    });
  };

  const deleteRoute = (id) => {
    setSaved((prev) => prev.filter((r) => r.id !== id));
    // If we just removed the "continue where you left off" trip, forget it too.
    setLastOpenedId((cur) => (cur === id ? null : cur));
  };

  return (
    <Phone>
      {!online && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, zIndex: 60,
          background: C.red, color: "#fff", fontSize: 12, fontWeight: 700,
          textAlign: "center", padding: "5px 8px",
        }}><WifiOff size={12} style={{ verticalAlign: -1.5, marginRight: 5 }} />{t("offlineBanner")}</div>
      )}
      {/* Storage full, and even discarding every cache did not free enough.
          Saying so is the whole point: the previous silence let someone believe
          a trip was saved when it was not. */}
      {saveFailed && (
        <div style={{
          position: "absolute", top: online ? 0 : 24, left: 0, right: 0, zIndex: 60,
          background: C.red, color: "#fff", fontSize: 12, fontWeight: 700,
          textAlign: "center", padding: "5px 8px",
        }}><TriangleAlert size={12} style={{ verticalAlign: -1.5, marginRight: 5 }} />{t("storageFull")}</div>
      )}
      <Suspense fallback={
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", border: `3px solid ${C.border}`, borderTopColor: C.gold, animation: "vai-spin .8s linear infinite" }} />
        </div>
      }>
      {screen === "splash" && <Splash onDone={() => go(user ? "home" : "welcome")} />}
      {screen === "welcome" && <Welcome onDone={() => go("auth")} />}
      {screen === "auth" && <Auth onAuth={handleAuth} />}
      {screen === "home" && (
        <Home
          user={user}
          saved={saved}
          recent={recent}
          lastOpenedId={lastOpenedId}
          onSearch={() => startSearch("")}
          onQuick={(q) => startSearch(q)}
          onOpenSaved={openSaved}
          onExplore={() => go("explore")}
        />
      )}
      {screen === "explore" && (
        <Explore onQuick={(q) => startSearch(q)} onClose={() => go("home")} />
      )}
      {screen === "trips" && <Trips saved={saved} onOpen={openSaved} onDelete={deleteRoute} onRestore={saveRoute} />}
      {screen === "gallery" && <Gallery saved={saved} />}
      {screen === "me" && <Me user={user} saved={saved} onLogout={logout} onDeleteAccount={removeAccount} />}
      {["home", "trips", "gallery", "me"].includes(screen) && (
        <BottomNav active={screen} onGo={go} badge={saved.length} />
      )}
      {screen === "input" && (
        <Input initial={query} initialHints={hints} onBack={() => go("home")} onSubmit={submitQuery} />
      )}
      {screen === "preferences" && (
        <Preferences destination={query} hints={hints} onBack={() => go("input")} onGenerate={generate} />
      )}
      {screen === "loading" && (
        <Loading destName={query.split(/[ ,]/)[0]} onCancel={cancelGenerate} />
      )}
      {screen === "route" && route && (
        <Route
          route={route}
          prefs={prefs}
          user={user}
          onBack={() => go("home")}
          onUpdate={(r, p) => {
            setRoute(r);
            if (p) setPrefs(p);
            // If this trip is already saved, keep the stored copy in sync so
            // edits (reorder, notes, ratings…) survive leaving the screen.
            // Strip the transient AI-engine flags before persisting.
            setSaved((prev) => {
              if (!prev.some((s) => s.id === r.id)) return prev;
              const { _ai, _aiFailed, ...clean } = r;
              return prev.map((s) => (s.id === r.id ? clean : s));
            });
          }}
          onSaved={saveRoute}
        />
      )}
      </Suspense>
      {/* First-save coach mark: positioned above the Trips tab (2nd of 4).
          Only shown right after the first save, then dismissed forever. */}
      {savedHint && (
        <Hint
          id="post-save"
          arrow="bottom"
          onClose={() => setSavedHint(false)}
          okLabel={t("hintOk")}
          style={{ left: "25%", transform: "translateX(-50%)", bottom: 82 }}
        >
          <div style={{ fontFamily: F.display, fontSize: 15, marginBottom: 2 }}>
            {t("hintSavedTitle")}
          </div>
          {t("hintSavedBody")}
        </Hint>
      )}
      {!consent && <ConsentBanner onAccept={acceptConsent} />}
    </Phone>
  );
}
