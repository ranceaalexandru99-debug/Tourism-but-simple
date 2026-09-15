import { useRef } from "react";
import { C, F } from "../theme.js";
import { useEscape, useFocusTrap } from "../useEscape.js";
import { useI18n } from "../i18n.js";
import { LEGAL, ACCOUNT_DELETION } from "../legal.js";
import { Scale, X } from "../icons.jsx";


// All legal copy lives in src/legal.js — the same source the public
// privacy / terms / account-deletion pages are generated from, so the app and
// the website can never disagree. Languages other than EN/RO fall back to EN
// with a visible note (legalEnNote).

function Section({ title, items }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontFamily: F.display, color: C.cream, fontSize: 18, fontWeight: 700, letterSpacing: -0.3, marginBottom: 10 }}>{title}</div>
      {items.map(([h, body]) => (
        <div key={h} style={{ marginBottom: 12 }}>
          <div style={{ color: C.gold, fontSize: 13, fontWeight: 800, marginBottom: 3 }}>{h}</div>
          <div style={{ color: C.mutedLight, fontSize: 13, lineHeight: 1.6 }}>{body}</div>
        </div>
      ))}
    </div>
  );
}

export default function LegalSheet({ onClose }) {
  const sheetRef = useRef(null);
  useEscape(onClose);
  useFocusTrap(sheetRef);
  const { t, lang } = useI18n();
  const L = LEGAL[lang] || LEGAL.en;
  const D = ACCOUNT_DELETION[lang] || ACCOUNT_DELETION.en;
  const showEnNote = !LEGAL[lang];
  return (
    <div onClick={onClose} style={{
      position: "absolute", inset: 0, background: "#000c", zIndex: 55,
      display: "flex", alignItems: "flex-end", animation: "vai-pop .2s both",
    }}>
      <div ref={sheetRef} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{
        width: "100%", background: C.surface, borderRadius: "26px 26px 0 0",
        padding: "10px 22px 28px", maxHeight: "90%", overflowY: "auto", animation: "vai-rise .25s both",
      }}>
        <div style={{ width: 40, height: 5, background: C.border, borderRadius: 3, margin: "0 auto 16px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <div style={{ fontFamily: F.display, color: C.cream, fontSize: 21, fontWeight: 700, letterSpacing: -0.3, display: "flex", alignItems: "center", gap: 8 }}>
            <Scale size={19} color={C.gold} />{t("legalTitle")}
          </div>
          {/* Icon-only, so it needs a name of its own: a screen reader
              announces an unlabelled button as just "button". */}
          <button onClick={onClose} aria-label={t("back")} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", lineHeight: 0 }}><X size={20} /></button>
        </div>
        <div style={{ color: C.muted, fontSize: 12, marginBottom: showEnNote ? 10 : 18 }}>{L.updated}</div>
        {showEnNote && (
          <div style={{
            background: `${C.gold}14`, border: `1px solid ${C.gold}33`, borderRadius: 10,
            padding: "8px 12px", marginBottom: 16, color: C.gold, fontSize: 12, lineHeight: 1.5,
          }}>{t("legalEnNote")}</div>
        )}

        <Section title={L.privacyTitle} items={L.privacy} />
        <Section title={L.termsTitle} items={L.terms} />
        {/* Both stores require account deletion to be documented in-app as
            well as on a public page — same text, one source. */}
        <Section title={D.title} items={D.steps} />
        <div style={{ color: C.mutedLight, fontSize: 13, lineHeight: 1.6, marginTop: -8, marginBottom: 20 }}>{D.retention}</div>

        <div style={{ color: C.muted, fontSize: 12, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>{L.contact}</div>
      </div>
    </div>
  );
}
