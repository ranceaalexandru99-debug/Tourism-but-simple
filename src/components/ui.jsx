import { useEffect, useState } from "react";
import { C } from "../theme.js";
import { Signal, BatteryFull } from "../icons.jsx";

export function Btn({ children, onClick, variant = "primary", color = C.gold, style, disabled }) {
  const base = {
    border: "none", borderRadius: 16, padding: "15px 18px", fontSize: 16,
    fontWeight: 700, cursor: disabled ? "default" : "pointer", width: "100%",
    opacity: disabled ? 0.5 : 1, fontFamily: "inherit", letterSpacing: 0.2,
  };
  const isAccent = color === C.gold;
  const variants = {
    primary: {
      background: isAccent ? C.goldGrad : color, color: C.bg,
      boxShadow: disabled ? "none" : isAccent ? C.goldGlow : `0 10px 28px ${color}44`,
    },
    ghost: { background: "transparent", color: color, border: `1.5px solid ${color}55` },
    social: { background: C.card, color: C.cream, border: `1px solid ${C.border}`, boxShadow: C.shadowSoft },
    soft: { background: `${color}1c`, color, border: `1px solid ${color}40` },
  };
  return (
    <button
      className="vai-press"
      onClick={disabled ? undefined : onClick}
      style={{ ...base, ...variants[variant], ...style }}
    >
      {children}
    </button>
  );
}

export function Label({ children, color = C.muted }) {
  return (
    <div style={{ color, fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", margin: "2px 0" }}>
      {children}
    </div>
  );
}

// The phone shell everything renders inside.
export function Phone({ children, dark }) {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: `radial-gradient(1200px 600px at 50% -10%, ${C.surface}, ${C.bgDeep} 60%)`,
      padding: 0, overflow: "hidden", position: "relative",
    }}>
      {/* ambient color drift behind the phone (visible on desktop) */}
      <div style={{
        position: "absolute", width: 520, height: 520, borderRadius: "50%",
        background: `radial-gradient(circle, ${C.gold}14, transparent 65%)`,
        top: "-8%", left: "8%", animation: "vai-drift 16s ease-in-out infinite", pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", width: 460, height: 460, borderRadius: "50%",
        background: `radial-gradient(circle, ${C.blue}12, transparent 65%)`,
        bottom: "-12%", right: "4%", animation: "vai-drift 20s ease-in-out infinite reverse", pointerEvents: "none",
      }} />
      <div className="vai-frame" style={{
        // Height lives in index.html CSS (.vai-frame): min(932px, 100dvh) with
        // a 100vh fallback. Inline styles can't express the fallback, and on
        // mobile Chrome plain 100vh includes the area hidden behind the URL
        // bar — the bottom ~80px of the layout (refine FAB, toasts) was
        // getting clipped off-screen.
        width: "min(430px, 100vw)",
        background: dark || C.bg, position: "relative", overflow: "hidden",
        display: "flex", flexDirection: "column",
        boxShadow: `0 0 0 1px ${C.border}aa, 0 40px 120px #000a`,
        // 0 on phone-sized viewports, rounded "device" frame on anything larger
        borderRadius: "clamp(0px, (100vw - 431px) * 999, 44px)",
        // Touch drags scroll vertically only; horizontal carousels (which set
        // touch-action: pan-x on themselves) and the map still work. Kills the
        // sideways page-pan/rubber-band on phones.
        touchAction: "pan-y", overscrollBehavior: "none",
      }}>
        {children}
      </div>
    </div>
  );
}

// Real wall-clock time (HH:MM, 24h), refreshed each minute. The old mockup
// froze "9:41" on screen — on an actual phone that reads as a broken clock
// right under the device's real one.
function useClock() {
  const fmt = () => {
    const d = new Date();
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  const [now, setNow] = useState(fmt);
  useEffect(() => {
    const tick = () => setNow(fmt());
    // Align the first update to the next minute boundary, then every 60s.
    const first = setTimeout(() => { tick(); const iv = setInterval(tick, 60000); cleanup.iv = iv; }, (60 - new Date().getSeconds()) * 1000);
    const cleanup = { iv: null };
    return () => { clearTimeout(first); if (cleanup.iv) clearInterval(cleanup.iv); };
  }, []);
  return now;
}

export function StatusBar({ color = C.cream }) {
  const now = useClock();
  return (
    <div style={{
      height: 44, flexShrink: 0, display: "flex", alignItems: "center",
      justifyContent: "space-between", padding: "0 24px", color,
      fontSize: 13, fontWeight: 600,
    }}>
      <span>{now}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Signal size={14} /><BatteryFull size={16} />
      </span>
    </div>
  );
}
