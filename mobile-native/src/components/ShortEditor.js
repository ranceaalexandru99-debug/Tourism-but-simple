import { useState } from "react";
import { View, Text, Image, Pressable, ScrollView, Modal, StyleSheet } from "react-native";
import { C, themedStyles } from "../lib/theme.js";
import { useI18n } from "../lib/i18n.js";
import { FONT } from "../fonts.js";
import { Btn } from "./ui.js";
import {
  makeRecipe, moveItem, toggleAt, setSecAt, applyRecipe, totalSeconds, clampSec,
  MIN_SEC, MAX_SEC,
} from "../lib/shortEdit.js";
import { Film, X, ChevronUp, ChevronDown, Check } from "../icons.js";

// Choose what goes into the short before spending real time rendering it.
//
// The recipe lives in shortEdit.js, shared verbatim with the web app; this file
// is only the phone's way of editing it. Same decisions, same arithmetic, same
// resulting video — which is the whole point of keeping that module separate.
//
// No slider component: React Native has no built-in one, and pulling in a
// package for a value with four useful steps is not worth the dependency. The
// step buttons are also easier to hit precisely on a phone than a 40pt slider.
const STEP = 0.3;

export default function ShortEditor({ scenes, visible, onCancel, onRender }) {
  const { t } = useI18n();
  const [recipe, setRecipe] = useState(() => makeRecipe(scenes));

  const chosen = applyRecipe(scenes, recipe);
  // Must match the encoder's own INTRO/OUTRO, which the WebView page defines.
  const seconds = totalSeconds(chosen, 2.0, 1.5);
  const nothing = chosen.length === 0;

  const byKey = {};
  scenes.forEach((s, i) => { byKey[s?.photo?.id ?? `i${i}`] = s; });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.head}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Film size={17} color={C.gold} />
              <Text style={styles.title}>{t("shortEditTitle")}</Text>
            </View>
            <Pressable onPress={onCancel} accessibilityLabel={t("cancel")} hitSlop={10}>
              <X size={19} color={C.muted} />
            </Pressable>
          </View>

          <Text style={styles.hint}>{t("shortEditHint")}</Text>

          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 18 }}>
            {recipe.map((item, i) => {
              const scene = byKey[item.key];
              if (!scene) return null;
              const bump = (delta) => setRecipe((r) => setSecAt(r, i, clampSec(item.sec + delta)));
              return (
                <View key={item.key} style={[styles.row, { opacity: item.include ? 1 : 0.45 }]}>
                  <Image source={{ uri: scene.photo.dataUrl }} style={styles.thumb} />

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.caption} numberOfLines={1}>
                      {scene.photo.caption || scene.place || t("albumPhotos")}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                      <Pressable
                        onPress={() => bump(-STEP)}
                        disabled={!item.include || item.sec <= MIN_SEC}
                        accessibilityLabel={t("shortEditSeconds")}
                        style={[styles.step, (!item.include || item.sec <= MIN_SEC) && styles.stepOff]}
                      ><Text style={styles.stepText}>−</Text></Pressable>
                      <Text style={styles.secs}>{item.sec.toFixed(1)}s</Text>
                      <Pressable
                        onPress={() => bump(STEP)}
                        disabled={!item.include || item.sec >= MAX_SEC}
                        accessibilityLabel={t("shortEditSeconds")}
                        style={[styles.step, (!item.include || item.sec >= MAX_SEC) && styles.stepOff]}
                      ><Text style={styles.stepText}>+</Text></Pressable>
                    </View>
                  </View>

                  <View style={{ gap: 3 }}>
                    <Pressable
                      onPress={() => setRecipe((r) => moveItem(r, i, i - 1))}
                      disabled={i === 0}
                      accessibilityLabel={t("shortEditUp")}
                      style={[styles.arrow, i === 0 && styles.arrowOff]}
                    ><ChevronUp size={14} color={i === 0 ? C.border : C.mutedLight} /></Pressable>
                    <Pressable
                      onPress={() => setRecipe((r) => moveItem(r, i, i + 1))}
                      disabled={i === recipe.length - 1}
                      accessibilityLabel={t("shortEditDown")}
                      style={[styles.arrow, i === recipe.length - 1 && styles.arrowOff]}
                    ><ChevronDown size={14} color={i === recipe.length - 1 ? C.border : C.mutedLight} /></Pressable>
                  </View>

                  <Pressable
                    onPress={() => setRecipe((r) => toggleAt(r, i))}
                    accessibilityLabel={t("shortEditInclude")}
                    accessibilityState={{ selected: item.include }}
                    style={[styles.check, item.include && { backgroundColor: C.gold, borderColor: C.gold }]}
                  >{item.include ? <Check size={14} color={C.bg} strokeWidth={3} /> : null}</Pressable>
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.foot}>
            <Text style={styles.total}>
              {nothing
                ? t("shortEditEmpty")
                : t("shortEditLength", { n: chosen.length, s: seconds.toFixed(1) })}
            </Text>
            <Btn disabled={nothing} onPress={() => onRender(recipe)}>{t("shortEditRender")}</Btn>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "#000A", justifyContent: "flex-end" },
  sheet: { maxHeight: "92%", backgroundColor: C.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: C.border },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  title: { fontFamily: FONT.display, color: C.cream, fontSize: 18 },
  hint: { color: C.muted, fontSize: 13, lineHeight: 19, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.border },
  thumb: { width: 46, height: 46, borderRadius: 9, backgroundColor: C.card },
  caption: { color: C.cream, fontSize: 13, fontFamily: FONT.semibold },
  secs: { color: C.mutedLight, fontSize: 12, width: 38, textAlign: "center" },
  step: { width: 30, height: 26, borderRadius: 7, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center", backgroundColor: C.bg },
  stepOff: { opacity: 0.4 },
  stepText: { color: C.cream, fontSize: 15, fontFamily: FONT.bold, lineHeight: 18 },
  arrow: { borderWidth: 1, borderColor: C.border, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
  arrowOff: { opacity: 0.4 },
  check: { width: 26, height: 26, borderRadius: 8, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  foot: { padding: 18, borderTopWidth: 1, borderTopColor: C.border },
  total: { color: C.muted, fontSize: 13, textAlign: "center", marginBottom: 10 },
}));
