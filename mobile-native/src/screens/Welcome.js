import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { C, themedStyles } from "../lib/theme.js";
import { useI18n } from "../lib/i18n.js";
import { FONT } from "../fonts.js";
import { Btn } from "../components/ui.js";
import { Globe, Sparkles, Zap } from "../icons.js";

export default function Welcome({ onDone }) {
  const { t } = useI18n();
  const SLIDES = [
    { Icon: Globe, title: t("w1t"), text: t("w1d") },
    { Icon: Sparkles, title: t("w2t"), text: t("w2d") },
    { Icon: Zap, title: t("w3t"), text: t("w3d") },
  ];
  const [i, setI] = useState(0);
  const last = i === SLIDES.length - 1;
  const s = SLIDES[i];

  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <View />
        <Pressable onPress={onDone} hitSlop={10}>
          <Text style={{ color: C.muted, fontSize: 15 }}>{t("skip")}</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={{ marginBottom: 14 }}><s.Icon size={88} color={C.gold} strokeWidth={1.4} /></View>
        <Text style={styles.title}>{s.title}</Text>
        <Text style={styles.text}>{s.text}</Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, j) => (
            <View key={j} style={{ width: j === i ? 26 : 8, height: 8, borderRadius: 4, backgroundColor: j === i ? C.gold : C.border }} />
          ))}
        </View>
        <Btn onPress={() => (last ? onDone() : setI(i + 1))}>
          {last ? t("getStarted") : t("continue")}
        </Btn>
      </View>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, paddingTop: 12 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 22, height: 44 },
  body: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 30, gap: 14 },
  emoji: { fontSize: 96, marginBottom: 14 },
  title: { fontFamily: FONT.display, fontSize: 32, color: C.cream, letterSpacing: -0.5, textAlign: "center" },
  text: { fontSize: 16, color: C.mutedLight, lineHeight: 26, textAlign: "center", maxWidth: 320 },
  footer: { paddingHorizontal: 22, paddingBottom: 30 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 7, marginBottom: 24 },
}));
