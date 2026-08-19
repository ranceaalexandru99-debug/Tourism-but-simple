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
  },
  ro: {
    title: "Ceva n-a mers bine",
    body: "Aplicația a întâmpinat o eroare neașteptată. De obicei reîncărcarea rezolvă — traseele și pozele salvate sunt în siguranță.",
    reload: "Reîncarcă aplicația",
  },
};

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("[Turism] Uncaught error:", error, info?.componentStack);
    // Forwarded to the (opt-in) error endpoint — a no-op unless configured.
    report("react", error?.message, error?.stack || info?.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    let lang = "en";
    try { lang = localStorage.getItem("vai_lang") || "en"; } catch {}
    const T = TXT[lang] || TXT.en;

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
          }}>{T.title}</div>
          <div style={{ color: C.mutedLight || "#9DB0C5", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            {T.body}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              width: "100%", border: "none", borderRadius: 14, padding: "15px 18px",
              fontSize: 16, fontWeight: 700, cursor: "pointer",
              background: C.gold || "#C9A84C", color: C.bg || "#0A1628",
              fontFamily: "inherit",
            }}
          ><RefreshCw size={15} style={{ verticalAlign: -2, marginRight: 7 }} />{T.reload}</button>
        </div>
      </div>
    );
  }
}
