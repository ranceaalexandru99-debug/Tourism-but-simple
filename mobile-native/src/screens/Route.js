import { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, Modal, Linking, Share, TextInput, StyleSheet, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { C, themedStyles } from "../lib/theme.js";
import { useI18n, tripTitle } from "../lib/i18n.js";
import { FONT } from "../fonts.js";
import { Btn } from "../components/ui.js";
import { LinearGradient } from "expo-linear-gradient";
import PoiImage from "../components/PoiImage.js";
import RecapSheet from "../components/RecapSheet.js";
import { CURRENCIES, convert, phrasesFor, goodToKnow } from "../lib/locale.js";
import { countryName, countryFlagOf } from "../lib/countryNames.js";
import { dayDistanceKm, optimizeItinerary } from "../lib/geo.js";
import { fetchWeather } from "../lib/weather.js";
import { isPremium, usePremium } from "../lib/premium.js";
import { tripAsText } from "../lib/tripText.js";
import { loadCollab } from "../lib/mockCollab.js";
import Collab from "./Collab.js";
import Paywall from "../components/Paywall.js";
import { exportAlbumPdf, buildShortPayload, buildShortScenes, shareShort } from "../lib/albumExport.js";
import { MIN_PHOTOS } from "../lib/album.js";
import ShortRenderer from "../components/ShortRenderer.js";
import ShortEditor from "../components/ShortEditor.js";
import { listMemories, pickPhoto, addMemory } from "../lib/gallery.js";
import {
  Star, Clock, Ticket, Lightbulb, NotebookPen, Map, Navigation, Check,
  MapPin, Footprints, Save, PartyPopper, Share2, MessagesSquare, Hand, Heart,
  Coins, Bath, LifeBuoy, Ambulance, Plug, ArrowLeftRight, Utensils, TrainFront,
  Hourglass, CategoryIcon, Camera, Lock, Film, WeatherIcon, Zap, Users,
} from "../icons.js";

const CUR_CODES = Object.keys(CURRENCIES);

function openStopsInMaps(stops) {
  let pts = stops.filter((s) => s.ll).map((s) => `${s.ll[0]},${s.ll[1]}`);
  if (pts.length === 0) return;
  if (pts.length === 1) {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pts[0])}`);
    return;
  }
  pts = pts.slice(0, 10);
  const origin = pts[0], destination = pts[pts.length - 1], waypoints = pts.slice(1, -1).join("|");
  let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
  if (waypoints) url += `&waypoints=${encodeURIComponent(waypoints)}`;
  Linking.openURL(url);
}

function RatingStars({ value = 0, onChange }) {
  const { t } = useI18n();
  return (
    <View style={styles.rating}>
      <Text style={{ color: C.muted, fontFamily: FONT.extrabold, fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase" }}>{t("rateStop")}</Text>
      <View style={{ flexDirection: "row", gap: 4, marginLeft: "auto" }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable key={star} onPress={() => onChange(star === value ? 0 : star)} hitSlop={4} accessibilityLabel={`${t("rateStop")} ${star}`} accessibilityState={{ selected: star <= value }}>
            <Star size={21} color={star <= value ? C.gold : C.border} fill={star <= value ? C.gold : "none"} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function StopDetail({ stop, prev, destName, route, onClose, onToggleDone, onRate, onNote }) {
  const { t } = useI18n();
  const canDir = prev && prev.ll && stop.ll;
  const [note, setNote] = useState(stop.note || "");
  const commitNote = () => { if ((note || "") !== (stop.note || "")) onNote(note.trim()); };

  // Photograph THIS attraction. The point is not saving a tap — it is that the
  // photo arrives already knowing where it was taken and which stop it belongs
  // to, from the stop's own coordinates. No location permission is involved,
  // and none is wanted: the attraction knows where it is.
  //
  // Without this the native gallery had no photo with coordinates at all, so a
  // map of them would have been empty, and no photo could be filed under its
  // stop in an album either.
  const [photo, setPhoto] = useState("idle");
  const takePhoto = async () => {
    setPhoto("saving");
    try {
      const uri = await pickPhoto(true);
      if (uri === "denied") { setPhoto("idle"); Alert.alert(t("galAddPhoto"), t("galPermDenied")); return; }
      if (!uri) { setPhoto("idle"); return; }
      const ok = addMemory({
        id: `m${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
        ts: Date.now(), uri, caption: stop.name,
        tripId: route?.id || null,
        tripTitle: route ? tripTitle(route, t) : null,
        stopName: stop.name,
        ll: stop.ll || null,
      });
      setPhoto(ok ? "saved" : "idle");
      if (!ok) Alert.alert(t("galAddPhoto"), t("galPhotoSaveFailed"));
    } catch {
      setPhoto("idle");
    }
  };
  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      {/* A Modal renders outside the main tree, so app-level keyboard handling
          never reaches it. The sheet is also capped at 88% height with more
          content than that on a small phone — everything below the note field
          was simply unreachable — hence the ScrollView. */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grab} />
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* contain: this is the one place someone actually looks at the
              attraction, and a 2:1 band cropped out of a tall photo of a tower
              keeps the middle of the tower and nothing else. */}
          <PoiImage name={stop.name} wiki={stop.wiki} context={destName} emoji={stop.emoji} tags={stop.tags} height={190} radius={18} fontSize={64} fit="contain" style={{ marginBottom: 16 }} />
          <Text style={styles.stopTitle}>{stop.name}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4, marginBottom: 16 }}>
            <Clock size={14} color={C.gold} />
            <Text style={{ color: C.gold, fontSize: 14 }}>{stop.time} · {stop.durLabel}</Text>
          </View>

          <View style={styles.pills}>
            <View style={styles.pillRow}><Clock size={13} color={C.gold} /><Text style={styles.pill}>{stop.hours}</Text></View>
            <View style={styles.pillRow}><Ticket size={13} color={C.gold} /><Text style={styles.pill}>{stop.cost > 0 ? "€" + stop.cost : t("free")}</Text></View>
          </View>

          {/* Only when there is actually a tip — stops from the generated tiers
              often have none, and this used to render an empty gold-labelled
              card. Ported from the web app. */}
          {!!stop.tip && (
            <View style={styles.tip}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 }}>
                <Lightbulb size={13} color={C.gold} />
                <Text style={{ color: C.gold, fontFamily: FONT.extrabold, fontSize: 12 }}>{t("localTip")}</Text>
              </View>
              <Text style={{ color: C.cream, fontSize: 15, lineHeight: 21 }}>{stop.tip}</Text>
            </View>
          )}

          {/* Personal notes — bookings, reminders, anything */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 6 }}>
            <NotebookPen size={13} color={C.mutedLight} />
            <Text style={{ color: C.mutedLight, fontFamily: FONT.extrabold, fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase" }}>{t("notesLabel")}</Text>
          </View>
          <TextInput
            value={note} onChangeText={setNote} onBlur={commitNote}
            placeholder={t("notesPh")} placeholderTextColor={C.muted}
            multiline
            style={styles.noteInput}
          />

          <Btn
            icon={photo === "saved" ? Check : Camera}
            variant="soft"
            color={photo === "saved" ? C.green : C.gold}
            disabled={photo === "saving"}
            onPress={takePhoto}
            style={{ marginBottom: 10 }}
          >{photo === "saved" ? t("galPhotoSaved") : t("galAddPhoto")}</Btn>

          <Btn icon={Map} onPress={() => openStopsInMaps([stop])}>{t("openMaps")}</Btn>
          {canDir && (
            <Btn icon={Navigation} variant="soft" color={C.blue} onPress={() => openStopsInMaps([prev, stop])} style={{ marginTop: 10 }}>
              {t("directionsFromPrev", { name: prev.name })}
            </Btn>
          )}
          <Btn icon={stop.done ? Check : undefined} variant="ghost" color={stop.done ? C.green : C.muted} onPress={onToggleDone} style={{ marginTop: 10 }}>
            {stop.done ? t("visited") : t("markVisited")}
          </Btn>
          {stop.done && onRate && <RatingStars value={stop.rating || 0} onChange={onRate} />}
          </ScrollView>
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function BudgetCard({ budget, currency, onCycle }) {
  const { t } = useI18n();
  const rows = [
    { Icon: Ticket, label: t("budgetTickets"), val: budget.tickets },
    { Icon: Utensils, label: t("budgetFood"), val: budget.food },
    { Icon: TrainFront, label: t("budgetTransport"), val: budget.transport },
  ];
  return (
    <View style={styles.budget}>
      <View style={styles.budgetHead}>
        <Text style={styles.eyebrow}>{t("budgetTitle")}</Text>
        <Pressable onPress={onCycle} style={[styles.curBtn, { flexDirection: "row", alignItems: "center", gap: 4 }]}>
          <Text style={{ color: C.gold, fontFamily: FONT.bold, fontSize: 12 }}>{currency}</Text>
          <ArrowLeftRight size={12} color={C.gold} />
        </Pressable>
      </View>
      <Text style={styles.budgetTotal}>~{convert(budget.total, currency)}</Text>
      <Text style={{ color: C.muted, fontSize: 13, marginBottom: 12 }}>{t("perDay", { x: convert(budget.perDay, currency) })}</Text>
      {rows.map((r) => (
        <View key={r.label} style={styles.budgetRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <r.Icon size={14} color={C.mutedLight} />
            <Text style={{ color: C.mutedLight, fontSize: 14 }}>{r.label}</Text>
          </View>
          <Text style={{ color: C.cream, fontFamily: FONT.semibold, fontSize: 14 }}>{r.val > 0 ? convert(r.val, currency) : "—"}</Text>
        </View>
      ))}
    </View>
  );
}

function PhrasesCard({ phrases }) {
  const { t } = useI18n();
  const rows = [
    { k: "hello", Icon: Hand }, { k: "thanks", Icon: Heart }, { k: "howmuch", Icon: Coins },
    { k: "toilet", Icon: Bath }, { k: "help", Icon: LifeBuoy },
  ];
  return (
    <View style={[styles.infoCard, { borderColor: C.blue + "30" }]}>
      <View style={styles.infoHead}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <MessagesSquare size={13} color={C.muted} />
          <Text style={styles.eyebrow}>{t("phrasesTitle")}</Text>
        </View>
        <Text style={{ color: C.mutedLight, fontSize: 12, fontFamily: FONT.semibold }}>{phrases.flag} {phrases.name}</Text>
      </View>
      {rows.map((r) => (
        <View key={r.k} style={styles.budgetRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <r.Icon size={14} color={C.mutedLight} />
            <Text style={{ color: C.mutedLight, fontSize: 14 }}>{t("phrase_" + r.k)}</Text>
          </View>
          <Text style={{ color: C.cream, fontFamily: FONT.bold, fontSize: 14 }}>{phrases.phrases[r.k]}</Text>
        </View>
      ))}
    </View>
  );
}

function GoodToKnowCard({ info }) {
  const { t } = useI18n();
  const tz = info.hoursFromUser == null ? info.tz
    : info.hoursFromUser === 0 ? t("timezone")
    : t("tzDiff", { h: info.hoursFromUser > 0 ? `+${info.hoursFromUser}` : info.hoursFromUser });
  const rows = [
    { Icon: Ambulance, k: "emergency", v: info.emergency },
    { Icon: Plug, k: "plug", v: info.plug },
    { Icon: Clock, k: "timezone", v: tz },
  ];
  return (
    <View style={[styles.infoCard, { borderColor: C.green + "30" }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <Lightbulb size={13} color={C.muted} />
        <Text style={styles.eyebrow}>{t("goodToKnowTitle")}</Text>
      </View>
      {rows.map((r) => (
        <View key={r.k} style={styles.budgetRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <r.Icon size={14} color={C.mutedLight} />
            <Text style={{ color: C.mutedLight, fontSize: 14 }}>{t(r.k)}</Text>
          </View>
          <Text style={{ color: C.cream, fontFamily: FONT.bold, fontSize: 14 }}>{r.v}</Text>
        </View>
      ))}
    </View>
  );
}

// Localised date for the album's day headings, matching how the app writes
// dates elsewhere.
function albumDate(iso, lang) {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString(lang === "zh" ? "zh-CN" : lang || "en",
      { weekday: "short", day: "numeric", month: "short" });
  } catch { return iso; }
}

export default function Route({ route, onBack, onSaved }) {
  const { t, lang } = useI18n();
  usePremium(); // re-render when a purchase or restore lands
  const [saved, setSaved] = useState(false);

  // Album export. Reading every photo off disk and base64-encoding it is not
  // something to do until asked, so it all happens inside this handler.
  const [paywall, setPaywall] = useState(false);
  const [albumBusy, setAlbumBusy] = useState(false);
  const [albumMsg, setAlbumMsg] = useState("");
  const makeAlbum = async () => {
    if (!isPremium()) { setPaywall(true); return; }
    setAlbumBusy(true);
    setAlbumMsg("");
    try {
      await exportAlbumPdf(r, listMemories(), {
        title: tripTitle(r, t),
        photos: t("albumPhotos"),
        day: (n) => t("day", { n }),
        date: (iso) => albumDate(iso, lang),
      });
    } catch (e) {
      setAlbumMsg(e?.message === "tooFew" ? t("albumTooFew", { n: MIN_PHOTOS }) : t("albumFailed"));
    } finally {
      setAlbumBusy(false);
    }
  };

  // Short video. Rendered inside an off-screen WebView, because React Native
  // has no encoder and the two libraries that used to provide one are dead
  // (ffmpeg-kit is marked unsupported on npm; video-processing last shipped in
  // 2022). Android's WebView is Chromium, so the canvas + MediaRecorder path
  // the web app already uses works there unchanged.
  const [shortPayload, setShortPayload] = useState(null);
  const [shortPct, setShortPct] = useState(null);
  // The editor runs first here too. Two entry points into the same feature
  // behaving differently would be worse than either behaviour on its own.
  const [editing, setEditing] = useState(null);

  const startShort = async () => {
    if (!isPremium()) { setPaywall(true); return; }
    setAlbumMsg("");
    try {
      setEditing(await buildShortScenes(r, listMemories()));
    } catch (e) {
      setAlbumMsg(e?.message === "tooFew" ? t("albumTooFew", { n: MIN_PHOTOS }) : t("shortFailed"));
    }
  };

  const renderEdited = async (recipe) => {
    setEditing(null);
    setShortPct(0);
    try {
      const payload = await buildShortPayload(r, listMemories(), {
        title: r.destName,
        subtitle: `${recipe.filter((x) => x.include).length} ${t("albumPhotos")}`,
        dayPrefix: t("day", { n: "" }).replace(/\s*\{?n?\}?\s*/g, "").trim() || "",
        outro: "Turism, dar simplu!",
      }, recipe);
      setShortPayload(payload);
    } catch (e) {
      setShortPct(null);
      setAlbumMsg(e?.message === "tooFew" ? t("albumTooFew", { n: MIN_PHOTOS }) : t("shortFailed"));
    }
  };
  const cancelShort = () => { setShortPayload(null); setShortPct(null); };
  const [openStop, setOpenStop] = useState(null);
  const [currency, setCurrency] = useState("EUR");
  const [r, setR] = useState(route);

  // Forecast for the trip dates. Open-Meteo answers for free and without a
  // key; it covers about two weeks ahead, so a trip planned further out simply
  // shows no pills. Failure is silent by design — a missing forecast must not
  // interrupt someone reading their itinerary.
  const [weather, setWeather] = useState({});
  useEffect(() => {
    let alive = true;
    fetchWeather(r.center, r.startDate, r.days)
      .then((w) => { if (alive) setWeather(w || {}); })
      .catch(() => {});
    return () => { alive = false; };
  }, [r.center, r.startDate, r.days]);

  const phrases = phrasesFor(r.country);
  const info = goodToKnow(r.country);
  const cycleCur = () => setCurrency((c) => CUR_CODES[(CUR_CODES.indexOf(c) + 1) % CUR_CODES.length]);

  const [recap, setRecap] = useState(false);
  const [collab, setCollab] = useState(false);
  const groupCount = loadCollab(r).members.length;

  // Edit the currently-open stop by its position (day/stop index), not by name —
  // two stops can share a name, which would otherwise get edited together.
  const editOpenStop = (patch) => {
    if (!openStop || openStop.di == null || openStop.di < 0) return;
    const updated = { ...r, itinerary: r.itinerary.map((d) => ({ ...d, stops: [...d.stops] })) };
    const cur = updated.itinerary[openStop.di].stops[openStop.si];
    if (!cur) return;
    const next = { ...cur, ...patch };
    updated.itinerary[openStop.di].stops[openStop.si] = next;
    setR(updated);
    setOpenStop((o) => ({ ...o, stop: next }));
  };

  // Reordering each day by proximity, so less of the day is spent walking
  // between stops that happen to be listed next to each other.
  const [optimized, setOptimized] = useState(false);

  // How many kilometres the reorder would save across the whole trip. Computed
  // rather than assumed: on a compact old town it is often zero, and a button
  // that changes nothing is worse than no button.
  const optimizeSaving = optimized ? 0 : (() => {
    const before = r.itinerary.reduce((sum, d) => sum + dayDistanceKm(d.stops), 0);
    const after = optimizeItinerary(r.itinerary).reduce((sum, d) => sum + dayDistanceKm(d.stops), 0);
    return before - after;
  })();

  const optimize = () => {
    const next = { ...r, itinerary: optimizeItinerary(r.itinerary) };
    setR(next);
    setOptimized(true);
    // Keep a saved trip in step, or the reorder is lost on the next open.
    if (saved) onSaved(next);
  };

  const toggleDone = () => editOpenStop({ done: !openStop.stop.done });
  const rateOpenStop = (rating) => editOpenStop({ rating });
  const noteOpenStop = (note) => editOpenStop({ note });

  // Share a plain-text itinerary via the native share sheet (no hosted URL).
  // The text itself lives in tripText.js, because the group invite sends the
  // same thing and the two must not drift apart.
  const shareTrip = async () => {
    const title = tripTitle(r, t);
    try { await Share.share({ message: tripAsText(r, t, title), title }); } catch {}
  };

  return (
    <View style={styles.wrap}>
      {/* Cover. Taller than the old 190, where it read as a strip rather than
          a photograph — and the same two overlays the web app uses: a faint
          dark scrim at the top so the back control survives a bright sky, and
          a short fade at the bottom so the photo meets the page instead of
          ending on a hard line. */}
      <View style={{ height: 224 }}>
        <PoiImage name={r.destName} emoji={r.emoji} tags={r.interests} height={224} radius={0} fontSize={90} />
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(0,0,0,0.24)", "rgba(0,0,0,0)"]}
          style={{ position: "absolute", left: 0, right: 0, top: 0, height: 50 }}
        />
        <LinearGradient
          pointerEvents="none"
          colors={[C.bg + "00", C.bg]}
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 40 }}
        />
        <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
          <Text style={{ color: C.cream, fontSize: 20 }}>‹</Text>
        </Pressable>
      </View>

      {/* No negative margin: it used to pull the title 8px onto the cover, so
          on a narrow phone a wrapped title put dark serif text on sunlit
          buildings. The title needs ground of its own, not a lucky photo. */}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 10, paddingBottom: 40 }} style={{ backgroundColor: C.bg }}>
        <View style={styles.titleRow}>
          <View style={styles.emoji}><CategoryIcon tags={r.interests} size={26} color={C.gold} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{tripTitle(r, t)}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
              <MapPin size={12} color={C.muted} />
              <Text style={{ color: C.muted, fontSize: 13 }}>{r.totalStops} {t("stops")} ·</Text>
              <Clock size={12} color={C.muted} />
              <Text style={{ color: C.muted, fontSize: 13 }}>~{r.totalHours}h{r.country ? ` · ${countryFlagOf(r.country)} ${countryName(r.country, lang)}` : ""}</Text>
            </View>
          </View>
        </View>

        <BudgetCard budget={r.budget} currency={currency} onCycle={cycleCur} />
        {phrases && <PhrasesCard phrases={phrases} />}
        {info && <GoodToKnowCard info={info} />}

        {r.itinerary.map((day, di) => {
          const km = dayDistanceKm(day.stops);
          const w = day.date && weather[day.date];
          return (
            <View key={day.day} style={{ marginBottom: 22, marginTop: 4 }}>
              <View style={styles.dayHead}>
                {r.days > 1 && (
                  <View style={styles.dayBadge}>
                    <Text style={{ color: C.bg, fontFamily: FONT.extrabold, fontSize: 13 }}>{t("day", { n: day.day })}</Text>
                  </View>
                )}
                {km > 0.15 && (
                  <View style={[styles.kmPill, { flexDirection: "row", alignItems: "center", gap: 4 }]}>
                    <Footprints size={12} color={C.mutedLight} />
                    <Text style={{ color: C.mutedLight, fontFamily: FONT.bold, fontSize: 12 }}>{km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`}</Text>
                  </View>
                )}
                {day.stops.some((s) => s.ll) && (
                  <Pressable onPress={() => openStopsInMaps(day.stops)} style={[styles.mapsPill, { flexDirection: "row", alignItems: "center", gap: 4 }]}>
                    <Navigation size={12} color={C.blue} />
                    <Text style={{ color: C.blue, fontFamily: FONT.bold, fontSize: 12 }}>Maps</Text>
                  </Pressable>
                )}
                {/* The forecast only exists for dates within the API's range,
                    so most days of a trip planned months ahead show nothing —
                    a missing pill, not an error message. */}
                {w && (
                  <View style={[styles.wxPill, { flexDirection: "row", alignItems: "center", gap: 4 }]}>
                    <WeatherIcon code={w.code} size={12} color={C.mutedLight} />
                    <Text style={{ color: C.mutedLight, fontFamily: FONT.bold, fontSize: 12 }}>
                      {w.tmax}° / {w.tmin}°
                    </Text>
                  </View>
                )}
              </View>

              {day.stops.map((stop, i) => (
                <Pressable
                  key={i}
                  onPress={() => setOpenStop({ stop, prev: i > 0 ? day.stops[i - 1] : null, di, si: i })}
                  style={styles.stopRow}
                >
                  <View style={[styles.stopNum, stop.done && { backgroundColor: C.green, borderColor: C.green }]}>
                    {stop.done
                      ? <Check size={13} color={C.bg} strokeWidth={3.2} />
                      : <Text style={{ color: C.gold, fontFamily: FONT.extrabold, fontSize: 14 }}>{i + 1}</Text>}
                  </View>
                  <View style={styles.stopCard}>
                    <PoiImage name={stop.name} wiki={stop.wiki} context={r.destName} emoji={stop.emoji} tags={stop.tags} width={46} height={46} radius={10} fontSize={22} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.stopName, stop.done && { textDecorationLine: "line-through", opacity: 0.6 }]} numberOfLines={1}>{stop.name}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                        <Clock size={12} color={C.muted} />
                        <Text style={{ color: C.muted, fontSize: 13 }}>{stop.time} · {stop.durLabel}</Text>
                        {stop.note ? <NotebookPen size={12} color={C.gold} /> : null}
                        {stop.note ? <Text style={{ color: C.gold, fontSize: 12 }}>{t("noteBadge")}</Text> : null}
                      </View>
                    </View>
                    <Text style={{ color: C.muted, fontSize: 18 }}>›</Text>
                  </View>
                </Pressable>
              ))}

              {!!day.lunch && (
                <View style={styles.extra}>
                  <Text style={{ color: C.gold, fontSize: 14 }}>{day.lunch}</Text>
                  {!!day.transport && <Text style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>{day.transport}</Text>}
                </View>
              )}
            </View>
          );
        })}

        {saved ? (
          <View style={[styles.savedBox, { flexDirection: "row", justifyContent: "center", gap: 7 }]}>
            <Check size={16} color={C.green} strokeWidth={3} />
            <Text style={{ color: C.green, fontFamily: FONT.bold, fontSize: 16 }}>{t("saved")}</Text>
          </View>
        ) : (
          <Btn icon={Save} onPress={() => { onSaved(r); setSaved(true); }}>{t("save")}</Btn>
        )}
        {/* Reordering is offered only when it would actually help: the button
            measures the walk before and after, and stays hidden unless the
            saving is worth a tap. Offering it on an already-good day, and
            having nothing move, reads as a broken button. */}
        {optimizeSaving > 0.2 && (
          <Btn icon={Zap} variant="soft" color={C.green} onPress={optimize} style={{ marginTop: 10 }}>
            {optimized ? t("routeOptimized") : t("optimizeRoute")}
          </Btn>
        )}
        <Btn icon={Users} variant="soft" color={C.blue} onPress={() => setCollab(true)} style={{ marginTop: 10 }}>
          {t("planGroup")}{groupCount > 1 ? ` · ${groupCount}` : ""}
        </Btn>
        <Btn icon={PartyPopper} variant="soft" color={C.gold} onPress={() => setRecap(true)} style={{ marginTop: 10 }}>{t("recapOpen")}</Btn>
        <Btn icon={Share2} variant="soft" color={C.blue} onPress={shareTrip} style={{ marginTop: 10 }}>{t("shareTitle")}</Btn>
        <Btn
          icon={isPremium() ? Camera : Lock}
          variant="soft"
          color={C.gold}
          disabled={albumBusy}
          onPress={makeAlbum}
          style={{ marginTop: 10 }}
        >{albumBusy ? t("albumWorking") : t("shareAlbum")}</Btn>
        <Btn
          icon={isPremium() ? Film : Lock}
          variant="soft"
          color={C.purple}
          disabled={shortPct !== null}
          onPress={startShort}
          style={{ marginTop: 10 }}
        >{shortPct !== null ? `${t("shortRendering")} ${Math.round(shortPct * 100)}%` : t("shareShort")}</Btn>
        {/* Rendering runs in real time, so the number moving is the only thing
            distinguishing this from a frozen app. */}
        {shortPct !== null && (
          <>
            <View style={{ height: 6, backgroundColor: C.border, borderRadius: 3, overflow: "hidden", marginTop: 10 }}>
              <View style={{ width: `${Math.round(shortPct * 100)}%`, height: "100%", backgroundColor: C.purple }} />
            </View>
            <Btn variant="ghost" color={C.muted} onPress={cancelShort} style={{ marginTop: 10 }}>{t("cancel")}</Btn>
          </>
        )}
        {/* Why nothing happened — locked, too few photos, or a failure. A tap
            that produces silence is the least helpful possible answer. */}
        {!!albumMsg && (
          <View style={{
            marginTop: 10, backgroundColor: C.gold + "14",
            borderWidth: 1, borderColor: C.gold + "44", borderRadius: 12, padding: 12,
          }}>
            <Text style={{ color: C.gold, fontSize: 13, lineHeight: 19 }}>{albumMsg}</Text>
          </View>
        )}
      </ScrollView>

      {paywall && <Paywall onClose={() => setPaywall(false)} />}

      {editing && (
        <ShortEditor visible scenes={editing} onCancel={() => setEditing(null)} onRender={renderEdited} />
      )}

      {shortPayload && (
        <ShortRenderer
          payload={shortPayload}
          onProgress={setShortPct}
          onDone={async (uri) => {
            setShortPayload(null);
            setShortPct(null);
            try { await shareShort(uri); } catch { setAlbumMsg(t("shortFailed")); }
          }}
          onError={(reason) => {
            setShortPayload(null);
            setShortPct(null);
            setAlbumMsg(reason === "unsupported" ? t("shortUnsupported") : t("shortFailed"));
          }}
        />
      )}

      {openStop && (
        <StopDetail stop={openStop.stop} prev={openStop.prev} destName={r.destName} route={r} onClose={() => setOpenStop(null)} onToggleDone={toggleDone} onRate={rateOpenStop} onNote={noteOpenStop} />
      )}
      {recap && <RecapSheet route={r} onClose={() => setRecap(false)} onShare={() => { setRecap(false); shareTrip(); }} />}
      {collab && (
        <View style={StyleSheet.absoluteFill}>
          <Collab route={r} onClose={() => setCollab(false)} />
        </View>
      )}
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  backBtn: {
    position: "absolute", top: 10, left: 12, width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.bg + "aa", borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center",
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 18, paddingHorizontal: 4 },
  emoji: { width: 58, height: 58, borderRadius: 18, backgroundColor: C.gold + "20", borderWidth: 1, borderColor: C.gold + "35", alignItems: "center", justifyContent: "center" },
  title: { fontFamily: FONT.display, color: C.cream, fontSize: 24, letterSpacing: -0.4 },
  budget: { backgroundColor: C.card, borderWidth: 1, borderColor: C.gold + "30", borderRadius: 18, padding: 16, marginBottom: 18 },
  budgetHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  eyebrow: { color: C.muted, fontSize: 11, fontFamily: FONT.extrabold, letterSpacing: 2, textTransform: "uppercase" },
  curBtn: { backgroundColor: C.gold + "18", borderWidth: 1, borderColor: C.gold + "44", borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  budgetTotal: { fontFamily: FONT.display, color: C.gold, fontSize: 34, letterSpacing: -0.5 },
  budgetRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 5 },
  infoCard: { backgroundColor: C.card, borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 18 },
  infoHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  dayHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" },
  dayBadge: { backgroundColor: C.gold, borderRadius: 9, paddingVertical: 5, paddingHorizontal: 12 },
  kmPill: { backgroundColor: C.mutedLight + "18", borderWidth: 1, borderColor: C.border, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9 },
  mapsPill: { backgroundColor: C.blue + "18", borderWidth: 1, borderColor: C.blue + "44", borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9 },
  wxPill: { backgroundColor: C.blue + "14", borderWidth: 1, borderColor: C.border, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9 },
  stopRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 12 },
  stopNum: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.card, borderWidth: 2, borderColor: C.gold, alignItems: "center", justifyContent: "center" },
  stopCard: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 10 },
  stopName: { color: C.cream, fontFamily: FONT.bold, fontSize: 16 },
  extra: { backgroundColor: C.gold + "10", borderRadius: 14, padding: 14, marginTop: 4 },
  savedBox: { backgroundColor: C.green + "18", borderWidth: 1, borderColor: C.green + "50", borderRadius: 16, padding: 16, alignItems: "center" },
  backdrop: { flex: 1, backgroundColor: "#000a", justifyContent: "flex-end" },
  sheet: { backgroundColor: C.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 22, paddingBottom: 34, maxHeight: "88%" },
  grab: { width: 40, height: 5, borderRadius: 3, backgroundColor: C.border, alignSelf: "center", marginBottom: 16 },
  stopTitle: { fontFamily: FONT.display, color: C.cream, fontSize: 26, letterSpacing: -0.4 },
  pills: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 18 },
  pillRow: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.gold + "1c", borderRadius: 8, paddingVertical: 7, paddingHorizontal: 11 },
  pill: { color: C.gold, fontSize: 13, fontFamily: FONT.semibold },
  tip: { backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 18, borderLeftWidth: 3, borderLeftColor: C.gold },
  noteInput: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, color: C.cream, fontSize: 14, fontFamily: FONT.body, minHeight: 54, textAlignVertical: "top", marginBottom: 18 },
  rating: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, marginTop: 10 },
}));
