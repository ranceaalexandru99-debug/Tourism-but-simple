import { useEffect, useRef } from "react";
import { View, Text, Animated, Easing, ActivityIndicator, StyleSheet } from "react-native";
import { C, themedStyles } from "../lib/theme.js";
import { useI18n } from "../lib/i18n.js";
import { FONT } from "../fonts.js";
import { Map } from "../icons.js";

export default function Splash({ onDone }) {
  const { t } = useI18n();
  const float = useRef(new Animated.Value(0)).current;

  // The parent recreates `onDone` on every render, so listing it as a
  // dependency restarted the 1800 ms timer (the splash could outstay its
  // welcome) and spawned another animation loop each time, none of which were
  // ever stopped. Hold it in a ref and run the effect exactly once.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: -8, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    const timer = setTimeout(() => onDoneRef.current(), 1800);
    return () => { clearTimeout(timer); loop.stop(); };
  }, [float]);

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.map, { transform: [{ translateY: float }] }]}>
        <Map size={72} color={C.gold} strokeWidth={1.3} />
      </Animated.View>
      <Text style={styles.word}>
        Turism,{"\n"}<Text style={{ color: C.gold, fontStyle: "italic" }}>dar simplu!</Text>
      </Text>
      <Text style={styles.tag}>{t("tagline")}</Text>
      <ActivityIndicator size="small" color={C.gold} style={{ marginTop: 26 }} />
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", gap: 16 },
  map: { fontSize: 76 },
  word: { fontFamily: FONT.display, fontSize: 40, color: C.cream, letterSpacing: -0.8, textAlign: "center", lineHeight: 42 },
  tag: { color: C.muted, fontSize: 15, marginTop: 4 },
}));
