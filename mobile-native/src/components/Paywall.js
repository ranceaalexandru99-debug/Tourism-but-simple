// The subscription sheet.
//
// Prices come from the store, never from us: they differ by country and
// currency, and both Google and Apple require the real localised price to be
// the one shown. If the offering cannot be fetched there is nothing honest to
// display, so the sheet says so rather than inventing a number.
//
// "Restore purchases" is not optional — both stores require a way for someone
// who reinstalled, or who is on a second device, to get their access back
// without paying again.

import { useEffect, useState } from "react";
import { View, Text, Pressable, Modal, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { C, themedStyles } from "../lib/theme.js";
import { useI18n } from "../lib/i18n.js";
import { FONT } from "../fonts.js";
import { Btn } from "./ui.js";
import { getOffering, purchase, restore, billingConfigured } from "../lib/premium.js";
import { Camera, Film, CircleCheck, X } from "../icons.js";

const BENEFITS = ["paywallBenefitAlbum", "paywallBenefitShort", "paywallBenefitFuture"];

export default function Paywall({ onClose, onUnlocked, onShowLegal }) {
  const { t } = useI18n();
  const [offering, setOffering] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let alive = true;
    getOffering()
      .then((o) => { if (alive) { setOffering(o); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const buy = async (pkg) => {
    setBusy(true);
    setMsg("");
    try {
      const ok = await purchase(pkg);
      if (ok) { onUnlocked?.(); onClose?.(); }
      // Not ok without an error means the user backed out of the store sheet —
      // that is a decision, not a failure, so say nothing.
    } catch (e) {
      // The SDK flags a cancellation rather than throwing something distinct.
      if (!e?.userCancelled) setMsg(t("paywallFailed"));
    } finally {
      setBusy(false);
    }
  };

  const doRestore = async () => {
    setBusy(true);
    setMsg("");
    try {
      const ok = await restore();
      if (ok) { onUnlocked?.(); onClose?.(); }
      else setMsg(t("paywallNothingToRestore"));
    } catch {
      setMsg(t("paywallFailed"));
    } finally {
      setBusy(false);
    }
  };

  const packages = offering?.availablePackages || [];

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grabRow}>
            <View style={styles.grab} />
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={t("back")} style={styles.close}>
              <X size={20} color={C.muted} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>{t("paywallTitle")}</Text>
            <Text style={styles.sub}>{t("paywallSub")}</Text>

            <View style={{ marginVertical: 18, gap: 12 }}>
              {BENEFITS.map((key, i) => (
                <View key={key} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                  {i === 0 ? <Camera size={18} color={C.gold} />
                    : i === 1 ? <Film size={18} color={C.gold} />
                      : <CircleCheck size={18} color={C.gold} />}
                  <Text style={{ color: C.cream, fontSize: 14, lineHeight: 20, flex: 1 }}>{t(key)}</Text>
                </View>
              ))}
            </View>

            {loading && <ActivityIndicator color={C.gold} style={{ marginVertical: 20 }} />}

            {/* Nothing to sell: no key configured, no network, or no products
                set up in the store yet. Saying which is not possible from here,
                but saying that it cannot be bought right now is honest. */}
            {!loading && packages.length === 0 && (
              <View style={styles.notice}>
                <Text style={{ color: C.gold, fontSize: 13, lineHeight: 19 }}>
                  {billingConfigured ? t("paywallUnavailable") : t("paywallNotConfigured")}
                </Text>
              </View>
            )}

            {packages.map((pkg) => (
              <Btn
                key={pkg.identifier}
                disabled={busy}
                onPress={() => buy(pkg)}
                style={{ marginBottom: 10 }}
              >
                {/* priceString is already formatted in the buyer's currency. */}
                {`${pkg.product.title || t("paywallSubscribe")} — ${pkg.product.priceString}`}
              </Btn>
            ))}

            {!!msg && (
              <View style={styles.notice}><Text style={{ color: C.gold, fontSize: 13 }}>{msg}</Text></View>
            )}

            <Pressable onPress={doRestore} disabled={busy} style={{ paddingVertical: 12 }}>
              <Text style={styles.link}>{t("paywallRestore")}</Text>
            </Pressable>

            <Text style={styles.legal}>{t("paywallLegal")}</Text>
            <Pressable onPress={onShowLegal}>
              <Text style={[styles.link, { fontSize: 12 }]}>{t("legalTitle")}</Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "#000a", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: C.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26,
    padding: 22, paddingBottom: 30, maxHeight: "88%",
  },
  grabRow: { position: "relative", height: 22, marginBottom: 8 },
  grab: { width: 40, height: 5, backgroundColor: C.border, borderRadius: 3, alignSelf: "center", marginTop: 6 },
  close: { position: "absolute", right: 0, top: 0, padding: 4 },
  title: { fontFamily: FONT.display, color: C.cream, fontSize: 24, letterSpacing: -0.3 },
  sub: { color: C.muted, fontSize: 14, lineHeight: 20, marginTop: 6 },
  notice: {
    backgroundColor: C.gold + "14", borderWidth: 1, borderColor: C.gold + "44",
    borderRadius: 12, padding: 12, marginBottom: 12,
  },
  link: { color: C.gold, fontSize: 14, fontFamily: FONT.semibold, textAlign: "center" },
  legal: { color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 14, marginBottom: 8, textAlign: "center" },
}));
