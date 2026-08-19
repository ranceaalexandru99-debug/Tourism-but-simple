import { useState } from "react";
import { C, F } from "../theme.js";
import { StatusBar, Btn } from "../components/ui.jsx";
import { useI18n } from "../i18n.js";
import LanguageSelector from "../components/LanguageSelector.jsx";
import ThemeSelector from "../components/ThemeSelector.jsx";
import { Globe, Sparkles, Zap } from "../icons.jsx";

export default function Welcome({ onDone }) {
  const { t } = useI18n();
  const SLIDES = [
    { Icon: Globe, title: t("w1t"), text: t("w1d") },
    { Icon: Sparkles, title: t("w2t"), text: t("w2d") },
    { Icon: Zap, title: t("w3t"), text: t("w3d") },
  ];
  const [i, setI] = useState(0);
  const last = i === SLIDES.length - 1;
  const s = SLIDES[i];

  return (
    <>
      <StatusBar />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 22px" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <LanguageSelector align="left" />
          <ThemeSelector align="left" />
        </div>
        <button onClick={onDone} style={{
          background: "none", border: "none", color: C.muted, fontSize: 15,
          cursor: "pointer", fontFamily: "inherit", padding: 8,
        }}>{t("skip")}</button>
      </div>

      <div key={i} style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", textAlign: "center", padding: "0 30px", gap: 14,
        animation: "vai-rise .4s both",
      }}>
        <div style={{
          position: "relative", width: 190, height: 190, marginBottom: 14,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            background: `radial-gradient(circle at 35% 30%, ${C.gold}30, ${C.blue}18 60%, transparent 75%)`,
            animation: "vai-glow 4s ease-in-out infinite",
          }} />
          <div style={{
            position: "absolute", inset: 22, borderRadius: "50%",
            border: `1px dashed ${C.gold}40`,
            animation: "vai-spin 30s linear infinite",
          }} />
          <div style={{
            position: "relative", display: "flex",
            filter: `drop-shadow(0 14px 34px ${C.gold}44)`,
            animation: "vai-float 3.2s ease-in-out infinite",
          }}><s.Icon size={88} color={C.gold} strokeWidth={1.4} /></div>
        </div>
        <div style={{
          fontFamily: F.display, fontSize: 32, fontWeight: 700, color: C.cream,
          letterSpacing: -0.5, lineHeight: 1.15,
        }}>{s.title}</div>
        <div style={{ fontSize: 16, color: C.mutedLight, lineHeight: 1.65, maxWidth: 320 }}>{s.text}</div>
      </div>

      <div style={{ padding: "0 22px 30px" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 7, marginBottom: 24 }}>
          {SLIDES.map((_, j) => (
            <div key={j} style={{
              width: j === i ? 26 : 8, height: 8, borderRadius: 4,
              background: j === i ? C.gold : C.border, transition: "all .25s",
            }} />
          ))}
        </div>
        <Btn onClick={() => (last ? onDone() : setI(i + 1))}>
          {last ? t("getStarted") : t("continue")}
        </Btn>
      </div>
    </>
  );
}
