import { View, Text, Pressable, StyleSheet } from "react-native";
import { C, themedStyles } from "../lib/theme.js";
import { useI18n } from "../lib/i18n.js";
import { FONT } from "../fonts.js";
import { Home, Map, Camera, User } from "../icons.js";

export default function BottomNav({ active, onGo, badge }) {
  const { t } = useI18n();
  const tabs = [
    { key: "home", Icon: Home, label: t("navHome") },
    { key: "trips", Icon: Map, label: t("navTrips"), count: badge },
    { key: "gallery", Icon: Camera, label: t("navGallery") },
    { key: "me", Icon: User, label: t("navMe") },
  ];
  return (
    <View style={styles.bar}>
      {tabs.map((tab) => {
        const on = active === tab.key;
        return (
          <Pressable key={tab.key} onPress={() => onGo(tab.key)} style={styles.tab}>
            <tab.Icon size={20} color={on ? C.gold : C.mutedLight} strokeWidth={on ? 2.4 : 2} />
            <Text style={{ color: on ? C.gold : C.mutedLight, fontFamily: FONT.bold, fontSize: 11 }}>{tab.label}</Text>
            {tab.count > 0 && (
              <View style={styles.badge}><Text style={{ color: C.bg, fontFamily: FONT.extrabold, fontSize: 10 }}>{tab.count}</Text></View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  bar: {
    flexDirection: "row", justifyContent: "space-around",
    backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border,
    paddingTop: 8, paddingBottom: 10,
  },
  tab: { alignItems: "center", gap: 3, paddingVertical: 6, paddingHorizontal: 10, minWidth: 60, position: "relative" },
  badge: {
    position: "absolute", top: 2, right: 12, minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: C.gold, alignItems: "center", justifyContent: "center", paddingHorizontal: 4,
  },
}));
