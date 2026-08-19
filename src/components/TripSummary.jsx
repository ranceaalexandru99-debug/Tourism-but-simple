import { C, F } from "../theme.js";
import { PartyPopper, Compass, CircleCheck, Footprints, Ticket, Star, CategoryIcon } from "../icons.jsx";

// Renders at the bottom of the itinerary and fills in as the traveler marks
// stops as visited. Turns celebratory (green + confetti hint) once every stop
// is checked. Hidden entirely when nothing has been marked yet.
// `t` is passed in from the parent (which already holds the i18n context).
export default function TripSummary({ stats, t }) {
  if (!stats || stats.visitedCount === 0) return null;
  const done = stats.complete;
  const accent = done ? C.green : C.gold;
  const catRows = Object.entries(stats.categories).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const rows = [
    { label: t("statsVisited"), value: `${stats.visitedCount} / ${stats.totalCount}`, Icon: CircleCheck },
    { label: t("statsWalked"), value: stats.kmWalked > 0 ? `${stats.kmWalked.toFixed(1)} km` : "—", Icon: Footprints },
    { label: t("statsSpent"), value: stats.spent > 0 ? `€${stats.spent}` : "—", Icon: Ticket },
  ];
  return (
    <div style={{
      background: `linear-gradient(150deg, ${accent}22, ${C.card} 65%)`,
      border: `1px solid ${accent}50`, borderRadius: 20, padding: "18px 20px",
      marginTop: 8, boxShadow: `0 12px 34px ${accent}22, ${C.shadowSoft}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        {done ? <PartyPopper size={22} color={accent} /> : <Compass size={22} color={accent} />}
        <div style={{
          fontFamily: F.display, color: C.cream, fontSize: 20, fontWeight: 700, letterSpacing: -0.3,
        }}>{done ? t("statsCompleteTitle") : t("statsProgressTitle")}</div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {rows.map((r) => (
          <div key={r.label} style={{
            flex: 1, background: C.card, borderRadius: 14, padding: "10px 12px",
            border: `1px solid ${C.border}`, textAlign: "left",
          }}>
            <r.Icon size={16} color={accent} />
            <div style={{
              fontFamily: F.display, color: C.cream, fontSize: 18, fontWeight: 700,
              marginTop: 4, letterSpacing: -0.3,
            }}>{r.value}</div>
            <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", marginTop: 2 }}>
              {r.label}
            </div>
          </div>
        ))}
      </div>
      {catRows.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: stats.topRated ? 12 : 0 }}>
          {catRows.map(([cat, n]) => (
            <span key={cat} style={{
              background: `${accent}18`, color: accent, borderRadius: 999,
              padding: "5px 12px", fontSize: 12, fontWeight: 700,
              display: "inline-flex", alignItems: "center", gap: 5,
            }}><CategoryIcon tags={cat} size={12} />{t("int" + cat) || cat} · {n}</span>
          ))}
        </div>
      )}
      {stats.topRated && (
        <div style={{
          background: C.card, borderRadius: 12, padding: "10px 13px",
          borderLeft: `3px solid ${C.gold}`, marginTop: 4,
        }}>
          <div style={{ color: C.gold, fontSize: 11, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 2 }}>
            {t("statsFavourite")}
          </div>
          <div style={{ color: C.cream, fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <CategoryIcon tags={stats.topRated.tags} size={14} color={C.gold} />{stats.topRated.name}
            <span style={{ color: C.gold, display: "inline-flex", gap: 1 }}>
              {Array.from({ length: stats.topRated.rating }, (_, i) => <Star key={i} size={12} fill="currentColor" />)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
