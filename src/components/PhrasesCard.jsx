import { C } from "../theme.js";
import { useI18n } from "../i18n.js";
import { MessagesSquare, Hand, Heart, Coins, Bath, LifeBuoy } from "../icons.jsx";

export default function PhrasesCard({ phrases }) {
  const { t } = useI18n();
  const rows = [
    { k: "hello", Icon: Hand }, { k: "thanks", Icon: Heart }, { k: "howmuch", Icon: Coins },
    { k: "toilet", Icon: Bath }, { k: "help", Icon: LifeBuoy },
  ];
  return (
    <div style={{
      background: `linear-gradient(150deg, ${C.blue}12, ${C.card} 55%)`,
      border: `1px solid ${C.blue}30`, borderRadius: 18, padding: "14px 16px",
      marginBottom: 18, boxShadow: C.shadowSoft,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ color: C.muted, fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <MessagesSquare size={13} />{t("phrasesTitle")}
        </span>
        <span style={{ color: C.mutedLight, fontSize: 12, fontWeight: 600 }}>{phrases.flag} {phrases.name}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map((r) => (
          <div key={r.k} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, fontSize: 14 }}>
            <span style={{ color: C.mutedLight, display: "inline-flex", alignItems: "center", gap: 7 }}><r.Icon size={14} />{t("phrase_" + r.k)}</span>
            <span style={{ color: C.cream, fontWeight: 700, letterSpacing: 0.2 }}>{phrases.phrases[r.k]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
