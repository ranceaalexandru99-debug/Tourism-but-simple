import { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { C, themedStyles } from "../lib/theme.js";
import { useI18n } from "../lib/i18n.js";
import { FONT } from "../fonts.js";
import { Btn } from "../components/ui.js";
import { MapPin, Landmark, Utensils, TreePine, Drama, ShoppingBag, Users, Turtle, Scale, Zap } from "../icons.js";

function Bubble({ children }) {
  return (
    <View style={styles.bubble}>
      <Text style={{ color: C.cream, fontSize: 16, lineHeight: 22 }}>{children}</Text>
    </View>
  );
}

function ChipRow({ options, value, onPick, multi }) {
  const isOn = (v) => (multi ? value.includes(v) : value === v);
  return (
    <View style={styles.chipRow}>
      {options.map((o) => {
        const on = isOn(o.val);
        return (
          <Pressable
            key={o.val}
            onPress={() => onPick(o.val)}
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: on ? C.gold : C.card, borderColor: on ? C.gold : C.border, transform: [{ scale: pressed ? 0.96 : 1 }] },
              { flexDirection: "row", alignItems: "center", gap: 6 },
            ]}
          >
            {o.Icon ? <o.Icon size={14} color={on ? C.bg : C.mutedLight} /> : null}
            <Text style={{ color: on ? C.bg : C.mutedLight, fontFamily: FONT.semibold, fontSize: 15 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Local calendar date, not UTC: toISOString() shifts the day either way
// depending on the offset (off by one before 03:00 in UTC+3, after 19:00 in
// UTC-5), which then propagates into every date the trip derives.
const addDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function Preferences({ destination, onBack, onGenerate }) {
  const { t, lang } = useI18n();
  const DAYS = [
    { label: t("days1"), val: 1 }, { label: t("days3"), val: 3 },
    { label: t("days7"), val: 7 }, { label: t("daysFlex"), val: "flex" },
  ];
  const INTERESTS = [
    { label: t("intculture"), val: "culture", Icon: Landmark }, { label: t("intfood"), val: "food", Icon: Utensils },
    { label: t("intnature"), val: "nature", Icon: TreePine }, { label: t("intnightlife"), val: "nightlife", Icon: Drama },
    { label: t("intshopping"), val: "shopping", Icon: ShoppingBag }, { label: t("intfamily"), val: "family", Icon: Users },
  ];
  const PACE = [
    { label: t("pacerelaxed"), val: "relaxed", Icon: Turtle }, { label: t("pacebalanced"), val: "balanced", Icon: Scale },
    { label: t("pacepacked"), val: "packed", Icon: Zap },
  ];

  const [days, setDays] = useState(null);
  const [interests, setInterests] = useState([]);
  const [pace, setPace] = useState("balanced");
  const [dayOffset, setDayOffset] = useState(1); // days from today; 1 = tomorrow
  const startDate = addDays(dayOffset);

  const toggle = (v) => setInterests((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  const ready = days != null && interests.length > 0;

  const dateLabel = new Date(startDate + "T00:00:00").toLocaleDateString(
    lang === "zh" ? "zh-CN" : lang || "en",
    { weekday: "short", day: "numeric", month: "short" }
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12}><Text style={{ color: C.cream, fontSize: 26 }}>‹</Text></Pressable>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginLeft: 8 }}>
          <MapPin size={14} color={C.muted} />
          <Text style={{ color: C.muted, fontSize: 14 }}>{destination}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 16, gap: 8 }}>
        <Bubble>{t("prefGreat")}</Bubble>

        <Bubble>{t("prefDays")}</Bubble>
        <ChipRow options={DAYS} value={days} onPick={setDays} />

        <View style={{ height: 8 }} />
        <Bubble>{t("prefWhen")}</Bubble>
        <View style={styles.dateStepper}>
          <Pressable onPress={() => setDayOffset((d) => Math.max(0, d - 1))} hitSlop={10} style={styles.stepBtn}>
            <Text style={{ color: C.cream, fontSize: 20 }}>‹</Text>
          </Pressable>
          <Text style={{ color: C.cream, fontSize: 15, fontFamily: FONT.semibold, textTransform: "capitalize" }}>{dateLabel}</Text>
          <Pressable onPress={() => setDayOffset((d) => d + 1)} hitSlop={10} style={styles.stepBtn}>
            <Text style={{ color: C.cream, fontSize: 20 }}>›</Text>
          </Pressable>
        </View>

        <View style={{ height: 8 }} />
        <Bubble>{t("prefInterests")} {t("prefPickMany")}</Bubble>
        <ChipRow options={INTERESTS} value={interests} onPick={toggle} multi />

        <View style={{ height: 8 }} />
        <Bubble>{t("prefPace")}</Bubble>
        <ChipRow options={PACE} value={pace} onPick={setPace} />
        <View style={{ height: 12 }} />
      </ScrollView>

      <View style={{ padding: 24 }}>
        <Btn icon={ready ? Zap : undefined} disabled={!ready} onPress={() => onGenerate({ destination, days, interests, pace, startDate })}>
          {ready ? t("prefGenerate") : t("prefNeed")}
        </Btn>
      </View>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  header: { height: 44, flexDirection: "row", alignItems: "center", paddingHorizontal: 16 },
  bubble: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.gold + "25",
    borderRadius: 16, borderBottomLeftRadius: 4, padding: 14, alignSelf: "flex-start", maxWidth: "88%",
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 },
  chip: { borderRadius: 999, borderWidth: 1, paddingVertical: 11, paddingHorizontal: 16 },
  dateStepper: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, marginTop: 10, alignSelf: "flex-start", minWidth: 220, gap: 16,
  },
  stepBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
}));
