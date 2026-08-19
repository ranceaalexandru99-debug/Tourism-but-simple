import { useState } from "react";
import { C } from "../theme.js";
import { useI18n } from "../i18n.js";
import { Btn } from "./ui.jsx";
import LegalSheet from "./LegalSheet.jsx";
import { Lock } from "../icons.jsx";

// First-boot data/consent notice. Sits above the tab bar, dismissed with OK
// (persisted). Links out to the full Privacy & Terms sheet.
export default function ConsentBanner({ onAccept }) {
  const { t } = useI18n();
  const [legal, setLegal] = useState(false);
  return (
    <>
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 50,
        background: C.surface, borderTop: `1px solid ${C.border}`,
        padding: "16px 20px calc(16px + env(safe-area-inset-bottom))",
        boxShadow: "0 -12px 34px #0009", animation: "vai-rise .3s both",
      }}>
        <div style={{ color: C.cream, fontSize: 14, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
          <Lock size={14} color={C.gold} />{t("consentTitle")}
        </div>
        <div style={{ color: C.mutedLight, fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>
          {t("consentBody")}{" "}
          <span onClick={() => setLegal(true)} style={{ color: C.gold, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>
            {t("consentLink")}
          </span>
        </div>
        <Btn onClick={onAccept}>{t("consentOk")}</Btn>
      </div>
      {legal && <LegalSheet onClose={() => setLegal(false)} />}
    </>
  );
}
