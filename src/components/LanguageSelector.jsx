import { useState } from "react";
import { C } from "../theme.js";
import { LANGS, useI18n } from "../i18n.js";

// Compact globe button that opens a dropdown of the 10 languages.
export default function LanguageSelector({ align = "right" }) {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const current = LANGS.find((l) => l.code === lang) || LANGS[0];

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen((o) => !o)} style={{
        display: "flex", alignItems: "center", gap: 6, background: C.card,
        border: `1px solid ${C.border}`, borderRadius: 999, padding: "7px 11px",
        color: C.cream, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
      }}>
        <span style={{ fontSize: 16 }}>{current.flag}</span>
        <span style={{ fontWeight: 600 }}>{current.code.toUpperCase()}</span>
        <span style={{ color: C.muted, fontSize: 11 }}>▾</span>
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 80 }} />
          <div style={{
            position: "absolute", top: "calc(100% + 6px)", [align]: 0, zIndex: 81,
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14,
            padding: 6, width: 180, maxHeight: 320, overflowY: "auto",
            boxShadow: "0 16px 40px #000a",
          }}>
            {LANGS.map((l) => {
              const on = l.code === lang;
              return (
                <button key={l.code} onClick={() => { setLang(l.code); setOpen(false); }} style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%",
                  background: on ? `${C.gold}1c` : "transparent", border: "none",
                  borderRadius: 10, padding: "10px 12px", cursor: "pointer", fontFamily: "inherit",
                  color: on ? C.gold : C.cream, fontSize: 15, textAlign: "left",
                }}>
                  <span style={{ fontSize: 18 }}>{l.flag}</span>
                  <span style={{ flex: 1, fontWeight: on ? 700 : 500 }}>{l.label}</span>
                  {on && <span style={{ fontSize: 13 }}>✓</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
