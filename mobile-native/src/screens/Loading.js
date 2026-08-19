import { useEffect, useState, useRef } from "react";
import { View, Text, Animated, Easing, StyleSheet } from "react-native";
import { C, themedStyles } from "../lib/theme.js";
import { useI18n } from "../lib/i18n.js";
import { FONT } from "../fonts.js";
import { Map, Check } from "../icons.js";

const STEP_KEYS = ["step1", "step2", "step3", "step4"];

export default function Loading({ destName }) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const float = useRef(new Animated.Value(0)).current;

  // Advance through the steps but stop at the last one, which stays "active"
  // until the parent navigates away once the route is actually ready.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: -8, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    const timers = STEP_KEYS.slice(0, -1).map((_, i) => setTimeout(() => setStep(i + 1), 650 * (i + 1)));
    // The loop kept running after unmount — stop it with the timers.
    return () => { timers.forEach(clearTimeout); loop.stop(); };
  }, [float]);

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.map, { transform: [{ translateY: float }] }]}>
        <Map size={60} color={C.gold} strokeWidth={1.3} />
      </Animated.View>
      <Text style={styles.title}>{t("loadTitle")}</Text>
      <Text style={styles.for}>{t("loadFor", { name: destName })}</Text>

      <View style={{ width: "100%", maxWidth: 300, gap: 14, marginTop: 10 }}>
        {STEP_KEYS.map((k, i) => {
          const state = i < step ? "done" : i === step ? "active" : "idle";
          return (
            <View key={k} style={[styles.step, { opacity: state === "idle" ? 0.35 : 1 }]}>
              <View style={[
                styles.dot,
                {
                  backgroundColor: state === "done" ? C.green : state === "active" ? "transparent" : C.border,
                  borderWidth: state === "active" ? 2 : 0, borderColor: C.gold,
                },
              ]}>
                {state === "done" && <Check size={13} color={C.bg} strokeWidth={3.2} />}
              </View>
              <Text style={{ color: state === "idle" ? C.muted : C.cream, fontSize: 15 }}>{t(k)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 8 },
  map: { fontSize: 64, marginBottom: 10 },
  title: { fontFamily: FONT.display, color: C.cream, fontSize: 24, textAlign: "center", letterSpacing: -0.3 },
  for: { fontFamily: FONT.displaySemi, color: C.gold, fontSize: 18, fontStyle: "italic", marginBottom: 30 },
  step: { flexDirection: "row", alignItems: "center", gap: 12 },
  dot: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
}));
