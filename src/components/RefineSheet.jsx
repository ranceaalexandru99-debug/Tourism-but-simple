import { useState , useRef } from "react";
import { useEscape, useFocusTrap } from "../useEscape.js";
import { C, F } from "../theme.js";
import { useI18n } from "../i18n.js";
import { Plus, Users, Wallet, Utensils, Zap, MessageCircle, ArrowUp , X} from "../icons.jsx";

const QUICK_ACTIONS = [
  { key: "Day", Icon: Plus, apply: (p) => ({ ...p, days: Math.min(7, p.days + 1) }) },
  { key: "Family", Icon: Users, apply: (p) => ({ ...p, interests: [...new Set([...p.interests, "family"])] }) },
  { key: "Budget", Icon: Wallet, apply: (p) => ({ ...p, budget: "low", pace: "relaxed" }) },
  { key: "Food", Icon: Utensils, apply: (p) => ({ ...p, interests: [...new Set([...p.interests, "food"])] }) },
  { key: "Intense", Icon: Zap, apply: (p) => ({ ...p, pace: "packed" }) },
];

export default function RefineSheet({ prefs, onClose, onApply }) {
  const sheetRef = useRef(null);
  useEscape(onClose);
  useFocusTrap(sheetRef);
  const { t } = useI18n();
  const [text, setText] = useState("");
  return (
    <div onClick={onClose} style={{
      position: "absolute", inset: 0, background: "#000a", zIndex: 30,
      display: "flex", alignItems: "flex-end", animation: "vai-pop .2s both",
    }}>
      <div ref={sheetRef} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{
        width: "100%", background: C.surface, borderRadius: "26px 26px 0 0", padding: "10px 22px 26px",
        // Cap the height so the backdrop — the way out — is always reachable.
        maxHeight: "88%", overflowY: "auto", overflowX: "hidden",
        animation: "vai-rise .25s both",
      }}>
        {/* Grab handle plus an explicit close button — tapping the backdrop is not
                    discoverable, and on a tall sheet it may not even be reachable. */}
                <div style={{ position: "relative", height: 21, marginBottom: 10 }}>
                  <div style={{ width: 40, height: 5, background: C.border, borderRadius: 3, margin: "6px auto 0" }} />
                  <button onClick={onClose} aria-label={t("back")} style={{
                    position: "absolute", right: -6, top: -4, background: "none", border: "none",
                    color: C.muted, cursor: "pointer", lineHeight: 0, padding: 6,
                  }}><X size={20} /></button>
                </div>
        <div style={{ fontFamily: F.display, color: C.cream, fontSize: 21, fontWeight: 700, letterSpacing: -0.3, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
          <MessageCircle size={19} color={C.purple} />{t("refineTitle")}
        </div>
        <div style={{ color: C.muted, fontSize: 13, marginBottom: 16 }}>{t("refineSub")}</div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginBottom: 18 }}>
          {QUICK_ACTIONS.map((a) => (
            <button key={a.key} onClick={() => onApply(a.apply(prefs), t("qam" + a.key))} style={{
              background: `${C.purple}1c`, color: C.purple, border: `1px solid ${C.purple}50`,
              borderRadius: 999, padding: "10px 15px", fontSize: 14, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}><a.Icon size={14} />{t("qa" + a.key)}</button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("refinePh")}
            style={{
              flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
              padding: "13px 14px", color: C.cream, fontSize: 14, fontFamily: "inherit", outline: "none",
            }}
          />
          <button onClick={() => text.trim() && onApply({ ...prefs, instruction: text.trim() }, t("qamText"))} aria-label={t("modify")} style={{
            background: C.purple, border: "none", borderRadius: 12, padding: "0 18px",
            color: C.bg, cursor: "pointer", fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}><ArrowUp size={18} strokeWidth={2.6} /></button>
        </div>
      </div>
    </div>
  );
}
