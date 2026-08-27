// Reusable RN UI primitives — the native equivalents of the web app's
// components/ui.jsx (Btn, Chip, Label, Screen). Colours come from the copied
// theme palette `C`; gradients use expo-linear-gradient.

import { Pressable, Text, View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C, themedStyles } from "../lib/theme.js";
import { FONT } from "../fonts.js";

// Full-screen container with the app background.
//
// A plain View on purpose: App.js insets the whole tree once, from the real
// safe-area values. This used to be React Native's SafeAreaView, which would
// now inset a second time on iOS — and never did anything on Android anyway.
export function Screen({ children, style }) {
  return (
    <View style={[styles.screen, style]}>{children}</View>
  );
}

// Primary / ghost / soft / social button. Primary + gold → gradient fill.
// `icon` is an optional lucide component rendered before the label (SVG can't
// live inside <Text>, so the label becomes an icon+text row).
export function Btn({ children, onPress, variant = "primary", color = C.gold, icon: Icon, style, disabled }) {
  const isAccent = color === C.gold;
  const txtColor = variant === "primary" ? C.bg : color;
  const label = (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
      {Icon ? <Icon size={16} color={txtColor} /> : null}
      <Text
        style={{
          color: txtColor,
          fontFamily: FONT.bold,
          fontSize: 16,
          letterSpacing: 0.2,
          textAlign: "center",
        }}
      >
        {children}
      </Text>
    </View>
  );

  if (variant === "primary" && isAccent) {
    return (
      <Pressable
        onPress={disabled ? undefined : onPress}
        style={({ pressed }) => [
          { borderRadius: 16, overflow: "hidden", opacity: disabled ? 0.5 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
          style,
        ]}
      >
        <LinearGradient
          colors={[C.goldLight, C.gold]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.btnInner}
        >
          {label}
        </LinearGradient>
      </Pressable>
    );
  }

  const bg =
    variant === "primary" ? color
      : variant === "social" ? C.card
      : variant === "soft" ? color + "1c"
      : "transparent";
  const border =
    variant === "ghost" ? { borderWidth: 1.5, borderColor: color + "55" }
      : variant === "social" ? { borderWidth: 1, borderColor: C.border }
      : variant === "soft" ? { borderWidth: 1, borderColor: color + "40" }
      : null;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.btnInner,
        { backgroundColor: bg, opacity: disabled ? 0.5 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
        border,
        style,
      ]}
    >
      {label}
    </Pressable>
  );
}

export function Chip({ children, active, onPress, color = C.gold, icon: Icon }) {
  const txt = active ? C.bg : C.mutedLight;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? color : C.card,
          borderColor: active ? color : C.border,
          transform: [{ scale: pressed ? 0.96 : 1 }],
          flexDirection: "row", alignItems: "center", gap: 6,
        },
      ]}
    >
      {Icon ? <Icon size={14} color={txt} /> : null}
      <Text style={{ color: txt, fontFamily: FONT.semibold, fontSize: 14 }}>
        {children}
      </Text>
    </Pressable>
  );
}

export function Label({ children, color = C.muted, style }) {
  return (
    <Text style={[{ color, fontSize: 11, fontFamily: FONT.extrabold, letterSpacing: 2, textTransform: "uppercase" }, style]}>
      {children}
    </Text>
  );
}

// Editorial serif heading.
export function Display({ children, size = 26, style }) {
  return (
    <Text style={[{ fontFamily: FONT.display, color: C.cream, fontSize: size, letterSpacing: -0.3 }, style]}>
      {children}
    </Text>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  btnInner: {
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
}));
