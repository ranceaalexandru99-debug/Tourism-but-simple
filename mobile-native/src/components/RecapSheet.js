import { View, Text, Image, Pressable, Modal, ScrollView, StyleSheet } from "react-native";
import { C, themedStyles } from "../lib/theme.js";
import { useI18n, tripTitle } from "../lib/i18n.js";
import { computeTripStats } from "../lib/utils.js";
import { listMemories } from "../lib/gallery.js";
import { FONT } from "../fonts.js";
import { Btn } from "./ui.js";
import PoiImage from "./PoiImage.js";
import { PartyPopper, CircleCheck, Footprints, Camera, Share2, CategoryIcon } from "../icons.js";

// End-of-trip recap: cover, headline stats, and a collage of the photos linked
// to this trip (native gallery memories).
export default function RecapSheet({ route, onClose, onShare }) {
  const { t } = useI18n();
  const stats = computeTripStats(route);
  const photos = listMemories().filter((m) => m.tripId === route.id);

  const cats = stats ? Object.entries(stats.categories).sort((a, b) => b[1] - a[1]).slice(0, 4) : [];
  const cards = stats ? [
    { Icon: CircleCheck, label: t("statsVisited"), value: `${stats.visitedCount}/${stats.totalCount}` },
    { Icon: Footprints, label: t("statsWalked"), value: stats.kmWalked > 0 ? `${stats.kmWalked.toFixed(1)} km` : "—" },
    { Icon: Camera, label: t("recapPhotos"), value: String(photos.length) },
  ] : [];

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={{ height: 140 }}>
            <PoiImage name={route.destName} emoji={route.emoji} tags={route.interests} height={140} radius={0} fontSize={64} />
            <View style={styles.grab} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 22 }}>
            <View style={{ alignItems: "center" }}><PartyPopper size={28} color={C.gold} /></View>
            <Text style={styles.title}>{t("recapTitle")}</Text>
            <Text style={styles.sub}>{tripTitle(route, t)}</Text>

            <View style={{ flexDirection: "row", gap: 8, marginBottom: cats.length ? 14 : 18 }}>
              {cards.map((s) => (
                <View key={s.label} style={styles.stat}>
                  <s.Icon size={17} color={C.gold} />
                  <Text style={styles.statVal}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>

            {cats.length > 0 && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 18, justifyContent: "center" }}>
                {cats.map(([cat, n]) => (
                  <View key={cat} style={[styles.catChip, { flexDirection: "row", alignItems: "center", gap: 5 }]}>
                    <CategoryIcon tags={cat} size={12} color={C.gold} />
                    <Text style={{ color: C.gold, fontFamily: FONT.bold, fontSize: 12 }}>{t("int" + cat) || cat} · {n}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <Camera size={13} color={C.muted} />
              <Text style={[styles.section, { marginBottom: 0 }]}>{t("recapPhotos")}</Text>
            </View>
            {photos.length > 0 ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
                {photos.map((m) => (
                  <Image key={m.id} source={{ uri: m.uri }} style={styles.thumb} resizeMode="cover" />
                ))}
              </View>
            ) : (
              <View style={styles.noPhotos}><Text style={{ color: C.muted, fontSize: 13, textAlign: "center" }}>{t("recapNoPhotos")}</Text></View>
            )}

            <Btn icon={Share2} onPress={onShare}>{t("recapShare")}</Btn>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "#000c", justifyContent: "flex-end" },
  sheet: { backgroundColor: C.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: "hidden", maxHeight: "92%" },
  grab: { position: "absolute", top: 12, alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: "#fff8" },
  title: { fontFamily: FONT.display, color: C.cream, fontSize: 24, letterSpacing: -0.4, textAlign: "center", marginBottom: 2 },
  sub: { fontFamily: FONT.displaySemi, color: C.gold, fontSize: 17, fontStyle: "italic", textAlign: "center", marginBottom: 18 },
  stat: { flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.border, alignItems: "center" },
  statVal: { fontFamily: FONT.display, color: C.cream, fontSize: 19, marginTop: 4, letterSpacing: -0.3 },
  statLabel: { color: C.muted, fontSize: 10, fontFamily: FONT.extrabold, letterSpacing: 0.5, textTransform: "uppercase", marginTop: 2 },
  catChip: { backgroundColor: C.gold + "18", borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12 },
  section: { color: C.muted, fontSize: 11, fontFamily: FONT.extrabold, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 },
  thumb: { width: "31.5%", aspectRatio: 1, borderRadius: 10, backgroundColor: C.card },
  noPhotos: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 20, marginBottom: 18 },
}));
