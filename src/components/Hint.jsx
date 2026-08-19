// First-time hints that dismiss forever after one tap. Kept intentionally tiny
// — a soft card with an arrow pointer, a short line, and a "Got it" button.
// Each hint remembers its own dismissal in localStorage; check hasSeenHint()
// before rendering so the tree stays clean on the second visit.

import { useState } from "react";
import { C, F } from "../theme.js";
import { X } from "../icons.jsx";

const KEY = (id) => `vai_hint_${id}`;

export function hasSeenHint(id) {
  try { return localStorage.getItem(KEY(id)) === "1"; } catch { return true; }
}
export function markHintSeen(id) {
  try { localStorage.setItem(KEY(id), "1"); } catch {}
}

// `arrow`: "top" | "bottom" — which side the pointer triangle sticks out of.
// `okLabel`: overrides the default "Got it" button text.
// `onClose`: fired when the user dismisses; the caller flips its own state.
export default function Hint({ id, arrow = "bottom", children, okLabel = "Got it", onClose, style }) {
  const [gone, setGone] = useState(false);
  if (gone) return null;
  const dismiss = () => { markHintSeen(id); setGone(true); onClose?.(); };
  const triangleBase = {
    position: "absolute", width: 0, height: 0,
    borderLeft: "10px solid transparent",
    borderRight: "10px solid transparent",
    left: "50%", transform: "translateX(-50%)",
  };
  return (
    <div style={{
      position: "absolute", zIndex: 55, padding: "12px 40px 12px 16px",
      background: C.cream, color: C.bg, borderRadius: 14,
      boxShadow: `0 12px 32px rgba(0,0,0,0.28)`, maxWidth: 280,
      fontSize: 13, fontWeight: 600, lineHeight: 1.4,
      animation: "vai-pop .25s both",
      ...style,
    }}>
      {arrow === "top" && <span style={{ ...triangleBase, top: -8, borderBottom: `10px solid ${C.cream}` }} />}
      {arrow === "bottom" && <span style={{ ...triangleBase, bottom: -8, borderTop: `10px solid ${C.cream}` }} />}
      <div>{children}</div>
      <button onClick={dismiss} aria-label={okLabel} style={{
        position: "absolute", top: 6, right: 6, width: 24, height: 24,
        border: "none", background: "transparent", cursor: "pointer",
        color: C.bg, opacity: 0.7, lineHeight: 0, borderRadius: 6,
      }}><X size={16} /></button>
    </div>
  );
}
