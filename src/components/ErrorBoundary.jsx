import { Component } from "react";
import { C } from "../theme.js";
import { Compass, RefreshCw } from "../icons.jsx";
import { report } from "../monitor.js";

// Catches any render/lifecycle error in the tree below it and shows a friendly
// recovery screen instead of a blank white page. Must be a class component —
// React has no hook equivalent for error boundaries. Kept dependency-light
// (no i18n context, which might itself be the thing that crashed): it reads the
// language directly from localStorage and uses the theme palette `C`, which is
// populated at module load.
const TXT = {
  en: {
    title: "Something went wrong",
    body: "The app hit an unexpected error. Reloading usually fixes it — your saved trips and photos are safe.",
    reload: "Reload app",
    stuckTitle: "That didn't help",
    stuckBody: "The error came back after reloading, so something stored on this device is causing it. Clearing the temporary data usually fixes that. Your saved trips and photos are kept.",
    reset: "Clear temporary data",
    lastBody: "Still failing. As a last resort you can erase everything this app has stored — including your saved trips. This cannot be undone.",
    erase: "Erase everything and restart",
  },
  ro: {
    title: "Ceva n-a mers bine",
    body: "Aplicația a întâmpinat o eroare neașteptată. De obicei reîncărcarea rezolvă — traseele și pozele salvate sunt în siguranță.",
    reload: "Reîncarcă aplicația",
    stuckTitle: "Nu a ajutat",
    stuckBody: "Eroarea a revenit după reîncărcare, deci o cauzează ceva salvat pe acest dispozitiv. De obicei se rezolvă ștergând datele temporare. Traseele și pozele salvate rămân.",
    reset: "Șterge datele temporare",
    lastBody: "Tot nu merge. În ultimă instanță poți șterge tot ce a salvat aplicația — inclusiv traseele tale. Operațiunea nu poate fi anulată.",
    erase: "Șterge tot și repornește",
  },
};

// How many times the app has crashed in a row. A plain reload cannot fix a
// crash caused by PERSISTED state — a corrupt saved trip, a malformed #tripz=
// share link, a bad cached payload — because the reload restores exactly the
// same data. Without an escalating way out, "Reload app" is a button that can
// never work, and the app is bricked on that device.
const CRASH_KEY = "vai_crash_streak";

function readStreak() {
  try {
    const { n, t } = JSON.parse(localStorage.getItem(CRASH_KEY)) || {};
    // Only consecutive crashes count. A crash an hour after the last one is a
    // new problem, not a loop.
    if (!n || !t || Date.now() - t > 60000) return 0;
    return n;
  } catch { return 0; }
}
function bumpStreak(n) {
  try { localStorage.setItem(CRASH_KEY, JSON.stringify({ n, t: Date.now() })); } catch {}
}
export function clearCrashStreak() {
  try { localStorage.removeItem(CRASH_KEY); } catch {}
}

// Everything the app writes that is safe to throw away: caches only, never the
// saved trips or the photo gallery.
//
// The crash counter is deliberately absent. Clearing it here would reset the
// streak to zero, the next crash would show step one again, and the escalation
// could never reach the last resort. Only a successful start clears it.
const DISPOSABLE = [
  "vai_ai_dest_", "vai_photo", "vai_dest_q_", "vai_osm_city_",
  "vai_pois_", "vai_errors", "vai_collab2_",
];

function wipe(predicate) {
  try {
    const doomed = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && predicate(key)) doomed.push(key);
    }
    for (const key of doomed) { try { localStorage.removeItem(key); } catch {} }
  } catch {}
}

// A shared trip in the URL is itself a common cause: the hash survives reloads,
// so a malformed one crashes the app every single time it is opened.
function restart() {
  try { window.location.hash = ""; } catch {}
  window.location.reload();
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, streak: 0 };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("[Turism] Uncaught error:", error, info?.componentStack);
    // Forwarded to the (opt-in) error endpoint — a no-op unless configured.
    report("react", error?.message, error?.stack || info?.componentStack);
    const streak = readStreak() + 1;
    bumpStreak(streak);
    this.setState({ streak });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    let lang = "en";
    try { lang = localStorage.getItem("vai_lang") || "en"; } catch {}
    const T = TXT[lang] || TXT.en;
    const { streak } = this.state;

    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: C.bgDeep || "#060e1c", padding: 24,
      }}>
        <div style={{
          width: "min(360px, 100%)", background: C.card || "#162840",
          border: `1px solid ${C.border || "#1E3350"}`, borderRadius: 22,
          padding: "32px 26px", textAlign: "center",
          boxShadow: "0 30px 80px #000a",
        }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
            <Compass size={52} color={C.gold || "#C9A84C"} strokeWidth={1.5} />
          </div>
          <div style={{
            color: C.cream || "#F0EBE0", fontSize: 22, fontWeight: 800,
            marginBottom: 10, letterSpacing: -0.3,
          }}>{streak >= 2 ? T.stuckTitle : T.title}</div>
          <div style={{ color: C.mutedLight || "#9DB0C5", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            {streak >= 3 ? T.lastBody : streak >= 2 ? T.stuckBody : T.body}
          </div>
          <button
            onClick={() => {
              // Each repeat crash widens what gets thrown away, because a plain
              // reload restores the very state that caused the crash.
              if (streak >= 3) {
                wipe(() => true);              // everything, trips included
                try { indexedDB.deleteDatabase("vai_gallery"); } catch {}
              } else if (streak >= 2) {
                wipe((k) => DISPOSABLE.some((p) => k.startsWith(p)));
              }
              // Step one clears nothing on purpose — the streak has to survive
              // the reload for a second failure to be recognised as a loop.
              restart();
            }}
            style={{
              width: "100%", border: "none", borderRadius: 14, padding: "15px 18px",
              fontSize: 16, fontWeight: 700, cursor: "pointer",
              background: streak >= 3 ? (C.red || "#E05C5C") : (C.gold || "#C9A84C"),
              color: streak >= 3 ? "#fff" : (C.bg || "#0A1628"),
              fontFamily: "inherit",
            }}
          ><RefreshCw size={15} style={{ verticalAlign: -2, marginRight: 7 }} />
            {streak >= 3 ? T.erase : streak >= 2 ? T.reset : T.reload}</button>
        </div>
      </div>
    );
  }
}
