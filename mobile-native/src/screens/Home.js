import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { C, themedStyles } from "../lib/theme.js";
import { useI18n, tripTitle } from "../lib/i18n.js";
import { POPULAR } from "../lib/mockEngine.js";
import { FONT } from "../fonts.js";
import { Label } from "../components/ui.js";
import { Search, MapPin, Clock, CategoryIcon } from "../icons.js";
import PoiImage from "../components/PoiImage.js";
import { LinearGradient } from "expo-linear-gradient";

function greeting(t) {
  const h = new Date().getHours();
  if (h < 5) return t("hiNight");
  if (h < 12) return t("hiMorning");
  if (h < 18) return t("hiAfternoon");
  if (h < 22) return t("hiEvening");
  return t("hiNight");
}

const TINTS = [C.gold, C.blue, C.green, C.purple];

export default function Home({ user, saved, onSearch, onQuick, onOpenSaved }) {
  const { t } = useI18n();
  const name = user?.name || t("traveler");

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 22, paddingBottom: 40 }}>
      <View style={{ marginBottom: 22 }}>
        <Text style={{ color: C.muted, fontSize: 14 }}>{greeting(t)}</Text>
        <Text style={styles.name}>{name}</Text>
      </View>

      <Pressable onPress={onSearch} style={styles.search}>
        <View style={styles.searchIcon}><Search size={18} color={C.bg} strokeWidth={2.4} /></View>
        <Text style={{ color: C.muted, fontSize: 16 }}>{t("where")}</Text>
      </Pressable>

      <Label color={C.gold}>{t("popular")}</Label>
      <View style={styles.grid}>
        {POPULAR.map((p, i) => {
          const tint = TINTS[i % TINTS.length];
          return (
            <Pressable
              key={p.q}
              onPress={() => onQuick(p.q)}
              style={({ pressed }) => [styles.card, { borderColor: tint + "45", transform: [{ scale: pressed ? 0.98 : 1 }] }]}
            >
              {/* Real destination photo (Wikipedia) with graceful icon fallback */}
              <PoiImage name={p.q} tags={p.cat} width="100%" height="100%" radius={0} fontSize={40} />
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.16)", "rgba(0,0,0,0.76)"]}
                locations={[0.32, 0.55, 1]}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              <View style={styles.cardChip}><CategoryIcon tags={p.cat} size={15} color="#fff" /></View>
              <View style={styles.cardLabel}>
                <Text style={styles.cardTitle} numberOfLines={1}>{p.q}</Text>
                <Text style={styles.cardSub} numberOfLines={1}>{p.sub}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Label color={C.gold} style={{ marginTop: 8 }}>{t("navTrips")}</Label>
      <View style={{ marginTop: 12, gap: 10 }}>
        {saved.length === 0 && (
          <View style={styles.empty}>
            <Text style={{ color: C.muted, fontSize: 14, textAlign: "center", lineHeight: 22 }}>
              {t("noTrips")}{"\n"}{t("noTripsSub")}
            </Text>
          </View>
        )}
        {saved.map((r) => (
          <Pressable key={r.id} onPress={() => onOpenSaved(r)} style={styles.trip}>
            <View style={styles.tripEmoji}><CategoryIcon tags={r.interests} size={24} color={C.gold} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tripTitle} numberOfLines={1}>{tripTitle(r, t)}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
                <MapPin size={12} color={C.muted} />
                <Text style={{ color: C.muted, fontSize: 13 }}>{r.totalStops} {t("stops")} ·</Text>
                <Clock size={12} color={C.muted} />
                <Text style={{ color: C.muted, fontSize: 13 }}>~{r.totalHours}h</Text>
              </View>
            </View>
            <Text style={{ color: C.muted, fontSize: 20 }}>›</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  name: { fontFamily: FONT.display, color: C.cream, fontSize: 28, letterSpacing: -0.4 },
  search: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.gold + "45", borderRadius: 18,
    padding: 13, marginBottom: 28,
  },
  searchIcon: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: C.gold,
    alignItems: "center", justifyContent: "center",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 12, marginBottom: 20 },
  card: {
    width: "47%", flexGrow: 1, height: 122, backgroundColor: C.card, borderWidth: 1,
    borderRadius: 18, overflow: "hidden",
  },
  cardChip: {
    position: "absolute", top: 9, right: 9, width: 28, height: 28, borderRadius: 9,
    backgroundColor: "rgba(0,0,0,0.42)", alignItems: "center", justifyContent: "center",
  },
  cardLabel: { position: "absolute", left: 12, right: 12, bottom: 9 },
  cardTitle: { fontFamily: FONT.displaySemi, color: "#fff", fontSize: 17, letterSpacing: -0.2 },
  cardSub: { color: "rgba(255,255,255,0.88)", fontSize: 12 },
  empty: {
    backgroundColor: C.surface, borderWidth: 1, borderStyle: "dashed", borderColor: C.border,
    borderRadius: 18, padding: 26,
  },
  trip: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 14,
  },
  tripEmoji: {
    width: 52, height: 52, borderRadius: 14, backgroundColor: C.gold + "14",
    borderWidth: 1, borderColor: C.gold + "30", alignItems: "center", justifyContent: "center",
  },
  tripTitle: { fontFamily: FONT.displaySemi, color: C.cream, fontSize: 17, letterSpacing: -0.2 },
}));
