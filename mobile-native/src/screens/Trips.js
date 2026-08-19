import { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { C, themedStyles } from "../lib/theme.js";
import { useI18n, tripTitle } from "../lib/i18n.js";
import { tripStatus } from "../lib/utils.js";
import { countryFlag } from "../lib/locale.js";
import { FONT } from "../fonts.js";
import { Label } from "../components/ui.js";
import { Trash2, Map, MapPin, Clock, Undo2, CategoryIcon } from "../icons.js";

export default function Trips({ saved, onOpen, onDelete, onRestore }) {
  const { t } = useI18n();
  const [confirmId, setConfirmId] = useState(null);
  const [undoTrip, setUndoTrip] = useState(null);

  const removeTrip = (r) => {
    onDelete(r.id); setConfirmId(null); setUndoTrip(r);
    setTimeout(() => setUndoTrip((cur) => (cur === r ? null : cur)), 6000);
  };
  const restoreTrip = () => { if (undoTrip) { onRestore?.(undoTrip); setUndoTrip(null); } };
  const groups = { ongoing: [], upcoming: [], past: [], unknown: [] };
  for (const r of saved) {
    const s = tripStatus(r);
    groups[s ? s.phase : "unknown"].push(r);
  }

  const Group = ({ items, label, tint }) => {
    if (items.length === 0) return null;
    return (
      <View style={{ marginBottom: 22 }}>
        <Label color={tint}>{label}</Label>
        <View style={{ marginTop: 10, gap: 10 }}>
          {items.map((r) => {
            const s = tripStatus(r);
            if (confirmId === r.id) {
              return (
                <View key={r.id} style={styles.confirm}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Trash2 size={15} color={C.red} />
                      <Text style={{ color: C.red, fontFamily: FONT.bold, fontSize: 15 }}>{t("tripDeleteConfirm")}</Text>
                    </View>
                    <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{countryFlag(r.country)} {tripTitle(r, t)}</Text>
                  </View>
                  <Pressable onPress={() => setConfirmId(null)} style={styles.cancelBtn}>
                    <Text style={{ color: C.mutedLight, fontFamily: FONT.bold, fontSize: 13 }}>{t("cancel")}</Text>
                  </Pressable>
                  <Pressable onPress={() => removeTrip(r)} style={styles.delBtn}>
                    <Text style={{ color: "#fff", fontFamily: FONT.extrabold, fontSize: 13 }}>{t("galDelete")}</Text>
                  </Pressable>
                </View>
              );
            }
            return (
              <View key={r.id} style={[styles.trip, { opacity: s?.phase === "past" ? 0.55 : 1 }]}>
                <Pressable onPress={() => onOpen(r)} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 14 }}>
                  <View style={[styles.emoji, { backgroundColor: tint + "18", borderColor: tint + "30" }]}>
                    <CategoryIcon tags={r.interests} size={24} color={tint} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title} numberOfLines={1}>{countryFlag(r.country)} {tripTitle(r, t)}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
                    <MapPin size={12} color={C.muted} />
                    <Text style={{ color: C.muted, fontSize: 13 }}>{r.totalStops} {t("stops")} ·</Text>
                    <Clock size={12} color={C.muted} />
                    <Text style={{ color: C.muted, fontSize: 13 }}>~{r.totalHours}h</Text>
                  </View>
                  </View>
                </Pressable>
                {onDelete && (
                  <Pressable onPress={() => setConfirmId(r.id)} hitSlop={8} style={{ paddingHorizontal: 6 }}>
                    <Trash2 size={17} color={C.muted} />
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 22, paddingBottom: 30 }}>
        <Text style={styles.head}>{t("navTrips")}</Text>
        {saved.length === 0 && (
          <View style={styles.empty}>
            <View style={{ marginBottom: 12, opacity: 0.6 }}><Map size={44} color={C.muted} strokeWidth={1.4} /></View>
            <Text style={{ color: C.muted, fontSize: 14, textAlign: "center", lineHeight: 22 }}>{t("noTrips")}{"\n"}{t("noTripsSub")}</Text>
          </View>
        )}
        <Group items={groups.ongoing} label={t("tripsOngoing")} tint={C.green} />
        <Group items={groups.upcoming} label={t("tripsUpcoming")} tint={C.gold} />
        <Group items={groups.unknown} label={t("tripsOther")} tint={C.blue} />
        <Group items={groups.past} label={t("tripsPast")} tint={C.muted} />
      </ScrollView>

      {undoTrip && (
        <View style={styles.snackbar}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 7 }}>
            <Trash2 size={14} color={C.cream} />
            <Text style={{ color: C.cream, fontSize: 14 }}>{t("tripDeleted")}</Text>
          </View>
          <Pressable onPress={restoreTrip} style={[styles.undoBtn, { flexDirection: "row", alignItems: "center", gap: 5 }]}>
            <Undo2 size={13} color={C.gold} />
            <Text style={{ color: C.gold, fontFamily: FONT.extrabold, fontSize: 13 }}>{t("undo")}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  head: { fontFamily: FONT.display, color: C.cream, fontSize: 28, letterSpacing: -0.4, marginBottom: 22 },
  empty: { backgroundColor: C.surface, borderWidth: 1, borderStyle: "dashed", borderColor: C.border, borderRadius: 18, padding: 34, alignItems: "center" },
  trip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 14 },
  emoji: { width: 52, height: 52, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: FONT.displaySemi, color: C.cream, fontSize: 17, letterSpacing: -0.2 },
  confirm: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.red + "12", borderWidth: 1, borderColor: C.red + "44", borderRadius: 18, padding: 14 },
  cancelBtn: { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14 },
  delBtn: { backgroundColor: C.red, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14 },
  snackbar: { position: "absolute", left: 16, right: 16, bottom: 16, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
  undoBtn: { backgroundColor: C.gold + "1c", borderWidth: 1, borderColor: C.gold + "55", borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16 },
}));
