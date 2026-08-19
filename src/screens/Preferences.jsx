import { useState } from "react";
import { C, useTheme } from "../theme.js";
import { Btn } from "../components/ui.jsx";
import { useI18n } from "../i18n.js";
import { MapPin, Landmark, Utensils, TreePine, Drama, ShoppingBag, Users, Turtle, Scale, Zap } from "../icons.jsx";

function ChipRow({ options, value, onPick, multi }) {
  const isOn = (v) => (multi ? value.includes(v) : value === v);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
      {options.map((o) => (
        <button key={o.val} onClick={() => onPick(o.val)} style={{
          background: isOn(o.val) ? C.gold : C.card,
          color: isOn(o.val) ? C.bg : C.mutedLight,
          border: `1px solid ${isOn(o.val) ? C.gold : C.border}`,
          borderRadius: 999, padding: "11px 16px", fontSize: 15, fontWeight: 600,
          cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
          display: "inline-flex", alignItems: "center", gap: 7,
        }}>{o.Icon && <o.Icon size={15} />}{o.label}</button>
      ))}
    </div>
  );
}

function Bubble({ children, delay }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.gold}25`, color: C.cream,
      borderRadius: "16px 16px 16px 4px", padding: "13px 16px", fontSize: 16,
      alignSelf: "flex-start", maxWidth: "85%", animation: `vai-rise .4s ${delay}s both`,
    }}>{children}</div>
  );
}

// Local calendar date as yyyy-mm-dd. toISOString() would convert to UTC first:
// west of UTC that pushes "today" forward a day (the picker's min then blocks
// today and the default lands two days out); east of UTC after midnight it
// pulls back. Every other date path in the app already uses local parts.
const localISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayISO = () => localISO(new Date());
const tomorrowISO = () => localISO(new Date(Date.now() + 86400000));

export default function Preferences({ destination, hints, onBack, onGenerate }) {
  const { t } = useI18n();
  const { mode } = useTheme();
  const ALL_DAYS = [
    { label: t("days1"), val: 1 }, { label: t("days3"), val: 3 },
    { label: t("days7"), val: 7 }, { label: t("daysFlex"), val: "flex" },
  ];
  // If the destination chip already committed to a duration (e.g. Weekend → 3),
  // show only that option — no reason to offer conflicting alternatives.
  const DAYS = hints?.days != null ? ALL_DAYS.filter((d) => d.val === hints.days) : ALL_DAYS;
  const INTERESTS = [
    { label: t("intculture"), val: "culture", Icon: Landmark }, { label: t("intfood"), val: "food", Icon: Utensils },
    { label: t("intnature"), val: "nature", Icon: TreePine }, { label: t("intnightlife"), val: "nightlife", Icon: Drama },
    { label: t("intshopping"), val: "shopping", Icon: ShoppingBag }, { label: t("intfamily"), val: "family", Icon: Users },
  ];
  const PACE = [
    { label: t("pacerelaxed"), val: "relaxed", Icon: Turtle }, { label: t("pacebalanced"), val: "balanced", Icon: Scale },
    { label: t("pacepacked"), val: "packed", Icon: Zap },
  ];
  const [days, setDays] = useState(hints?.days ?? null);
  const [interests, setInterests] = useState(hints?.interests || []);
  const [pace, setPace] = useState(hints?.pace || "balanced");
  const [startDate, setStartDate] = useState(tomorrowISO());

  const toggle = (v) =>
    setInterests((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  const ready = days != null && interests.length > 0;

  return (
    <>
      <div style={{ height: 44, flexShrink: 0, display: "flex", alignItems: "center", padding: "0 16px" }}>
        <button onClick={onBack} aria-label={t("back")} style={{
          background: "none", border: "none", color: C.cream, fontSize: 22, cursor: "pointer",
        }}>‹</button>
        <span style={{ color: C.muted, fontSize: 14, marginLeft: 4, display: "inline-flex", alignItems: "center", gap: 5 }}>
          <MapPin size={14} />{destination}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "8px 24px", display: "flex", flexDirection: "column", gap: 8 }}>
        <Bubble delay={0}>{t("prefGreat")}</Bubble>

        <Bubble delay={0.15}>{t("prefDays")}</Bubble>
        <ChipRow options={DAYS} value={days} onPick={setDays} />

        <div style={{ height: 8 }} />
        <Bubble delay={0.2}>{t("prefWhen")}</Bubble>
        <input
          type="date"
          value={startDate}
          min={todayISO()}
          onChange={(e) => setStartDate(e.target.value)}
          style={{
            background: C.card, color: C.cream, border: `1px solid ${C.border}`,
            borderRadius: 12, padding: "12px 14px", fontSize: 15, fontFamily: "inherit",
            colorScheme: mode === "light" ? "light" : "dark",
            marginTop: 10, width: "fit-content",
          }}
        />

        <div style={{ height: 8 }} />
        <Bubble delay={0.25}>{t("prefInterests")} <i>{t("prefPickMany")}</i></Bubble>
        <ChipRow options={INTERESTS} value={interests} onPick={toggle} multi />

        <div style={{ height: 8 }} />
        <Bubble delay={0.35}>{t("prefPace")}</Bubble>
        <ChipRow options={PACE} value={pace} onPick={setPace} />

        <div style={{ height: 12 }} />
      </div>

      <div style={{ padding: "12px 24px 26px" }}>
        <Btn
          disabled={!ready}
          onClick={() => onGenerate({ destination, days, interests, pace, startDate, ...(hints?.budget ? { budget: hints.budget } : {}) })}
        >
          {ready ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Zap size={17} fill="currentColor" />{t("prefGenerate")}
            </span>
          ) : t("prefNeed")}
        </Btn>
      </div>
    </>
  );
}
