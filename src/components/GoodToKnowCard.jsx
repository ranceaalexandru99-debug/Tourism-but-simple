import { C } from "../theme.js";
import { useI18n } from "../i18n.js";
import { Lightbulb, Ambulance, Plug, Clock } from "../icons.jsx";

// Practical arrival-day info (emergency / plug / timezone).
export default function GoodToKnowCard({ info }) {
  const { t } = useI18n();
  const rows = [
    { k: "emergency", Icon: Ambulance, val: info.emergency },
    { k: "plug", Icon: Plug, val: info.plug },
    {
      k: "timezone", Icon: Clock,
      val: info.hoursFromUser == null
        ? info.tz
        : info.hoursFromUser === 0
          ? t("timezone")
          : t("tzDiff", { h: info.hoursFromUser > 0 ? `+${info.hoursFromUser}` : info.hoursFromUser }),
    },
  ];
  return (
    <div style={{
      background: `linear-gradient(150deg, ${C.green}12, ${C.card} 55%)`,
      border: `1px solid ${C.green}30`, borderRadius: 18, padding: "14px 16px",
      marginBottom: 18, boxShadow: C.shadowSoft,
    }}>
      <div style={{
        color: C.muted, fontSize: 11, fontWeight: 800, letterSpacing: 2,
        textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 6,
      }}><Lightbulb size={13} />{t("goodToKnowTitle")}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map((r) => (
          <div key={r.k} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, fontSize: 14 }}>
            <span style={{ color: C.mutedLight, display: "inline-flex", alignItems: "center", gap: 7 }}><r.Icon size={14} />{t(r.k)}</span>
            <span style={{ color: C.cream, fontWeight: 700 }}>{r.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
