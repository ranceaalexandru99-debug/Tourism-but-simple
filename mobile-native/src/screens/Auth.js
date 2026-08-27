import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, ScrollView, Platform } from "react-native";
import { C, themedStyles } from "../lib/theme.js";
import { useI18n } from "../lib/i18n.js";
import { FONT } from "../fonts.js";
import { Btn } from "../components/ui.js";
import { signIn, signUp } from "../lib/auth.js";
import { Lock, Eye, EyeOff, TriangleAlert } from "../icons.js";
import PoiImage from "../components/PoiImage.js";
import { LinearGradient } from "expo-linear-gradient";

// Featured destinations for the login hero collage (middle one wider).
const HERO_CITIES = ["Paris", "Roma", "Tokyo"];

export default function Auth({ onAuth }) {
  const { t } = useI18n();
  const [mode, setMode] = useState("login"); // login | signup
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [err, setErr] = useState("");
  const [errCode, setErrCode] = useState("");
  const [busy, setBusy] = useState(false);

  // Clear a stale error the moment the user edits a field.
  const edit = (setter) => (v) => { if (err) { setErr(""); setErrCode(""); } setter(v); };

  const submit = async () => {
    setErr(""); setErrCode(""); setBusy(true);
    try {
      const user = mode === "signup"
        ? await signUp({ email, password: pass, name })
        : await signIn({ email, password: pass });
      onAuth(user);
    } catch (e) {
      // t() echoes the key back when it is missing, so the || fallback never
      // fired and users saw a raw "authErr_<message>" string.
      const key = "authErr_" + e.message;
      const msg = t(key);
      setErr(msg === key ? t("authErrGeneric") : msg);
      setErrCode(e.message);
    } finally {
      setBusy(false);
    }
  };

  const swap = () => { setMode(mode === "login" ? "signup" : "login"); setErr(""); setErrCode(""); };

  return (
    // The form is taller than a small phone once the keyboard is up, so it both
    // lifts (iOS, which does not resize the window) and scrolls. Android resizes
    // the window itself — adding `behavior` there fights it and clips the form.
    // keyboardShouldPersistTaps: without it the first tap on "Sign in" only
    // dismisses the keyboard and the user has to press twice.
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
    <ScrollView
      contentContainerStyle={styles.wrap}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Destination hero collage */}
      <View style={styles.hero}>
        {HERO_CITIES.map((city, i) => (
          <View key={city} style={[styles.heroTile, { flex: i === 1 ? 1.35 : 1 }]}>
            <PoiImage name={city} width="100%" height="100%" radius={0} fontSize={28} />
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.6)"]}
              locations={[0.45, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <Text style={styles.heroLabel}>{city}</Text>
          </View>
        ))}
      </View>

      <View style={styles.badge}><Lock size={24} color={C.gold} strokeWidth={1.8} /></View>
      <Text style={styles.title}>{mode === "signup" ? t("authSignupTitle") : t("authTitle")}</Text>
      <Text style={styles.sub}>{mode === "signup" ? t("authSignupSub") : t("authSub")}</Text>

      {mode === "signup" && (
        <TextInput style={styles.input} placeholder={t("authName")} placeholderTextColor={C.muted}
          value={name} onChangeText={edit(setName)} autoCapitalize="words" />
      )}
      <TextInput style={styles.input} placeholder={t("email")} placeholderTextColor={C.muted}
        value={email} onChangeText={edit(setEmail)} autoCapitalize="none" keyboardType="email-address" />

      {/* Password with show/hide toggle */}
      <View style={{ position: "relative", marginBottom: mode === "signup" ? 4 : 10 }}>
        <TextInput style={[styles.input, { marginBottom: 0, paddingRight: 52 }]} placeholder={t("password")} placeholderTextColor={C.muted}
          value={pass} onChangeText={edit(setPass)} secureTextEntry={!showPass} />
        <Pressable onPress={() => setShowPass((v) => !v)} hitSlop={8}
          style={{ position: "absolute", right: 6, top: 0, bottom: 0, paddingHorizontal: 12, justifyContent: "center" }}
          accessibilityLabel={showPass ? t("authHidePass") : t("authShowPass")}>
          {showPass ? <EyeOff size={18} color={C.muted} /> : <Eye size={18} color={C.muted} />}
        </Pressable>
      </View>
      {mode === "signup" && (
        <Text style={{ color: C.muted, fontSize: 12, marginBottom: 12, marginLeft: 2 }}>{t("authPassHint")}</Text>
      )}

      {!!err && (
        <View style={styles.err}>
          <Text style={{ color: C.red, fontSize: 13 }}>
            {err}
            {(errCode === "nouser" || errCode === "exists") && (
              <Text onPress={swap} style={{ color: C.gold, fontFamily: FONT.bold }}>
                {"  "}{errCode === "nouser" ? t("authErrCreateCta") : t("authErrSignInCta")}
              </Text>
            )}
          </Text>
        </View>
      )}

      <Btn onPress={submit} disabled={busy} style={{ marginTop: 4 }}>
        {busy ? "…" : (mode === "signup" ? t("authCreate") : t("authLogin"))}
      </Btn>

      <View style={styles.swapRow}>
        <Text style={{ color: C.muted, fontSize: 14 }}>
          {mode === "signup" ? t("authHaveAccount") : t("authNoAccount")}{" "}
        </Text>
        <Pressable onPress={swap} hitSlop={8}>
          <Text style={{ color: C.gold, fontFamily: FONT.bold, fontSize: 14 }}>
            {mode === "signup" ? t("authLogin") : t("authCreate")}
          </Text>
        </Pressable>
      </View>

      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={{ color: C.muted, fontSize: 12 }}>{t("authOr")}</Text>
        <View style={styles.line} />
      </View>

      <Btn variant="ghost" color={C.muted} onPress={() => onAuth({ name: null, guest: true, method: "guest" })}>
        {t("authGuest")}
      </Btn>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  // Used as a ScrollView contentContainerStyle now, so it grows rather than fills.
  wrap: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 20 },
  hero: { flexDirection: "row", gap: 8, height: 112, marginBottom: 18 },
  heroTile: { position: "relative", borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: C.gold + "25" },
  heroLabel: { position: "absolute", left: 8, bottom: 6, color: "#fff", fontSize: 11, fontFamily: FONT.bold, letterSpacing: 0.2 },
  badge: {
    width: 52, height: 52, borderRadius: 16, alignSelf: "center", marginBottom: 12,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.gold + "35",
    alignItems: "center", justifyContent: "center",
  },
  title: { fontFamily: FONT.display, color: C.cream, fontSize: 28, letterSpacing: -0.4, textAlign: "center", marginBottom: 6 },
  sub: { color: C.muted, fontSize: 14, textAlign: "center", marginBottom: 22 },
  input: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 16, color: C.cream, fontSize: 15,
    marginBottom: 10, fontFamily: FONT.body,
  },
  err: { backgroundColor: C.red + "14", borderWidth: 1, borderColor: C.red + "44", borderRadius: 10, padding: 9, marginBottom: 10 },
  swapRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 16 },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 18 },
  line: { flex: 1, height: 1, backgroundColor: C.border },
}));
