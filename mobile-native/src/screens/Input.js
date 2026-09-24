import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { C, themedStyles } from "../lib/theme.js";
import { useI18n } from "../lib/i18n.js";
import { FONT } from "../fonts.js";
import { Btn } from "../components/ui.js";
import { searchDestinations } from "../lib/destinations.js";
import { countryName, flagOf } from "../lib/countryNames.js";
import { headOf, replaceHead, shouldSuggest } from "../lib/destinationInput.js";

// Destination input, with autocomplete over the 5000-city index.
//
// The index has always shipped inside the bundle, but nothing imported it, so
// until the explore map arrived it was dead weight that never reached the
// bundle at all. Now that it is paid for, the search that was always meant to
// go here costs nothing extra.
//
// Local only, unlike the web copy. There the curated index lives in Supabase
// and can be unreachable, so it falls back to Nominatim; here it is on the
// device, so a lookup is a filter over memory: instant, offline, and with no
// failure mode. A destination the index does not know is still perfectly
// typeable — the dropdown simply stays shut, and the engine takes free text.
export default function Input({ initial, onBack, onSubmit }) {
  const { t, lang } = useI18n();
  const [text, setText] = useState(initial || "");
  const [suggestions, setSuggestions] = useState([]);
  // The destination the user explicitly picked (or arrived with). Once the head
  // of the text matches it, autocomplete stays quiet, so adding details after a
  // comma doesn't keep reopening the list over what they are typing.
  const pickedRef = useRef(initial ? headOf(initial) : null);
  const ready = text.trim().length > 0;

  useEffect(() => {
    if (!shouldSuggest(text, pickedRef.current)) { setSuggestions([]); return; }
    const head = headOf(text);
    // Debounced even though the lookup is local: it scans 5000 rows for every
    // alias the query could mean, and doing that on each keystroke of a fast
    // typist is work thrown away before anyone sees it.
    const timer = setTimeout(() => {
      const hits = searchDestinations(head, 6);
      setSuggestions(hits.map((d) => ({
        name: d.n,
        cc: d.c,
        country: countryName(d.c, lang) || d.c,
      })));
    }, 180);
    return () => clearTimeout(timer);
  }, [text, lang]);

  // Replace only the destination portion, leaving anything after the first
  // comma alone — that is the part the user wrote about their trip.
  const pickCity = (s) => {
    setText(replaceHead(text, s.name));
    pickedRef.current = s.name;
    setSuggestions([]);
  };

  return (
    // The field is autoFocus, so the keyboard is up the moment this screen
    // opens — and "Continue" sits at the bottom. Without this the user could
    // type a destination and have no way to reach the button on iOS.
    <KeyboardAvoidingView
      style={styles.wrap}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} accessibilityLabel={t("back")}>
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

        {suggestions.length > 0 && (
          // Scrolls, and keeps taps alive while the keyboard is up: without
          // keyboardShouldPersistTaps the first tap only dismisses the
          // keyboard, so picking a city takes two taps and looks broken.
          <ScrollView
            style={styles.suggest}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 6 }}
          >
            {suggestions.map((s, i) => (
              <Pressable
                key={`${s.name}-${s.cc}-${i}`}
                onPress={() => pickCity(s)}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: C.card }]}
              >
                <Text style={{ fontSize: 22 }}>{flagOf(s.cc)}</Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.rowName} numberOfLines={1}>{s.name}</Text>
                  <Text style={styles.rowCountry} numberOfLines={1}>{s.country}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      <View style={{ padding: 24 }}>
        <Btn onPress={() => ready && onSubmit(text.trim())} disabled={!ready}>
          {t("continue")} →
        </Btn>
      </View>
    </KeyboardAvoidingView>
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
  suggest: {
    marginTop: 8, maxHeight: 260, backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border, borderRadius: 14,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  rowName: { color: C.cream, fontFamily: FONT.semibold, fontSize: 15 },
  rowCountry: { color: C.muted, fontSize: 12, fontFamily: FONT.body },
}));
