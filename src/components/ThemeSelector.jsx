import { useState } from "react";
import { C, THEME_ACCENTS, useTheme } from "../theme.js";
import { useI18n } from "../i18n.js";
import { Sun, Moon, Check } from "../icons.jsx";

// Small button that opens a popover with a light/dark toggle and accent swatches.
export default function ThemeSelector({ align = "right" }) {
  const { t } = useI18n();
  const { mode, accent, setMode, setAccent } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      {/* Icon-only, so it needs a name of its own: a screen reader announces an
          unlabelled button as just "button", with nothing to say what it does. */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t("themeTitle")}
        aria-expanded={open}
        style={{
          display: "flex", alignItems: "center", gap: 6, background: C.card,
          border: `1px solid ${C.border}`, borderRadius: 999, padding: "7px 10px",
          color: C.cream, fontSize: 15, cursor: "pointer", fontFamily: "inherit",
        }}
      >
        {mode === "light" ? <Sun size={15} /> : <Moon size={15} />}
        <span style={{ width: 12, height: 12, borderRadius: "50%", background: C.gold }} />
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 80 }} />
          <div style={{
            position: "absolute", top: "calc(100% + 6px)", [align]: 0, zIndex: 81,
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14,
            padding: 14, width: 220, boxShadow: "0 16px 40px #0007",
          }}>
            <div style={{ color: C.muted, fontSize: 11, fontWeight: 800, letterSpacing: 1.2, marginBottom: 10 }}>
              {t("themeTitle")}
            </div>

            {/* mode toggle */}
            <div style={{ display: "flex", gap: 8, background: C.card, borderRadius: 12, padding: 4, marginBottom: 14 }}>
              {[["light", Sun, t("themeLight")], ["dark", Moon, t("themeDark")]].map(([m, Icon, label]) => {
                const on = mode === m;
                return (
                  <button key={m} onClick={() => setMode(m)} style={{
                    flex: 1, background: on ? C.gold : "transparent", color: on ? C.bg : C.mutedLight,
                    border: "none", borderRadius: 9, padding: "8px 0", fontSize: 13, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}><Icon size={14} />{label}</button>
                );
              })}
            </div>

            {/* accent swatches */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {Object.entries(THEME_ACCENTS).map(([key, hex]) => {
                const on = accent === key;
                return (
                  <button key={key} onClick={() => setAccent(key)} aria-label={key} style={{
                    width: 30, height: 30, borderRadius: "50%", background: hex, cursor: "pointer",
                    border: on ? `2px solid ${C.cream}` : "2px solid transparent",
                    boxShadow: on ? `0 0 0 2px ${hex}` : "none",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#fff",
                  }}>{on ? <Check size={14} strokeWidth={3} /> : null}</button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
