import { useState } from "react";
import { C, F } from "../theme.js";
import { useI18n } from "../i18n.js";
import { INTRO, OUTRO } from "../shortVideo.js";
import {
  makeRecipe, moveItem, toggleAt, setSecAt, applyRecipe, totalSeconds,
  MIN_SEC, MAX_SEC,
} from "../shortEdit.js";
import { Film, X, ChevronUp, ChevronDown, Check } from "../icons.jsx";

// Choose what goes into the short before spending real time rendering it.
//
// Rendering runs in real time — a 30s short costs 30s of waiting — so deciding
// afterwards is expensive in a way that a normal undo is not. Everything here
// is a decision made BEFORE that cost is paid, which is also why the running
// total is shown: it is the wait, not just the length.
//
// The recipe itself lives in shortEdit.js, shared verbatim with native.
export default function ShortEditor({ scenes, onCancel, onRender }) {
  const { t } = useI18n();
  const [recipe, setRecipe] = useState(() => makeRecipe(scenes));

  const chosen = applyRecipe(scenes, recipe);
  const seconds = totalSeconds(chosen, INTRO, OUTRO);
  const nothing = chosen.length === 0;

  // Scenes keyed for lookup, so a row can show its own photo without caring
  // where the recipe has moved it to.
  const byKey = new Map(scenes.map((s, i) => [s?.photo?.id ?? `i${i}`, s]));

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 120, background: "#000A",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }}>
      <div style={{
        width: "min(520px, 100%)", maxHeight: "92vh", display: "flex", flexDirection: "column",
        background: C.surface, borderRadius: "22px 22px 0 0", border: `1px solid ${C.border}`,
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 18px 12px", borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Film size={17} color={C.gold} />
            <span style={{ fontFamily: F.display, color: C.cream, fontSize: 18, fontWeight: 700 }}>
              {t("shortEditTitle")}
            </span>
          </div>
          <button onClick={onCancel} aria-label={t("cancel")} style={{
            background: "transparent", border: "none", cursor: "pointer", color: C.muted, padding: 4,
          }}><X size={18} /></button>
        </div>

        <div style={{ padding: "10px 18px 0", color: C.muted, fontSize: 13, lineHeight: 1.5 }}>
          {t("shortEditHint")}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px 18px" }}>
          {recipe.map((item, i) => {
            const scene = byKey.get(item.key);
            if (!scene) return null;
            return (
              <div key={item.key} style={{
                display: "flex", alignItems: "center", gap: 11, padding: "9px 0",
                borderBottom: i < recipe.length - 1 ? `1px solid ${C.border}` : "none",
                opacity: item.include ? 1 : 0.45,
              }}>
                <img
                  src={scene.photo.dataUrl}
                  alt=""
                  style={{ width: 46, height: 46, borderRadius: 9, objectFit: "cover", flexShrink: 0 }}
                />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: C.cream, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {scene.photo.caption || scene.place || t("albumPhotos")}
                  </div>
                  {/* The slider is disabled rather than hidden on an excluded
                      photo: hiding it would make the row jump around as things
                      are toggled. */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                    <input
                      type="range"
                      min={MIN_SEC} max={MAX_SEC} step={0.1}
                      value={item.sec}
                      disabled={!item.include}
                      aria-label={t("shortEditSeconds")}
                      onChange={(e) => setRecipe((r) => setSecAt(r, i, e.target.value))}
                      style={{ flex: 1, accentColor: C.gold, minWidth: 0 }}
                    />
                    <span style={{ color: C.muted, fontSize: 12, width: 34, textAlign: "right" }}>
                      {item.sec.toFixed(1)}s
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <button
                    onClick={() => setRecipe((r) => moveItem(r, i, i - 1))}
                    disabled={i === 0}
                    aria-label={t("shortEditUp")}
                    style={arrow(i === 0)}
                  ><ChevronUp size={14} /></button>
                  <button
                    onClick={() => setRecipe((r) => moveItem(r, i, i + 1))}
                    disabled={i === recipe.length - 1}
                    aria-label={t("shortEditDown")}
                    style={arrow(i === recipe.length - 1)}
                  ><ChevronDown size={14} /></button>
                </div>

                <button
                  onClick={() => setRecipe((r) => toggleAt(r, i))}
                  aria-label={t("shortEditInclude")}
                  aria-pressed={item.include}
                  style={{
                    width: 26, height: 26, borderRadius: 8, cursor: "pointer", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: item.include ? C.gold : "transparent",
                    border: `1px solid ${item.include ? C.gold : C.border}`,
                    color: C.bg,
                  }}
                >{item.include ? <Check size={14} strokeWidth={3} /> : null}</button>
              </div>
            );
          })}
        </div>

        <div style={{ padding: "12px 18px 18px", borderTop: `1px solid ${C.border}` }}>
          <div style={{ color: C.muted, fontSize: 13, marginBottom: 10, textAlign: "center" }}>
            {nothing
              ? t("shortEditEmpty")
              : t("shortEditLength", { n: chosen.length, s: seconds.toFixed(1) })}
          </div>
          <button
            onClick={() => onRender(recipe)}
            disabled={nothing}
            style={{
              width: "100%", border: "none", borderRadius: 14, padding: "14px 18px",
              background: nothing ? C.card : C.goldGrad, color: nothing ? C.muted : C.bg,
              fontSize: 15, fontWeight: 800, fontFamily: "inherit",
              cursor: nothing ? "default" : "pointer",
            }}
          >{t("shortEditRender")}</button>
        </div>
      </div>
    </div>
  );
}

const arrow = (disabled) => ({
  background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6,
  color: disabled ? C.border : C.mutedLight, cursor: disabled ? "default" : "pointer",
  padding: "1px 4px", lineHeight: 0,
});
