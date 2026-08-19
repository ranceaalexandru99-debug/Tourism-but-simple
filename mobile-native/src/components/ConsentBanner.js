import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { C, themedStyles } from "../lib/theme.js";
import { useI18n } from "../lib/i18n.js";
import { FONT } from "../fonts.js";
import { Btn } from "./ui.js";
import LegalSheet from "./LegalSheet.js";
import { Lock } from "../icons.js";

// First-boot data/consent notice. Sits above everything, dismissed with OK.
export default function ConsentBanner({ onAccept }) {
  const { t } = useI18n();
  const [legal, setLegal] = useState(false);
  return (
    <>
      <View style={styles.bar}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <Lock size={14} color={C.gold} />
          <Text style={{ color: C.cream, fontFamily: FONT.bold, fontSize: 14 }}>{t("consentTitle")}</Text>
        </View>
        <Text style={{ color: C.mutedLight, fontSize: 13, lineHeight: 20, marginBottom: 14 }}>
          {t("consentBody")}{" "}
          <Text onPress={() => setLegal(true)} style={{ color: C.gold, fontFamily: FONT.bold, textDecorationLine: "underline" }}>
            {t("consentLink")}
          </Text>
        </Text>
        <Btn onPress={onAccept}>{t("consentOk")}</Btn>
      </View>
      {legal && <LegalSheet onClose={() => setLegal(false)} />}
    </>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  bar: {
    position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 50,
    backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24,
  },
}));
