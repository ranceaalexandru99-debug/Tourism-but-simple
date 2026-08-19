import { useEffect, useState } from "react";
import { C, F } from "../theme.js";
import { useI18n } from "../i18n.js";
import { Map, Check } from "../icons.jsx";

const STEP_KEYS = ["step1", "step2", "step3", "step4"];

export default function Loading({ destName, onCancel }) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [slow, setSlow] = useState(false);

  // Advance through the steps but stop at the last one, which stays "active"
  // (pulsing) until App navigates away once the route is actually ready — so
  // the screen never shows "all done" while still waiting. If the AI takes
  // longer than ~8s, surface a cancel escape hatch so nobody is ever trapped
  // staring at a spinner on a bad connection.
  useEffect(() => {
    const timers = STEP_KEYS.slice(0, -1).map((_, i) => setTimeout(() => setStep(i + 1), 650 * (i + 1)));
    const slowTimer = setTimeout(() => setSlow(true), 8000);
    return () => { timers.forEach(clearTimeout); clearTimeout(slowTimer); };
  }, []);

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "0 40px", gap: 8,
    }}>
      <div style={{ position: "relative", width: 120, height: 120, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
        <div style={{
          position: "absolute", inset: 4, borderRadius: "50%",
          background: `radial-gradient(circle, ${C.gold}20, transparent 70%)`,
          animation: "vai-glow 2.2s ease-in-out infinite",
        }} />
        <div style={{ display: "flex", animation: "vai-float 2s ease-in-out infinite", position: "relative" }}>
          <Map size={60} color={C.gold} strokeWidth={1.3} />
        </div>
      </div>
      <div style={{ fontFamily: F.display, color: C.cream, fontSize: 24, fontWeight: 700, letterSpacing: -0.3, textAlign: "center" }}>
        {t("loadTitle")}
      </div>
      <div style={{ fontFamily: F.display, color: C.gold, fontSize: 18, fontStyle: "italic", marginBottom: 30 }}>
        {t("loadFor", { name: destName })}
      </div>

      <div style={{ width: "100%", maxWidth: 300, display: "flex", flexDirection: "column", gap: 14 }}>
        {STEP_KEYS.map((k, i) => {
          const state = i < step ? "done" : i === step ? "active" : "idle";
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 12,
              opacity: state === "idle" ? 0.35 : 1, transition: "opacity .3s",
            }}>
              <span style={{
                width: 22, height: 22, flexShrink: 0, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 800,
                background: state === "done" ? C.green : state === "active" ? "transparent" : C.border,
                color: C.bg,
                border: state === "active" ? `2px solid ${C.gold}` : "none",
                animation: state === "active" ? "vai-pulse 1s infinite" : "none",
              }}>{state === "done" ? <Check size={13} strokeWidth={3.2} /> : null}</span>
              <span style={{ color: state === "idle" ? C.muted : C.cream, fontSize: 15 }}>{t(k)}</span>
            </div>
          );
        })}
      </div>

      {slow && onCancel && (
        <button className="vai-press" onClick={onCancel} style={{
          marginTop: 28, background: "transparent", border: `1px solid ${C.border}`,
          borderRadius: 999, padding: "10px 22px", color: C.mutedLight, fontSize: 14,
          fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
          animation: "vai-rise .3s both",
        }}>{t("cancel")}</button>
      )}
    </div>
  );
}
