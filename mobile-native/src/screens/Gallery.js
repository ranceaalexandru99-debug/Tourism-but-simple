import { useState, useEffect, useMemo } from "react";
import { View, Text, Image, Pressable, ScrollView, TextInput, Modal, StyleSheet, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { C, themedStyles } from "../lib/theme.js";
import { useI18n, tripTitle } from "../lib/i18n.js";
import { FONT } from "../fonts.js";
import { Btn } from "../components/ui.js";
import { pickPhoto, listMemories, addMemory, deleteMemory } from "../lib/gallery.js";
import { MIN_PHOTOS } from "../lib/album.js";
import { exportAlbumPdf, buildShortPayload, shareShort } from "../lib/albumExport.js";
import { isPremium, usePremium } from "../lib/premium.js";
import Paywall from "../components/Paywall.js";
import ShortRenderer from "../components/ShortRenderer.js";
import { Camera, Save, X, Trash2, MapPin, TriangleAlert, Lock, Film } from "../icons.js";

// Soft warning once the gallery grows large — photos live on the device.
const GALLERY_WARN = 50;

const fmtDay = (ts, locale) =>
  new Date(ts).toLocaleDateString(locale === "zh" ? "zh-CN" : locale || "en", { day: "numeric", month: "short", year: "numeric" });

function Compose({ photo, saved, onSave, onCancel }) {
  const { t } = useI18n();
  const [caption, setCaption] = useState("");
  const [tripId, setTripId] = useState(saved[0]?.id || "");
  const trip = saved.find((r) => r.id === tripId);
  return (
    <Modal transparent animationType="slide" visible onRequestClose={onCancel}>
      {/* A Modal renders outside the main tree, so the app-level keyboard
          handling never reaches it — this bottom sheet needs its own, or the
          caption field and Save button end up under the keyboard. */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grab} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Camera size={19} color={C.gold} /><Text style={[styles.sheetTitle, { marginBottom: 0 }]}>{t("galAddTitle")}</Text>
          </View>
          <Image source={{ uri: photo }} style={styles.preview} resizeMode="cover" />
          <TextInput style={styles.input} placeholder={t("galCaptionPh")} placeholderTextColor={C.muted}
            value={caption} onChangeText={setCaption} />
          {saved.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {saved.map((r) => {
                const on = r.id === tripId;
                return (
                  <Pressable key={r.id} onPress={() => setTripId(on ? "" : r.id)} style={[styles.chip, { backgroundColor: on ? C.gold : C.card, borderColor: on ? C.gold : C.border }]}>
                    <Text style={{ color: on ? C.bg : C.mutedLight, fontFamily: FONT.semibold, fontSize: 13 }}>{r.emoji} {r.destName}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          <Btn icon={Save} onPress={() => onSave({ caption: caption.trim(), tripId: trip?.id || null, tripTitle: trip ? tripTitle(trip, t) : null })}>
            {t("galSave")}
          </Btn>
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Viewer({ memory, onClose, onDelete }) {
  const { t, lang } = useI18n();
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={styles.viewer}>
        <View style={styles.viewerBar}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={t("back")}><X size={24} color="#fff" /></Pressable>
          <Pressable onPress={() => onDelete(memory.id)} style={[styles.delBtn, { flexDirection: "row", alignItems: "center", gap: 5 }]}>
            <Trash2 size={13} color={C.red} />
            <Text style={{ color: C.red, fontFamily: FONT.bold, fontSize: 13 }}>{t("galDelete")}</Text>
          </Pressable>
        </View>
        <Image source={{ uri: memory.uri }} style={styles.viewerImg} resizeMode="contain" />
        {!!memory.caption && <Text style={styles.viewerCaption}>{memory.caption}</Text>}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
          {memory.tripTitle ? <MapPin size={12} color="#ffffffaa" /> : null}
          <Text style={[styles.viewerMeta, { marginTop: 0 }]}>{memory.tripTitle ? `${memory.tripTitle} · ` : ""}{fmtDay(memory.ts, lang)}</Text>
        </View>
      </View>
    </Modal>
  );
}

export default function Gallery({ saved }) {
  const { t, lang } = useI18n();
  usePremium(); // re-render when a purchase or restore lands
  const [memories, setMemories] = useState([]);
  const [pending, setPending] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => setMemories(listMemories());
  useEffect(() => { refresh(); }, []);

  // Only trips that actually have enough photos here. Offering a button that
  // can only fail is worse than offering none.
  const albumTrips = useMemo(() => {
    // A plain object rather than a Map: the web copy of this screen imports
    // lucide's `Map` icon, which shadows the global constructor and crashed the
    // whole screen. Nothing imports it here yet — keeping the two identical
    // means adding that icon later cannot reintroduce the bug.
    const counts = {};
    for (const m of memories) if (m.tripId) counts[m.tripId] = (counts[m.tripId] || 0) + 1;
    return (saved || [])
      .map((route) => ({ route, count: counts[route.id] || 0 }))
      .filter((x) => x.count >= MIN_PHOTOS)
      .sort((a, b) => b.count - a.count);
  }, [memories, saved]);

  const [paywall, setPaywall] = useState(false);
  const [picking, setPicking] = useState(false);
  const [albumBusy, setAlbumBusy] = useState(false);
  const [albumMsg, setAlbumMsg] = useState("");

  const makeAlbum = async (route) => {
    if (!isPremium()) { setPaywall(true); return; }
    setAlbumBusy(true);
    setAlbumMsg("");
    try {
      // The result matters: with no share sheet the PDF is written but nothing
      // opens, and ignoring this looked exactly like a button that did nothing.
      const outcome = await exportAlbumPdf(route, memories, {
        title: tripTitle(route, t),
        photos: t("albumPhotos"),
        day: (n) => t("day", { n }),
        date: (iso) => {
          try {
            return new Date(iso + "T00:00:00").toLocaleDateString(lang === "zh" ? "zh-CN" : lang || "en",
              { weekday: "short", day: "numeric", month: "short" });
          } catch { return iso; }
        },
      });
      if (outcome === "saved") setAlbumMsg(t("albumSavedNoShare"));
    } catch (e) {
      setAlbumMsg(
        e?.message === "tooFew" ? t("albumTooFew", { n: MIN_PHOTOS })
          : e?.message === "noFiles" ? t("albumNoFiles")
            : t("albumFailed"),
      );
    } finally {
      setAlbumBusy(false);
    }
  };

  // The short, from the same photos and the same trip choice as the album.
  // It existed only on the trip screen; the gallery is where the photos are.
  const [shortPct, setShortPct] = useState(null);
  const [shortPayload, setShortPayload] = useState(null);

  const makeShort = async (route) => {
    if (!isPremium()) { setPaywall(true); return; }
    setAlbumMsg("");
    setShortPct(0);
    try {
      const mine = (memories || []).filter((m) => m.tripId === route.id);
      const payload = await buildShortPayload(route, memories, {
        title: route.destName,
        subtitle: `${mine.length} ${t("albumPhotos")}`,
        dayPrefix: t("day", { n: "" }).replace(/\s*\{?n?\}?\s*/g, "").trim() || "",
        outro: "Turism, dar simplu!",
      });
      // Mounting the renderer starts the work; it reports back through the
      // handlers on the element itself, near the bottom of this file.
      setShortPayload(payload);
    } catch (e) {
      setShortPct(null);
      setAlbumMsg(
        e?.message === "tooFew" ? t("albumTooFew", { n: MIN_PHOTOS })
          : e?.message === "noFiles" ? t("albumNoFiles")
            : t("shortFailed"),
      );
    }
  };

  const cancelShort = () => { setShortPayload(null); setShortPct(null); };

  // Which action the trip picker is collecting a trip for.
  const [pickFor, setPickFor] = useState("album");
  const runPick = (route) => (pickFor === "short" ? makeShort(route) : makeAlbum(route));
  const startFor = (kind) => {
    if (albumTrips.length === 1) return kind === "short" ? makeShort(albumTrips[0].route) : makeAlbum(albumTrips[0].route);
    setPickFor(kind);
    setPicking((p) => !(p && pickFor === kind));
  };

  const add = async () => {
    setBusy(true);
    try {
      const uri = await pickPhoto(true);
      // Refusing the camera permission used to look like a dead button.
      if (uri === "denied") Alert.alert(t("galAddPhoto"), t("galPermDenied"));
      else if (uri) setPending(uri);
    } finally { setBusy(false); }
  };

  const save = ({ caption, tripId, tripTitle: tt }) => {
    const stored = addMemory({ id: `m${Date.now()}${Math.random().toString(36).slice(2, 6)}`, ts: Date.now(), uri: pending, caption, tripId, tripTitle: tt, stopName: null, ll: null });
    if (!stored) Alert.alert(t("galAddPhoto"), t("galPhotoSaveFailed"));
    setPending(null);
    refresh();
  };

  const remove = (id) => { deleteMemory(id); setViewing(null); refresh(); };

  return (
    <>
      <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 22, paddingBottom: 30 }}>
        <View style={styles.head}>
          <Text style={styles.title}>{t("navGallery")}</Text>
          <Pressable onPress={add} disabled={busy} style={styles.addBtn}>
            <Text style={{ color: C.bg, fontFamily: FONT.extrabold, fontSize: 14 }}>{busy ? "…" : `＋ ${t("galAdd")}`}</Text>
          </Pressable>
        </View>
        <Text style={{ color: C.muted, fontSize: 13, marginBottom: 14 }}>{t("gallerySub")}</Text>

        {/* Album from the gallery — this is where the photos are, so it is
            where someone thinks to turn them into something. Per trip, because
            the day-and-stop structure comes from the itinerary. */}
        {/* When no trip qualifies yet, say what is missing instead of hiding the
            feature. A button that silently fails to exist is indistinguishable
            from one that is broken — and the requirement (link photos to a
            saved trip) is not something anyone would guess. */}
        {memories.length > 0 && albumTrips.length === 0 && (
          <View style={{
            marginBottom: 18, backgroundColor: C.card, borderWidth: 1,
            borderStyle: "dashed", borderColor: C.border, borderRadius: 14,
            padding: 13, flexDirection: "row", gap: 10,
          }}>
            <Camera size={16} color={C.muted} style={{ marginTop: 2 }} />
            <Text style={{ color: C.muted, fontSize: 13, lineHeight: 19, flex: 1 }}>
              {t("galAlbumNeeds", { n: MIN_PHOTOS })}
            </Text>
          </View>
        )}

        {albumTrips.length > 0 && (
          <View style={{ marginBottom: 18 }}>
            <Btn
              icon={isPremium() ? Camera : Lock}
              variant="soft"
              color={C.gold}
              disabled={albumBusy || shortPct !== null}
              onPress={() => startFor("album")}
            >{albumBusy ? t("albumWorking") : t("galMakeAlbum")}</Btn>

            <Btn
              icon={isPremium() ? Film : Lock}
              variant="soft"
              color={C.purple}
              disabled={albumBusy || shortPct !== null}
              onPress={() => startFor("short")}
              style={{ marginTop: 10 }}
            >{shortPct !== null ? `${t("shortRendering")} ${Math.round(shortPct * 100)}%` : t("shareShort")}</Btn>

            {/* Encoding runs in real time, so the number moving is the only
                thing distinguishing this from a frozen app. */}
            {shortPct !== null && (
              <>
                <View style={{ height: 6, backgroundColor: C.border, borderRadius: 3, overflow: "hidden", marginTop: 10 }}>
                  <View style={{ width: `${Math.round(shortPct * 100)}%`, height: "100%", backgroundColor: C.purple }} />
                </View>
                <Btn variant="ghost" color={C.muted} onPress={cancelShort} style={{ marginTop: 10 }}>{t("cancel")}</Btn>
              </>
            )}

            {picking && albumTrips.map(({ route, count }) => (
              <Pressable
                key={route.id}
                onPress={() => { setPicking(false); runPick(route); }}
                style={{
                  flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                  backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
                  borderRadius: 12, padding: 13, marginTop: 8,
                }}
              >
                <Text style={{ color: C.cream, fontSize: 14, fontFamily: FONT.semibold, flex: 1 }} numberOfLines={1}>
                  {tripTitle(route, t)}
                </Text>
                <Text style={{ color: C.muted, fontSize: 12, marginLeft: 10 }}>{count} {t("albumPhotos")}</Text>
              </Pressable>
            ))}

            {!!albumMsg && (
              <View style={{
                marginTop: 10, backgroundColor: C.gold + "14",
                borderWidth: 1, borderColor: C.gold + "44", borderRadius: 12, padding: 12,
              }}>
                <Text style={{ color: C.gold, fontSize: 13, lineHeight: 19 }}>{albumMsg}</Text>
              </View>
            )}
          </View>
        )}

        {memories.length >= GALLERY_WARN && (
          <View style={{ backgroundColor: C.gold + "14", borderWidth: 1, borderColor: C.gold + "44", borderRadius: 14, padding: 12, marginBottom: 16 }}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <TriangleAlert size={14} color={C.gold} style={{ marginTop: 2 }} />
              <Text style={{ color: C.gold, fontSize: 13, lineHeight: 19, flex: 1 }}>{t("galLimitWarn", { n: memories.length })}</Text>
            </View>
          </View>
        )}

        {memories.length === 0 ? (
          <Pressable onPress={add} style={styles.empty}>
            <View style={{ marginBottom: 12 }}><Camera size={48} color={C.gold} strokeWidth={1.4} /></View>
            <Text style={{ color: C.cream, fontSize: 16, fontFamily: FONT.bold, marginBottom: 4 }}>{t("galEmpty")}</Text>
            <Text style={{ color: C.muted, fontSize: 13, textAlign: "center", lineHeight: 20 }}>{t("galEmptySub")}</Text>
          </Pressable>
        ) : (
          <View style={styles.grid}>
            {memories.map((m) => (
              <Pressable key={m.id} onPress={() => setViewing(m)} style={styles.card}>
                <Image source={{ uri: m.uri }} style={styles.thumb} resizeMode="cover" />
                <View style={{ padding: 10 }}>
                  <Text style={{ color: m.caption ? C.cream : C.muted, fontSize: 14, fontFamily: FONT.semibold, fontStyle: m.caption ? "normal" : "italic" }} numberOfLines={1}>
                    {m.caption || t("galNoCaption")}
                  </Text>
                  <Text style={{ color: C.muted, fontSize: 11, marginTop: 3 }} numberOfLines={1}>
                    {m.tripTitle ? m.tripTitle : fmtDay(m.ts, lang)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {pending && <Compose photo={pending} saved={saved} onSave={save} onCancel={() => setPending(null)} />}
      {viewing && <Viewer memory={viewing} onClose={() => setViewing(null)} onDelete={remove} />}
      {paywall && <Paywall onClose={() => setPaywall(false)} />}

      {/* Mounting this starts the render; unmounting it cancels, because the
          WebView doing the encoding goes with it. */}
      {shortPayload && (
        <ShortRenderer
          payload={shortPayload}
          onProgress={setShortPct}
          onDone={async (uri) => {
            setShortPayload(null);
            setShortPct(null);
            try {
              const outcome = await shareShort(uri);
              if (outcome === "saved") setAlbumMsg(t("albumSavedNoShare"));
            } catch { setAlbumMsg(t("shortFailed")); }
          }}
          onError={(reason) => {
            setShortPayload(null);
            setShortPct(null);
            setAlbumMsg(reason === "unsupported" ? t("shortUnsupported") : t("shortFailed"));
          }}
        />
      )}
    </>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  title: { fontFamily: FONT.display, color: C.cream, fontSize: 28, letterSpacing: -0.4 },
  addBtn: { backgroundColor: C.gold, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 15 },
  empty: { backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.gold + "55", borderStyle: "dashed", borderRadius: 20, padding: 40, alignItems: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: { width: "47%", flexGrow: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, overflow: "hidden" },
  thumb: { width: "100%", aspectRatio: 1, backgroundColor: C.surface },
  backdrop: { flex: 1, backgroundColor: "#000c", justifyContent: "flex-end" },
  sheet: { backgroundColor: C.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 22, paddingBottom: 30 },
  grab: { width: 40, height: 5, borderRadius: 3, backgroundColor: C.border, alignSelf: "center", marginBottom: 16 },
  sheetTitle: { fontFamily: FONT.display, color: C.cream, fontSize: 21, letterSpacing: -0.3, marginBottom: 14 },
  preview: { width: "100%", height: 220, borderRadius: 16, marginBottom: 16 },
  input: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 14, color: C.cream, fontSize: 15, fontFamily: FONT.body, marginBottom: 14 },
  chip: { borderRadius: 999, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 13 },
  viewer: { flex: 1, backgroundColor: "#000e", justifyContent: "center", padding: 16 },
  viewerBar: { position: "absolute", top: 44, left: 16, right: 16, flexDirection: "row", justifyContent: "space-between", zIndex: 2 },
  delBtn: { backgroundColor: C.red + "22", borderWidth: 1, borderColor: C.red + "66", borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 },
  viewerImg: { width: "100%", height: "62%", borderRadius: 16 },
  viewerCaption: { color: "#fff", fontSize: 17, fontFamily: FONT.semibold, marginTop: 16 },
  viewerMeta: { color: "#ffffffaa", fontSize: 13, marginTop: 6 },
}));
