import { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { C, useTheme, THEME_ACCENTS, themedStyles } from "../lib/theme.js";
import { useI18n, LANGS } from "../lib/i18n.js";
import { isPremium, unlockForTesting } from "../lib/premium.js";
import { FONT } from "../fonts.js";
import { Label } from "../components/ui.js";
import LegalSheet from "../components/LegalSheet.js";
import { User, Smile, Palette, Sun, Moon, Sparkles, Globe, Scale, Trash2, KeyRound, LogOut, Gem } from "../icons.js";

export default function Me({ user, saved, onLogout, onErase }) {
  const { t, lang, setLang } = useI18n();
  const { mode, accent, setMode, setAccent } = useTheme();
  const name = user?.name || t("traveler");
  const [legal, setLegal] = useState(false);
  const [devPremium, setDevPremium] = useState(isPremium());
  const [armErase, setArmErase] = useState(false);

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 22, paddingBottom: 30 }}>
      <Text style={styles.head}>{t("navMe")}</Text>

      <View style={styles.idCard}>
        <View style={styles.avatar}>{user?.guest ? <User size={32} color={C.bg} /> : <Smile size={32} color={C.bg} />}</View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{name}</Text>
          <Text style={{ color: C.mutedLight, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
            {user?.guest ? t("guestMode") : (user?.email || t("signedIn"))}
          </Text>
          <Text style={{ color: C.gold, fontFamily: FONT.bold, fontSize: 12, marginTop: 6 }}>
            {saved.length} {saved.length === 1 ? t("trip1") : t("tripN")}
          </Text>
        </View>
      </View>

      <Label color={C.gold}>{t("preferences")}</Label>
      <View style={styles.panel}>
        {/* Theme mode */}
        <View style={styles.row}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <Palette size={15} color={C.mutedLight} /><Text style={styles.rowLabel}>{t("themeLabel")}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {["light", "dark"].map((m) => (
              <Pressable key={m} onPress={() => setMode(m)} accessibilityLabel={t(m === "light" ? "themeLight" : "themeDark")} accessibilityState={{ selected: mode === m }} style={[styles.seg, mode === m && { backgroundColor: C.gold }]}>
                {m === "light"
                  ? <Sun size={15} color={mode === m ? C.bg : C.mutedLight} />
                  : <Moon size={15} color={mode === m ? C.bg : C.mutedLight} />}
              </Pressable>
            ))}
          </View>
        </View>

        {/* Accent swatches */}
        <View style={[styles.row, { borderTopWidth: 1, borderTopColor: C.border }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <Sparkles size={15} color={C.mutedLight} /><Text style={styles.rowLabel}>Accent</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {Object.entries(THEME_ACCENTS).map(([key, col]) => (
              <Pressable key={key} onPress={() => setAccent(key)} style={[styles.swatch, { backgroundColor: col, borderColor: accent === key ? C.cream : "transparent" }]} />
            ))}
          </View>
        </View>

        {/* Language */}
        <View style={[styles.row, { borderTopWidth: 1, borderTopColor: C.border, alignItems: "flex-start" }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginTop: 6 }}>
            <Globe size={15} color={C.mutedLight} /><Text style={styles.rowLabel}>{t("language")}</Text>
          </View>
          <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
            {LANGS.map((l) => (
              <Pressable key={l.code} onPress={() => setLang(l.code)} style={[styles.langChip, lang === l.code && { backgroundColor: C.gold, borderColor: C.gold }]}>
                <Text style={{ color: lang === l.code ? C.bg : C.mutedLight, fontFamily: FONT.semibold, fontSize: 13 }}>{l.flag} {l.code.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <Pressable onPress={() => setLegal(true)} style={styles.legalRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
          <Scale size={15} color={C.mutedLight} /><Text style={{ color: C.mutedLight, fontSize: 14 }}>{t("legalTitle")}</Text>
        </View>
        <Text style={{ color: C.muted, fontSize: 18 }}>›</Text>
      </Pressable>

      {/* Development only. __DEV__ is false in every release build, so this row
          cannot reach a user — and it grants the entitlement locally without
          touching the purchase flow, which is the only honest way to exercise
          the paid screens before billing exists. */}
      {__DEV__ && (
        <Pressable
          onPress={() => { unlockForTesting(!devPremium); setDevPremium((v) => !v); }}
          style={[styles.legalRow, { borderColor: C.purple + "55" }]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <Gem size={15} color={C.purple} />
            <Text style={{ color: C.purple, fontSize: 14 }}>
              DEV · premium {devPremium ? "ON" : "OFF"}
            </Text>
          </View>
          <Text style={{ color: C.purple, fontSize: 18 }}>›</Text>
        </Pressable>
      )}

      {/* Danger zone: erase all on-device data (two-step confirm) */}
      {onErase && (
        !armErase ? (
          <Pressable onPress={() => setArmErase(true)} style={styles.legalRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
              <Trash2 size={15} color={C.muted} /><Text style={{ color: C.muted, fontSize: 14 }}>{t("eraseData")}</Text>
            </View>
            <Text style={{ color: C.muted, fontSize: 18 }}>›</Text>
          </Pressable>
        ) : (
          <View style={{ marginTop: 16, backgroundColor: C.red + "10", borderWidth: 1, borderColor: C.red + "44", borderRadius: 18, padding: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <Trash2 size={15} color={C.red} /><Text style={{ color: C.red, fontFamily: FONT.bold, fontSize: 14 }}>{t("eraseData")}</Text>
            </View>
            <Text style={{ color: C.mutedLight, fontSize: 13, lineHeight: 19, marginBottom: 14 }}>{t("eraseDataWarn")}</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable onPress={() => setArmErase(false)} style={{ flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 13, alignItems: "center" }}>
                <Text style={{ color: C.cream, fontFamily: FONT.bold, fontSize: 14 }}>{t("cancel")}</Text>
              </Pressable>
              <Pressable onPress={onErase} style={{ flex: 1, backgroundColor: C.red, borderRadius: 12, paddingVertical: 13, alignItems: "center" }}>
                <Text style={{ color: "#fff", fontFamily: FONT.bold, fontSize: 14 }}>{t("eraseDataConfirm")}</Text>
              </Pressable>
            </View>
          </View>
        )
      )}

      {onLogout && (
        <Pressable onPress={onLogout} style={[styles.logout, { backgroundColor: user?.guest ? C.card : C.red + "12", borderColor: user?.guest ? C.border : C.red + "44" }]}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }}>
            {user?.guest ? <KeyRound size={15} color={C.gold} /> : <LogOut size={15} color={C.red} />}
            <Text style={{ color: user?.guest ? C.gold : C.red, fontFamily: FONT.bold, fontSize: 15 }}>
              {user?.guest ? t("authSignInCta") : t("authSignOut")}
            </Text>
          </View>
        </Pressable>
      )}

      {legal && <LegalSheet onClose={() => setLegal(false)} />}
    </ScrollView>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  head: { fontFamily: FONT.display, color: C.cream, fontSize: 28, letterSpacing: -0.4, marginBottom: 22 },
  idCard: { flexDirection: "row", alignItems: "center", gap: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.gold + "30", borderRadius: 20, padding: 18, marginBottom: 26 },
  avatar: { width: 68, height: 68, borderRadius: 34, backgroundColor: C.gold, alignItems: "center", justifyContent: "center" },
  name: { fontFamily: FONT.display, color: C.cream, fontSize: 22, letterSpacing: -0.3 },
  panel: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 18, marginTop: 12, paddingHorizontal: 14 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14 },
  rowLabel: { color: C.mutedLight, fontSize: 14 },
  legalRow: { marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 18, paddingVertical: 16, paddingHorizontal: 16 },
  logout: { marginTop: 14, borderWidth: 1, borderRadius: 18, paddingVertical: 15, alignItems: "center" },
  seg: { width: 42, height: 32, borderRadius: 10, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  swatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 2 },
  langChip: { borderWidth: 1, borderColor: C.border, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: C.bg },
}));
