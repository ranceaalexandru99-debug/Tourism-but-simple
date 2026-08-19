import { useEffect } from "react";
import { C, F } from "../theme.js";
import { StatusBar } from "../components/ui.jsx";
import { useI18n } from "../i18n.js";
import { Map } from "../icons.jsx";

export default function Splash({ onDone }) {
  const { t } = useI18n();
  useEffect(() => {
    const t = setTimeout(onDone, 1800);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <>
      <StatusBar />
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 18,
      }}>
        {/* logo mark with expanding rings */}
        <div style={{ position: "relative", width: 150, height: 150, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {[0, 0.6].map((d) => (
            <div key={d} style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              border: `1.5px solid ${C.gold}55`,
              animation: `vai-ring 2.2s ${d}s ease-out infinite`,
            }} />
          ))}
          <div style={{
            position: "absolute", inset: 18, borderRadius: "50%",
            background: `radial-gradient(circle, ${C.gold}22, transparent 70%)`,
            animation: "vai-glow 2.4s ease-in-out infinite",
          }} />
          <div style={{ display: "flex", animation: "vai-float 2.4s ease-in-out infinite", position: "relative" }}>
            <Map size={72} color={C.gold} strokeWidth={1.3} />
          </div>
        </div>

        <div style={{
          fontFamily: F.display, fontSize: 40, fontWeight: 700, color: C.cream,
          letterSpacing: -0.8, lineHeight: 1.05, textAlign: "center",
          animation: "vai-pop .7s .15s both",
        }}>
          Turism,<br />
          <span style={{ color: C.gold, fontStyle: "italic" }}>dar simplu!</span>
        </div>
        <div style={{
          color: C.muted, fontSize: 15, letterSpacing: 0.3,
          animation: "vai-rise .6s .4s both",
        }}>
          {t("tagline")}
        </div>
      </div>
    </>
  );
}
