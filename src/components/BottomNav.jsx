import { C } from "../theme.js";
import { useI18n } from "../i18n.js";
import { Home, Map, Camera, User } from "../icons.jsx";

// The bottom tab bar. Renders on the primary "hub" screens (home/trips/me).
// Deep-inside-flow screens (Input, Preferences, Loading, Route) omit it so the
// user isn't tempted to abandon a task mid-way.
export default function BottomNav({ active, onGo, badge }) {
  const { t } = useI18n();
  const tabs = [
    { key: "home",    Icon: Home,   label: t("navHome") },
    { key: "trips",   Icon: Map,    label: t("navTrips"), count: badge },
    { key: "gallery", Icon: Camera, label: t("navGallery") },
    { key: "me",      Icon: User,   label: t("navMe") },
  ];
  return (
    <div style={{
      flexShrink: 0, background: C.surface, borderTop: `1px solid ${C.border}`,
      padding: "8px 16px calc(10px + env(safe-area-inset-bottom))",
      display: "flex", justifyContent: "space-around",
      boxShadow: "0 -8px 24px #0006",
    }}>
      {tabs.map((tab) => {
        const on = active === tab.key;
        return (
          <button className="vai-press" key={tab.key} onClick={() => onGo(tab.key)} style={{
            background: "transparent", border: "none", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: 3, padding: "6px 10px", borderRadius: 12, minWidth: 60,
            color: on ? C.gold : C.mutedLight, fontFamily: "inherit",
            position: "relative",
          }}>
            <tab.Icon size={20} strokeWidth={on ? 2.4 : 2} style={{ filter: on ? `drop-shadow(0 4px 10px ${C.gold}55)` : "none" }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.2 }}>{tab.label}</span>
            {tab.count > 0 && (
              <span style={{
                position: "absolute", top: 2, right: 12, minWidth: 16, height: 16,
                borderRadius: 999, background: C.gold, color: C.bg, fontSize: 10, fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px",
              }}>{tab.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
