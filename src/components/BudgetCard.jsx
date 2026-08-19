import { C, F } from "../theme.js";
import { useI18n } from "../i18n.js";
import { CURRENCIES, convert } from "../locale.js";
import { BUDGET_TIERS } from "../mockEngine.js";
import { Ticket, Utensils, TrainFront, ArrowLeftRight, Backpack, Banknote, Gem } from "../icons.jsx";

// Budget tier key → icon (replaces the data emojis 🎒💶💎).
const TIER_ICONS = { econom: Backpack, mediu: Banknote, premium: Gem };

export default function BudgetCard({ budget, days, onTier, currency, onCurrency }) {
  const { t } = useI18n();
  const rows = [
    { Icon: Ticket, label: t("budgetTickets"), val: budget.tickets },
    { Icon: Utensils, label: t("budgetFood"), val: budget.food },
    { Icon: TrainFront, label: t("budgetTransport"), val: budget.transport },
  ];
  const codes = Object.keys(CURRENCIES);
  const nextCurrency = () => onCurrency(codes[(codes.indexOf(currency) + 1) % codes.length]);
  return (
    <div style={{
      background: `linear-gradient(150deg, ${C.gold}12, ${C.card} 55%)`,
      border: `1px solid ${C.gold}30`, borderRadius: 18, padding: "16px",
      marginBottom: 18, boxShadow: C.shadowSoft,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ color: C.muted, fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase" }}>{t("budgetTitle")}</span>
        <button onClick={nextCurrency} className="vai-press" title={t("changeCurrency")} aria-label={t("changeCurrency")} style={{
          background: `${C.gold}18`, border: `1px solid ${C.gold}44`, borderRadius: 999,
          padding: "4px 10px", color: C.gold, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          display: "inline-flex", alignItems: "center", gap: 5,
        }}>{currency} <ArrowLeftRight size={12} /></button>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
        <span style={{ fontFamily: F.display, color: C.gold, fontSize: 34, fontWeight: 700, letterSpacing: -0.5 }}>~{convert(budget.total, currency)}</span>
        <span style={{ color: C.muted, fontSize: 13 }}>· {t("perDay", { x: convert(budget.perDay, currency) })}</span>
      </div>

      {rows.map((r) => (
        <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 14 }}>
          <span style={{ color: C.mutedLight, display: "inline-flex", alignItems: "center", gap: 7 }}><r.Icon size={14} />{r.label}</span>
          <span style={{ color: C.cream, fontWeight: 600 }}>{r.val > 0 ? convert(r.val, currency) : "—"}</span>
        </div>
      ))}

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        {Object.entries(BUDGET_TIERS).map(([key, tier]) => {
          const on = budget.tier === key;
          const TierIcon = TIER_ICONS[key];
          return (
            <button key={key} onClick={() => !on && onTier(key)} style={{
              flex: 1, background: on ? C.gold : "transparent", color: on ? C.bg : C.mutedLight,
              border: `1px solid ${on ? C.gold : C.border}`, borderRadius: 10, padding: "9px 4px",
              fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
            }}>{TierIcon && <TierIcon size={13} />}{t("tier" + key)}</button>
          );
        })}
      </div>
    </div>
  );
}
