import { useState } from "react";
import { View, Text, ScrollView, Pressable, Modal, Linking, Share, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { C, themedStyles } from "../lib/theme.js";
import { useI18n, tripTitle } from "../lib/i18n.js";
import { FONT } from "../fonts.js";
import { Btn } from "../components/ui.js";
import PoiImage from "../components/PoiImage.js";
import RecapSheet from "../components/RecapSheet.js";
import { CURRENCIES, convert, phrasesFor, goodToKnow } from "../lib/locale.js";
import { countryName, countryFlagOf } from "../lib/countryNames.js";
import { dayDistanceKm } from "../lib/geo.js";
import { isPremium, usePremium } from "../lib/premium.js";
import Paywall from "../components/Paywall.js";
import { exportAlbumPdf, buildShortPayload, shareShort } from "../lib/albumExport.js";
import { MIN_PHOTOS } from "../lib/album.js";
import ShortRenderer from "../components/ShortRenderer.js";
import { listMemories } from "../lib/gallery.js";
import {
  Star, Clock, Ticket, Lightbulb, NotebookPen, Map, Navigation, Check,
  MapPin, Footprints, Save, PartyPopper, Share2, MessagesSquare, Hand, Heart,
  Coins, Bath, LifeBuoy, Ambulance, Plug, ArrowLeftRight, Utensils, TrainFront,
  Hourglass, CategoryIcon, Camera, Lock, Film,
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

function StopDetail({ stop, prev, destName, onClose, onToggleDone, onRate, onNote }) {
  const { t } = useI18n();
  const canDir = prev && prev.ll && stop.ll;
  const [note, setNote] = useState(stop.note || "");
  const commitNote = () => { if ((note || "") !== (stop.note || "")) onNote(note.trim()); };
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
          <PoiImage name={stop.name} wiki={stop.wiki} context={destName} emoji={stop.emoji} tags={stop.tags} height={170} radius={18} fontSize={64} style={{ marginBottom: 16 }} />
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
  const startShort = async () => {
    if (!isPremium()) { setPaywall(true); return; }
    setAlbumMsg("");
    setShortPct(0);
    try {
      const payload = await buildShortPayload(r, listMemories(), {
        title: r.destName,
        subtitle: `${listMemories().filter((m) => m.tripId === r.id).length} ${t("albumPhotos")}`,
        dayPrefix: t("day", { n: "" }).replace(/\s*\{?n?\}?\s*/g, "").trim() || "",
        outro: "Turism, dar simplu!",
      });
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

  const phrases = phrasesFor(r.country);
  const info = goodToKnow(r.country);
  const cycleCur = () => setCurrency((c) => CUR_CODES[(CUR_CODES.indexOf(c) + 1) % CUR_CODES.length]);

  const [recap, setRecap] = useState(false);

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

  const toggleDone = () => editOpenStop({ done: !openStop.stop.done });
  const rateOpenStop = (rating) => editOpenStop({ rating });
  const noteOpenStop = (note) => editOpenStop({ note });

  // Share a plain-text itinerary via the native share sheet (no hosted URL).
  const shareTrip = async () => {
    const lines = [tripTitle(r, t), ""];
    r.itinerary.forEach((day) => {
      if (r.days > 1) lines.push(t("day", { n: day.day }) + ":");
      day.stops.forEach((s) => {
        lines.push(`${s.time} · ${s.emoji || "📍"} ${s.name}`);
        if (s.note) lines.push(`   📝 ${s.note}`);
      });
      lines.push("");
    });
    lines.push("Turism, dar simplu!");
    try { await Share.share({ message: lines.join("\n"), title: tripTitle(r, t) }); } catch {}
  };

  return (
    <View style={styles.wrap}>
      {/* Cover */}
      <View style={{ height: 190 }}>
        <PoiImage name={r.destName} emoji={r.emoji} tags={r.interests} height={190} radius={0} fontSize={90} />
        <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
          <Text style={{ color: C.cream, fontSize: 20 }}>‹</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 40 }} style={{ marginTop: -8 }}>
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
        <StopDetail stop={openStop.stop} prev={openStop.prev} destName={r.destName} onClose={() => setOpenStop(null)} onToggleDone={toggleDone} onRate={rateOpenStop} onNote={noteOpenStop} />
      )}
      {recap && <RecapSheet route={r} onClose={() => setRecap(false)} onShare={() => { setRecap(false); shareTrip(); }} />}
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
