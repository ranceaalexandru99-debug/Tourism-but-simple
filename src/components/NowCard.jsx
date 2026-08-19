import { C, F } from "../theme.js";
import { useI18n } from "../i18n.js";
import { travelBetween } from "../geo.js";
import { Timer, Footprints, Moon, CategoryIcon } from "../icons.jsx";

// "Now" companion card. Shown only for trips currently in progress. Tells the
// traveler what they're doing right this minute (or what's next), how long
// until they need to leave, and which day is in focus.
export default function NowCard({ now, route, currency }) {
  const { t } = useI18n();
  const day = route.itinerary[now.dayIndex];
  const current = now.currentIndex >= 0 ? day.stops[now.currentIndex] : null;
  const next = now.nextIndex >= 0 ? day.stops[now.nextIndex] : null;

  let title, subtitle, focus, accent, TitleIcon;
  if (now.phase === "at" && current) {
    accent = C.green;
    TitleIcon = Timer;
    title = `${t("nowAt")} · ${current.name}`;
    subtitle = t("nowMinLeft", { m: Math.max(1, now.minutesLeft) });
    focus = current;
  } else if (now.phase === "moving" && next) {
    accent = C.gold;
    // Travel time between previous stop (where the user presumably is) and next.
    const from = now.currentIndex >= 0 ? day.stops[now.currentIndex] : null;
    const travel = from ? travelBetween(from, next) : null;
    const leaveIn = travel ? Math.max(0, now.minutesUntilNext - travel.minutes) : now.minutesUntilNext;
    TitleIcon = Footprints;
    title = `${t("nowNext")} · ${next.name}`;
    subtitle = leaveIn <= 5
      ? t("nowLeaveNow")
      : t("nowLeaveIn", { m: leaveIn, at: next.time });
    focus = next;
  } else {
    accent = C.mutedLight;
    TitleIcon = Moon;
    title = t("nowDayDone");
    subtitle = t("nowDayDoneSub", { n: now.dayIndex + 1 });
    focus = null;
  }

  return (
    <div style={{
      background: `linear-gradient(150deg, ${accent}22, ${C.card} 65%)`,
      border: `1px solid ${accent}55`, borderRadius: 20, padding: "14px 16px",
      marginBottom: 18, boxShadow: `0 12px 34px ${accent}22, ${C.shadowSoft}`,
      display: "flex", alignItems: "center", gap: 14,
    }}>
      {focus && (
        <span style={{
          width: 46, height: 46, borderRadius: 14, flexShrink: 0,
          background: `${accent}22`, border: `1px solid ${accent}55`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}><CategoryIcon tags={focus.tags} size={22} color={accent} /></span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: C.muted, fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", marginBottom: 2 }}>
          {t("nowLabel")} · {t("day", { n: now.dayIndex + 1 })}
        </div>
        <div style={{
          fontFamily: F.display, color: C.cream, fontSize: 17, fontWeight: 700,
          letterSpacing: -0.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}><TitleIcon size={15} style={{ verticalAlign: -2, marginRight: 6 }} />{title}</div>
        <div style={{ color: accent, fontSize: 13, fontWeight: 600, marginTop: 2 }}>{subtitle}</div>
      </div>
    </div>
  );
}
