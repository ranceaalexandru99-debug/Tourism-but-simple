import { C } from "../theme.js";
import { useI18n } from "../i18n.js";
import { Star } from "../icons.jsx";

// 5-star widget shown in StopDetail once a stop is marked visited. Local state
// mirrors the persisted rating so the UI updates instantly even while the
// route recompute settles.
export default function RatingStars({ value = 0, onChange }) {
  const { t } = useI18n();
  return (
    <div style={{
      background: C.card, borderRadius: 14, padding: "12px 16px", marginTop: 10,
      border: `1px solid ${C.border}`,
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <span style={{ color: C.muted, fontSize: 12, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase" }}>
        {t("rateStop")}
      </span>
      <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= value;
          return (
            <button
              key={star}
              className="vai-press"
              onClick={() => onChange(star === value ? 0 : star)}
              aria-label={`${star} star${star > 1 ? "s" : ""}`}
              style={{
                background: "transparent", border: "none", padding: 2, cursor: "pointer",
                lineHeight: 0, color: filled ? C.gold : C.border,
                filter: filled ? `drop-shadow(0 3px 6px ${C.gold}55)` : "none",
                fontFamily: "inherit",
              }}
            ><Star size={21} fill={filled ? "currentColor" : "none"} /></button>
          );
        })}
      </div>
    </div>
  );
}
