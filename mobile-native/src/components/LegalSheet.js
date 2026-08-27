import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { C, themedStyles } from "../lib/theme.js";
import { useI18n } from "../lib/i18n.js";
import { FONT } from "../fonts.js";
import { Scale, X } from "../icons.js";

// Privacy + Terms summary, shown from the Me tab and the consent banner.
// Concise, honest template — have a lawyer review before a real launch.
const LEGAL = {
  en: {
    updated: "Last updated: July 2026",
    privacyTitle: "Privacy Policy",
    privacy: [
      ["On your device", "Your saved trips, searches, preferences, account and photos are stored on your device, not on our servers."],
      ["Camera", "With your permission, the camera is used only to photograph attractions for your trip gallery. Photos stay on this device."],
      ["Third parties", "Itineraries are built on this device. We fetch attraction photos from Wikipedia and Wikimedia Commons — those requests carry no personal data."],
      ["Photo credits", "Attraction photos come from Wikipedia and Wikimedia Commons under their respective Creative Commons licenses."],
      ["No account server", "No backend, no ads, no tracking, no data selling. Sharing a trip sends plain text through the app you pick."],
      ["Your choices", "Delete a trip/photo or clear app data anytime. For GDPR requests, contact us below."],
    ],
    termsTitle: "Terms of Use",
    terms: [
      ["Informational only", "Itineraries, prices, hours and travel times are estimates and may be inaccurate. Reconfirm with official sources before you travel."],
      ["Your responsibility", "You are responsible for your safety, bookings and decisions. We aren't liable for losses from use of the app."],
    ],
    contact: "Contact: rancea.alexandru99@gmail.com",
  },
  ro: {
    updated: "Ultima actualizare: iulie 2026",
    privacyTitle: "Politica de confidențialitate",
    privacy: [
      ["Pe dispozitivul tău", "Traseele, căutările, preferințele, contul și pozele sunt stocate pe dispozitiv, nu pe serverele noastre."],
      ["Camera", "Cu permisiunea ta, camera e folosită doar ca să fotografiezi atracții pentru galeria călătoriei. Pozele rămân pe dispozitiv."],
      ["Terți", "Traseele se construiesc pe dispozitiv. Aducem pozele atracțiilor de la Wikipedia și Wikimedia Commons — cereri fără date personale."],
      ["Credite foto", "Pozele atracțiilor provin din Wikipedia și Wikimedia Commons, sub licențele Creative Commons corespunzătoare."],
      ["Fără server de conturi", "Fără backend, reclame, urmărire sau vânzare de date. Partajarea trimite text simplu prin aplicația aleasă de tine."],
      ["Opțiunile tale", "Șterge un traseu/o poză sau datele aplicației oricând. Pentru cereri GDPR, scrie-ne mai jos."],
    ],
    termsTitle: "Termeni de utilizare",
    terms: [
      ["Doar informativ", "Itinerariile, prețurile, programul și timpii sunt estimări și pot fi inexacte. Reconfirmă din surse oficiale înainte de plecare."],
      ["Responsabilitatea ta", "Ești responsabil de siguranța, rezervările și deciziile tale. Nu răspundem pentru pierderi din folosirea aplicației."],
    ],
    contact: "Contact: rancea.alexandru99@gmail.com",
  },
};

function Section({ title, items }) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ fontFamily: FONT.display, color: C.cream, fontSize: 18, letterSpacing: -0.3, marginBottom: 10 }}>{title}</Text>
      {items.map(([h, body]) => (
        <View key={h} style={{ marginBottom: 12 }}>
          <Text style={{ color: C.gold, fontFamily: FONT.extrabold, fontSize: 13, marginBottom: 3 }}>{h}</Text>
          <Text style={{ color: C.mutedLight, fontSize: 13, lineHeight: 20 }}>{body}</Text>
        </View>
      ))}
    </View>
  );
}

export default function LegalSheet({ onClose }) {
  const { t, lang } = useI18n();
  const L = LEGAL[lang] || LEGAL.en;
  const showEnNote = !LEGAL[lang];
  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grab} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Scale size={19} color={C.gold} />
              <Text style={{ fontFamily: FONT.display, color: C.cream, fontSize: 21, letterSpacing: -0.3 }}>{t("legalTitle")}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={t("back")}><X size={20} color={C.muted} /></Pressable>
          </View>
          <Text style={{ color: C.muted, fontSize: 12, marginBottom: showEnNote ? 10 : 18 }}>{L.updated}</Text>
          {showEnNote && (
            <View style={{
              backgroundColor: `${C.gold}14`, borderWidth: 1, borderColor: `${C.gold}33`, borderRadius: 10,
              paddingHorizontal: 12, paddingVertical: 8, marginBottom: 16,
            }}>
              <Text style={{ color: C.gold, fontSize: 12, lineHeight: 18 }}>{t("legalEnNote")}</Text>
            </View>
          )}
          <ScrollView style={{ maxHeight: 460 }}>
            <Section title={L.privacyTitle} items={L.privacy} />
            <Section title={L.termsTitle} items={L.terms} />
            <Text style={{ color: C.muted, fontSize: 12, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 14 }}>{L.contact}</Text>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "#000c", justifyContent: "flex-end" },
  sheet: { backgroundColor: C.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 22, paddingBottom: 30, maxHeight: "90%" },
  grab: { width: 40, height: 5, borderRadius: 3, backgroundColor: C.border, alignSelf: "center", marginBottom: 16 },
}));
