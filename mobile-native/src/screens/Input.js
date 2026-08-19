import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { C, themedStyles } from "../lib/theme.js";
import { useI18n } from "../lib/i18n.js";
import { FONT } from "../fonts.js";
import { Btn } from "../components/ui.js";

// Minimal destination input. Autocomplete (Nominatim) + quick chips are a
// follow-up; this proves the generate flow with the copied mock engine.
export default function Input({ initial, onBack, onSubmit }) {
  const { t } = useI18n();
  const [text, setText] = useState(initial || "");
  const ready = text.trim().length > 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={{ color: C.cream, fontSize: 26 }}>‹</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 24 }}>
        <Text style={styles.title}>{t("inputTitle")}</Text>
        <Text style={styles.hint}>{t("inputHint")}</Text>

        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t("inputPh")}
          placeholderTextColor={C.muted}
          multiline
          style={styles.input}
          autoFocus
        />
      </View>

      <View style={{ padding: 24 }}>
        <Btn onPress={() => ready && onSubmit(text.trim())} disabled={!ready}>
          {t("continue")} →
        </Btn>
      </View>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  header: { height: 44, justifyContent: "center", paddingHorizontal: 16 },
  title: { fontFamily: FONT.display, color: C.cream, fontSize: 30, letterSpacing: -0.5, marginTop: 10, marginBottom: 8 },
  hint: { color: C.muted, fontSize: 14, marginBottom: 20 },
  input: {
    minHeight: 120, backgroundColor: C.card, borderWidth: 1, borderColor: C.gold + "40",
    borderRadius: 18, padding: 16, color: C.cream, fontSize: 17, fontFamily: FONT.body,
    textAlignVertical: "top",
  },
}));
