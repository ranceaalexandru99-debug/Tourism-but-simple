// Minimal production-error visibility, with privacy as the default.
//
// OFF unless VITE_ERROR_ENDPOINT is set at build time. When enabled, uncaught
// errors and unhandled promise rejections are POSTed (sendBeacon, best-effort)
// as small JSON payloads: message, stack, url, user-agent, timestamp. No IDs,
// no cookies, nothing user-typed. If you enable this for a public deployment,
// disclose it in the Privacy Policy (see legal/PRIVACY.md §4).
//
// Rate-limited so an error loop can't spam the endpoint from one session.

const ENDPOINT = import.meta.env.VITE_ERROR_ENDPOINT || "";
const MAX_REPORTS = 10;
const LS_KEY = "vai_errors";
const BUFFER_MAX = 20;
let sent = 0;

// Small localStorage ring buffer so errors are inspectable in DevTools even
// when no endpoint is configured. Call `window.__vaiErrors()` to read them.
function bufferPush(entry) {
  try {
    const list = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
    list.push(entry);
    localStorage.setItem(LS_KEY, JSON.stringify(list.slice(-BUFFER_MAX)));
  } catch { /* quota / privacy mode — best-effort */ }
}

export function report(kind, message, stack) {
  const entry = {
    kind,
    message: String(message || "").slice(0, 500),
    stack: String(stack || "").slice(0, 2000),
    url: location.pathname, // no hash — shared-trip hashes contain trip data
    ua: navigator.userAgent,
    ts: new Date().toISOString(),
    v: import.meta.env.VITE_APP_VERSION || "dev",
  };
  bufferPush(entry);
  if (!ENDPOINT || sent >= MAX_REPORTS) return;
  sent++;
  const payload = JSON.stringify(entry);
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: "application/json" }));
    } else {
      fetch(ENDPOINT, { method: "POST", body: payload, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
    }
  } catch { /* never let reporting itself throw */ }
}

// Install the global hooks once at boot. Safe to call when disabled — it
// simply never sends anything.
export function installMonitor() {
  window.addEventListener("error", (e) => report("error", e.message, e.error?.stack));
  window.addEventListener("unhandledrejection", (e) =>
    report("unhandledrejection", e.reason?.message || String(e.reason), e.reason?.stack));
  window.__vaiErrors = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; } };
  window.__vaiErrorsClear = () => { try { localStorage.removeItem(LS_KEY); } catch {} };
}
