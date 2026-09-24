import { useState, useEffect, useRef, Fragment } from "react";
import { C, F } from "../theme.js";
import { Btn } from "../components/ui.jsx";
import { travelBetween, optimizeItinerary, dayDistanceKm } from "../geo.js";
import { phrasesFor, goodToKnow, countryFlag } from "../locale.js";
import { generateRoute, computeBudget, recomputeRoute } from "../mockEngine.js";
import { generateRouteSmart } from "../aiEngine.js";
import { loadCollab } from "../mockCollab.js";
import { fetchWeather } from "../weather.js";
import { useI18n, tripTitle } from "../i18n.js";
import { fmtDate, computeTripStats } from "../utils.js";
import { useOnline } from "../useOnline.js";
import RouteMap from "../components/RouteMap.jsx";
import PoiImage from "../components/PoiImage.jsx";
import ShareSheet from "../components/ShareSheet.jsx";
import RecapSheet from "../components/RecapSheet.jsx";
import BudgetCard from "../components/BudgetCard.jsx";
import StopDetail from "../components/StopDetail.jsx";
import RefineSheet from "../components/RefineSheet.jsx";
import GoodToKnowCard from "../components/GoodToKnowCard.jsx";
import TripSummary from "../components/TripSummary.jsx";
import NowCard from "../components/NowCard.jsx";
import PhrasesCard from "../components/PhrasesCard.jsx";
import { parseTime, fmtMin, computeTripNow } from "../routeTime.js";
import Collab from "./Collab.jsx";
import Hint, { hasSeenHint, markHintSeen } from "../components/Hint.jsx";
import {
  Users, Share2, MapPin, Clock, Gift, Check, List, Map, Navigation, Footprints,
  RefreshCw, LocateFixed, CloudRain, TriangleAlert, Trash2, NotebookPen, X, Bus,
  Save, PartyPopper, MessageCircle, Zap, Pencil, Undo2, CategoryIcon, WeatherIcon,
} from "../icons.jsx";

// ---- Main Route screen ------------------------------------------------------
export default function Route({ route, prefs, user, onBack, onUpdate, onSaved }) {
  const { t, lang } = useI18n();
  const online = useOnline();
  // Stored as { stop, prev } so the detail sheet can offer "Directions from
  // <prev>". Callers that don't know a prev (e.g. RouteMap pin taps) pass null.
  const [openStop, setOpenStop] = useState(null);
  // Track the stop's position (day/stop index) so edits target exactly this
  // stop — matching by name would hit any other stop that shares the name.
  const openStopWith = (stop, prev = null) => {
    let di = -1, si = -1;
    route.itinerary.forEach((d, dIdx) => {
      const sIdx = d.stops.indexOf(stop);
      if (sIdx !== -1) { di = dIdx; si = sIdx; }
    });
    setOpenStop({ stop, prev, di, si });
    // Opening a stop = the coach mark's job is done; hide it forever.
    if (showTapHint) dismissTapHint();
  };
  const [refine, setRefine] = useState(false);
  const [share, setShare] = useState(false);
  const [collab, setCollab] = useState(false);
  const [recap, setRecap] = useState(false);
  const [toast, setToast] = useState(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState("list");
  const [editing, setEditing] = useState(false);
  // Coach mark on the first stop — dismisses on tap of any stop or the hint's X.
  const [showTapHint, setShowTapHint] = useState(!hasSeenHint("route-tap-stop"));
  const dismissTapHint = () => { markHintSeen("route-tap-stop"); setShowTapHint(false); };
  const [weather, setWeather] = useState({});
  const [addingDay, setAddingDay] = useState(null); // day index a new stop is being added to
  const [newName, setNewName] = useState("");
  const [newTime, setNewTime] = useState("");
  const [myLocation, setMyLocation] = useState(null); // { lat, lng } once granted
  const [locBusy, setLocBusy] = useState(false);
  const [currency, setCurrencyS] = useState(() => localStorage.getItem("vai_currency") || "EUR");
  const setCurrency = (c) => { setCurrencyS(c); try { localStorage.setItem("vai_currency", c); } catch {} };
  const phrases = phrasesFor(route.country);
  const arrivalInfo = goodToKnow(route.country);

  // Live "now" state — refreshes every minute so the countdown stays accurate.
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNowTick((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, []);
  // eslint-disable-next-line no-unused-expressions
  nowTick; // depend on the ticker so this recomputes each minute
  const tripNow = computeTripNow(route, new Date());

  // Read once per render so the header badge reflects the latest group size
  // (re-read whenever we toggle the collab overlay).
  const groupCount = loadCollab(route).members.length;

  // Fetch the per-day forecast when we have coordinates and a start date.
  useEffect(() => {
    let on = true;
    fetchWeather(route.center, route.startDate, route.days).then((w) => { if (on) setWeather(w); });
    return () => { on = false; };
  }, [route.center, route.startDate, route.days]);

  // ---- itinerary editing ----
  const editItinerary = (mutator) => {
    const itinerary = route.itinerary.map((d) => ({ ...d, stops: [...d.stops] }));
    mutator(itinerary);
    onUpdate(recomputeRoute({ ...route, itinerary }), prefs);
  };
  const moveStop = (di, si, dir) => editItinerary((it) => {
    const stops = it[di].stops, j = si + dir;
    if (j < 0 || j >= stops.length) return;
    [stops[si], stops[j]] = [stops[j], stops[si]];
  });
  const deleteStop = (di, si) => {
    const removed = route.itinerary[di]?.stops?.[si];
    const itinerary = route.itinerary.map((d) => ({ ...d, stops: [...d.stops] }));
    itinerary[di].stops.splice(si, 1);
    // Snapshot first so the delete can be undone from the toast.
    snapshotAndUpdate(recomputeRoute({ ...route, itinerary }), prefs);
    flash(t("toastStopRemoved", { name: removed?.name || "" }), { label: t("undo"), fn: undoLast });
  };
  const setStopTime = (di, si, time) => editItinerary((it) => { it[di].stops[si] = { ...it[di].stops[si], time }; });
  const addStop = (di) => {
    if (!newName.trim()) return;
    editItinerary((it) => {
      const dur = 60;
      it[di].stops.push({
        name: newName.trim(), emoji: "📍", tags: [], dur, hours: "—", cost: 0,
        tip: t("addedTip"), time: newTime.trim() || "—",
        durLabel: dur % 60 === 0 ? `${dur / 60}h` : `${dur}m`, done: false,
      });
    });
    setNewName(""); setNewTime(""); setAddingDay(null);
    flash(t("toastStopAdded"));
  };

  // Toast can be a plain string (auto-dismisses) or an object with an inline
  // action (e.g. Undo). Actioned toasts persist longer so the user has time to
  // hit them.
  const flash = (msg, action = null) => {
    const payload = action ? { msg, action } : msg;
    setToast(payload);
    setTimeout(() => setToast((t) => (t === payload ? null : t)), action ? 6000 : 2200);
  };

  // Stack of prior routes for the Undo affordance. Only tracks the last 3 to
  // keep memory bounded; every AI/optimize/tier change pushes here first.
  const [history, setHistory] = useState([]);
  const snapshotAndUpdate = (nextRoute, nextPrefs) => {
    setHistory((h) => [{ route, prefs }, ...h].slice(0, 3));
    onUpdate(nextRoute, nextPrefs);
  };
  const undoLast = () => {
    if (!history.length) return;
    const [snap, ...rest] = history;
    // Side effects must run outside the state updater — calling a parent's
    // setState from inside setHistory's updater triggers a render-phase warning.
    setHistory(rest);
    onUpdate(snap.route, snap.prefs);
    flash(t("refineUndone"));
  };

  // Tier only affects the budget math — recompute it locally instead of
  // regenerating, so an AI-built itinerary is preserved (and it's instant).
  const changeTier = (tier) => {
    const updated = { ...route, budget: computeBudget(route.itinerary, route.days, tier) };
    onUpdate(updated, { ...prefs, budget: tier });
    flash(t("toastBudget", { x: t("tier" + tier) }));
  };

  // Open the whole trip as a multi-stop route in Google Maps.
  // Open an ordered list of stops in Google Maps — either the whole trip or a
  // single day. Google Maps caps directions at 10 waypoints; over that we flash
  // a warning and truncate. When `fromHere` is set, we prepend the user's own
  // coordinates as the origin so Maps computes directions from where they are.
  const openStopsInMaps = (stops, fromHere = null) => {
    const points = [];
    if (fromHere) points.push(`${fromHere.lat},${fromHere.lng}`);
    for (const s of stops) if (s.ll) points.push(`${s.ll[0]},${s.ll[1]}`);
    let pts = points;
    if (pts.length === 0) return;
    if (pts.length === 1) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pts[0])}`, "_blank");
      return;
    }
    const truncated = pts.length > 10;
    if (truncated) pts = pts.slice(0, 10);
    const origin = pts[0];
    const destination = pts[pts.length - 1];
    const waypoints = pts.slice(1, -1).join("|");
    let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
    if (waypoints) url += `&waypoints=${encodeURIComponent(waypoints)}`;
    window.open(url, "_blank");
    if (truncated) flash(t("mapsCap"));
  };
  const openTripInMaps = () => openStopsInMaps(route.itinerary.flatMap((d) => d.stops), myLocation);
  const openDayInMaps = (day, useMyLoc = false) => openStopsInMaps(day.stops, useMyLoc ? myLocation : null);

  // Ask the browser for the current position once, cache it in state. If the
  // user denies or geolocation isn't available, flash a friendly toast — the
  // buttons behave as if `From here` had never been requested.
  const requestMyLocation = () => new Promise((resolve) => {
    if (!navigator.geolocation) { flash(t("locDenied")); resolve(null); return; }
    setLocBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMyLocation(loc);
        setLocBusy(false);
        resolve(loc);
      },
      () => { flash(t("locDenied")); setLocBusy(false); resolve(null); },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  });

  // Handler used by the per-day "📍 From here" pill: gets a fix if we don't
  // already have one, then opens that day's route in Maps starting from it.
  const openDayFromHere = async (day) => {
    const loc = myLocation || (await requestMyLocation());
    if (loc) openStopsInMaps(day.stops, loc);
  };

  const applyRefine = async (newPrefs, msg) => {
    setRefine(false);
    setBusy(true);
    // `instruction` (free-text request) feeds the AI prompt but shouldn't stick
    // to prefs for future regenerations.
    const { instruction, ...cleanPrefs } = newPrefs;
    const undoAction = { label: t("undo"), fn: undoLast };
    try {
      const next = await generateRouteSmart(newPrefs);
      snapshotAndUpdate(next, cleanPrefs);
      flash(msg, undoAction);
    } catch {
      snapshotAndUpdate(generateRoute(cleanPrefs), cleanPrefs);
      flash(msg, undoAction);
    } finally {
      setBusy(false);
    }
  };

  const optimize = () => {
    snapshotAndUpdate(recomputeRoute({ ...route, itinerary: optimizeItinerary(route.itinerary) }), prefs);
    flash(t("routeOptimized"), { label: t("undo"), fn: undoLast });
  };

  // Mutate the currently-open stop by its position (not name — two stops can
  // share a name) and keep the sheet's own copy in sync so it re-renders.
  const editOpenStop = (mutate) => {
    if (!openStop || openStop.di < 0) return;
    const updated = { ...route };
    const st = updated.itinerary[openStop.di].stops[openStop.si];
    if (!st) return;
    mutate(st);
    onUpdate(updated, prefs);
    setOpenStop((o) => ({ ...o, stop: { ...st } }));
  };

  const toggleDone = () => editOpenStop((st) => { st.done = !st.done; });

  // Persist a 0-5 star rating for the currently-open stop.
  const rateOpenStop = (rating) => editOpenStop((st) => { st.rating = rating; });

  // Save a personal note on the currently-open stop (no recompute — a note
  // doesn't change timing or budget).
  const noteOpenStop = (note) => editOpenStop((st) => { st.note = note; });

  const save = () => {
    setSaved(true);
    // Don't persist the transient AI-engine flags into saved trips.
    const { _ai, _aiFailed, ...clean } = route;
    onSaved(clean);
    flash(user?.guest ? t("savedLocal") : t("savedCloud"));
  };

  // Re-run generation preferring the AI path (used by the "AI fell back" toast).
  const retryAI = async () => {
    setBusy(true);
    try {
      const next = await generateRouteSmart(prefs);
      onUpdate(next, prefs);
      if (next._ai) flash(t("aiRetried"));
      else if (next._aiFailed) flash(t("aiFallback"), { label: t("aiRetry"), fn: retryAI });
    } catch {
      /* keep the current route */
    } finally {
      setBusy(false);
    }
  };

  // When a route arrives that fell back from AI to the local engine, tell the
  // user transparently (once per route object) and offer a retry.
  const notifiedFallback = useRef(null);
  useEffect(() => {
    if (route._aiFailed && notifiedFallback.current !== route) {
      notifiedFallback.current = route;
      flash(t("aiFallback"), { label: t("aiRetry"), fn: retryAI });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  return (
    <>
      {/* Header — hero cover photo of the destination behind the title */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        {/* Taller than it was: at 190 the cover read as a strip rather than a
            photograph, and most of what showed was already under the fade. */}
        <div style={{ position: "relative", height: 224, overflow: "hidden" }}>
          <PoiImage name={route.destName} emoji={route.emoji} tags={route.interests} credit height="100%" radius={0} fontSize={90} style={{ width: "100%" }} />
          {/* Two overlays, each with one job: a faint dark scrim at the very
              top so the round controls stay visible over a bright sky, and a
              short fade at the very bottom so the photo meets the page instead
              of ending on a hard line.
              The bottom fade used to start at 58% and existed to make the title
              legible — the title was sitting on the photo and relied on this to
              rescue it. That washed out most of the picture, and it failed
              anyway whenever the title wrapped to two lines and rose above the
              opaque part. The title now has solid ground of its own (below),
              so this only has to blend an edge: 82% instead of 58% leaves the
              photograph almost entirely untouched. */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: `linear-gradient(180deg, rgba(0,0,0,0.24) 0%, rgba(0,0,0,0) 22%), linear-gradient(180deg, ${C.bg}00 82%, ${C.bg} 100%)`,
          }} />
        </div>
        {/* Top bar over the cover */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 44,
          padding: "0 12px", display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <button onClick={onBack} aria-label={t("back")} style={{
            width: 36, height: 36, borderRadius: "50%", background: `${C.bg}aa`, backdropFilter: "blur(6px)",
            border: `1px solid ${C.border}`, color: C.cream, fontSize: 20, cursor: "pointer",
          }}>‹</button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setCollab(true)} aria-label={t("planGroup")} style={{
              position: "relative", width: 36, height: 36, borderRadius: "50%",
              background: `${C.bg}aa`, backdropFilter: "blur(6px)", border: `1px solid ${C.border}`,
              color: C.cream, fontSize: 15, cursor: "pointer",
            }}>
              <Users size={16} aria-hidden="true" style={{ verticalAlign: -3 }} />
              <span style={{
                position: "absolute", top: -4, right: -4, background: C.gold, color: C.bg,
                fontSize: 10, fontWeight: 800, borderRadius: 999, minWidth: 16, height: 16,
                display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px",
              }}>{groupCount}</span>
            </button>
            <button onClick={() => setShare(true)} aria-label={t("shareTitle")} style={{
              width: 36, height: 36, borderRadius: "50%", background: `${C.bg}aa`, backdropFilter: "blur(6px)",
              border: `1px solid ${C.border}`, color: C.cream, fontSize: 15, cursor: "pointer",
            }}><Share2 size={16} style={{ verticalAlign: -3 }} /></button>
          </div>
        </div>
      </div>
      {/* Solid ground for the title.
          It used to be pulled up 8px onto the cover and left to survive on
          whatever the fade happened to leave behind it — which held only while
          the title stayed on one line. On a narrow phone "Brașov Gourmet · 3
          zile" wraps, the first line rises into the photograph, and dark serif
          text lands on sunlit buildings. An explicit background means the text
          is readable regardless of how it wraps, how long it is, or what the
          photo happens to show. */}
      <div style={{ flexShrink: 0, padding: "10px 18px 16px", background: C.bg, position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{
            width: 58, height: 58, borderRadius: 18, flexShrink: 0,
            background: `linear-gradient(150deg, ${C.gold}26, ${C.card})`,
            border: `1px solid ${C.gold}35`, display: "flex", alignItems: "center",
            justifyContent: "center", boxShadow: C.shadow,
          }}><CategoryIcon tags={route.interests} size={26} color={C.gold} /></span>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: F.display, color: C.cream, fontSize: 24, fontWeight: 700,
              letterSpacing: -0.4, lineHeight: 1.15,
            }}>{tripTitle(route, t)}</div>
            <div style={{ color: C.muted, fontSize: 13, marginTop: 4, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
              <MapPin size={12} />{route.totalStops} {t("stops")} · <Clock size={12} />~{route.totalHours}h {route.country && `· ${countryFlag(route.country) ? countryFlag(route.country) + " " : ""}${route.country}`}
            </div>
          </div>
        </div>

        {/* When arriving via a shared link, surface a save CTA — the trip lives
            only in the URL until the user opts in to keep it. */}
        {user?.method === "share" && (
          <div style={{
            marginTop: 14, background: `linear-gradient(120deg, ${C.gold}22, ${C.card} 65%)`,
            border: `1px solid ${C.gold}55`, borderRadius: 14, padding: "10px 14px",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            {saved ? <Check size={20} color={C.green} /> : <Gift size={20} color={C.gold} />}
            <div style={{ flex: 1, color: C.cream, fontSize: 13, fontWeight: 600 }}>
              {saved ? t("sharedSaved") : t("sharedIntro")}
            </div>
            {!saved && (
              <button className="vai-press" onClick={save} style={{
                background: C.goldGrad, color: C.bg, border: "none", borderRadius: 10,
                padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                boxShadow: `0 6px 16px ${C.gold}55`,
              }}>+ {t("saveTrip")}</button>
            )}
          </div>
        )}

        {route.hasMap && (
          <div style={{ display: "flex", gap: 6, marginTop: 14, background: C.card, borderRadius: 12, padding: 4 }}>
            {[["list", List, t("tabList")], ["map", Map, t("tabMap")]].map(([v, TabIcon, label]) => (
              <button key={v} onClick={() => setView(v)} style={{
                flex: 1, background: view === v ? C.gold : "transparent",
                color: view === v ? C.bg : C.mutedLight, border: "none", borderRadius: 9,
                padding: "9px 0", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}><TabIcon size={14} />{label}</button>
            ))}
          </div>
        )}
      </div>

      {/* Map view */}
      {view === "map" && route.hasMap && (
        <div style={{ flex: 1, position: "relative" }}>
          {online ? (
            <>
              <RouteMap days={route.itinerary} center={route.center} onPick={(s) => openStopWith(s, null)} />
              <button onClick={openTripInMaps} style={{
                position: "absolute", left: 16, bottom: 20, zIndex: 20,
                background: C.blue, color: "#fff", border: "none", borderRadius: 999,
                padding: "13px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer",
                boxShadow: `0 8px 24px ${C.blue}77`, fontFamily: "inherit",
              }}><Navigation size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Google Maps</button>
            </>
          ) : (
            <div style={{
              height: "100%", display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: 12, padding: "0 40px", textAlign: "center",
            }}>
              <div style={{ display: "flex", opacity: 0.6 }}><Map size={52} color={C.muted} strokeWidth={1.4} /></div>
              <div style={{ color: C.mutedLight, fontSize: 15 }}>{t("mapOffline")}</div>
            </div>
          )}
        </div>
      )}

      {/* Itinerary (list view) */}
      {view === "list" && (
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "12px 18px 120px" }}>
        {/* Fallback banner: shown when the whole trip is a generic template
            (city not in our library and no AI to draw on). Every stop is
            already `unverified: true`; this hoists that signal to the first
            thing the user reads, so they know to double-check the details. */}
        {route.itinerary?.[0]?.stops?.[0]?.unverified && (
          <div style={{
            background: `${C.red}12`, border: `1px solid ${C.red}40`, borderRadius: 14,
            padding: "12px 14px", marginBottom: 16, display: "flex", gap: 10,
          }}>
            <TriangleAlert size={16} color={C.red} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ color: C.red, fontSize: 13, lineHeight: 1.5 }}>
              {t("fallbackNotice", { city: route.destName })}
            </div>
          </div>
        )}
        {tripNow && <NowCard now={tripNow} route={route} currency={currency} />}
        <BudgetCard budget={route.budget} days={route.days} onTier={changeTier} currency={currency} onCurrency={setCurrency} />
        {phrases && <PhrasesCard phrases={phrases} />}
        {arrivalInfo && <GoodToKnowCard info={arrivalInfo} />}
        {route.hasMap && (
          <Btn variant="soft" color={C.blue} onClick={openTripInMaps} style={{ marginBottom: 18 }}>
            <Navigation size={15} style={{ verticalAlign: -2, marginRight: 7 }} />{t("openAllMaps")}
          </Btn>
        )}
        {route.itinerary.map((day, di) => {
          const w = day.date && weather[day.date];
          // Trigger the "indoor day" suggestion for rain/showers/storm codes.
          const wetDay = w && ["rain", "showers", "storm"].includes(w.code);
          // Total on-foot distance for this day, aggregated from coord pairs.
          const dayKm = dayDistanceKm(day.stops);
          return (
          <div key={day.day} style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
              {route.days > 1 && (
                <span style={{
                  background: C.goldGrad, color: C.bg, fontWeight: 800,
                  fontSize: 13, borderRadius: 9, padding: "5px 12px",
                  boxShadow: `0 4px 12px ${C.gold}44`,
                }}>{t("day", { n: day.day })}</span>
              )}
              {day.date && (
                <span style={{ color: C.mutedLight, fontSize: 13, fontWeight: 600, textTransform: "capitalize" }}>{fmtDate(day.date, lang)}</span>
              )}
              {dayKm > 0.15 && (
                <span title={t("dayDistance")} style={{
                  background: `${C.mutedLight}18`, color: C.mutedLight,
                  border: `1px solid ${C.border}`, borderRadius: 999, padding: "3px 9px",
                  fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
                }}><Footprints size={12} style={{ verticalAlign: -1.5, marginRight: 4 }} />{dayKm < 1 ? `${Math.round(dayKm * 1000)} m` : `${dayKm.toFixed(1)} km`}</span>
              )}
              {!editing && (
                <button className="vai-press" onClick={() => applyRefine({ ...prefs, instruction: `Regenerate only day ${day.day} with different stops that still match the interests (${(prefs.interests || []).join(", ") || "general"}). Keep the other days exactly as they are.` }, t("toastDayRegen", { n: day.day }))} title={t("regenDay")} style={{
                  marginLeft: day.stops.some((s) => s.ll) ? 0 : "auto",
                  background: `${C.purple}18`, color: C.purple, border: `1px solid ${C.purple}44`,
                  borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                }}><RefreshCw size={11} style={{ verticalAlign: -1.5, marginRight: 4 }} />{t("regenDay")}</button>
              )}
              {day.stops.some((s) => s.ll) && (
                <>
                  {di === 0 && (
                    <button className="vai-press" onClick={() => openDayFromHere(day)} disabled={locBusy} title={t("startFromHere")} style={{
                      marginLeft: editing ? "auto" : 0, background: myLocation ? C.green : `${C.green}18`,
                      color: myLocation ? C.bg : C.green, border: `1px solid ${C.green}55`,
                      borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 700,
                      cursor: locBusy ? "wait" : "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                      opacity: locBusy ? 0.6 : 1,
                    }}><LocateFixed size={11} style={{ verticalAlign: -1.5, marginRight: 4 }} />{locBusy ? "…" : (myLocation ? t("fromHereOn") : t("startFromHere"))}</button>
                  )}
                  <button className="vai-press" onClick={() => openDayInMaps(day, di === 0 && !!myLocation)} title={t("openDayMaps")} style={{
                    background: `${C.blue}18`, color: C.blue,
                    border: `1px solid ${C.blue}44`, borderRadius: 999, padding: "4px 10px",
                    fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                  }}><Navigation size={11} style={{ verticalAlign: -1.5, marginRight: 4 }} />Maps</button>
                </>
              )}
              {w && (
                <span style={{
                  marginLeft: day.stops.some((s) => s.ll) ? 0 : "auto", background: `${C.blue}1c`, color: C.mutedLight,
                  borderRadius: 8, padding: "4px 10px", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
                }} title={w.code ? t("wx_" + w.code) : undefined}>
                  <WeatherIcon code={w.code} size={14} style={{ verticalAlign: -2, marginRight: 4 }} />{w.tmax}° / {w.tmin}°
                </span>
              )}
            </div>

            {wetDay && !editing && (
              <div style={{
                background: `linear-gradient(120deg, ${C.blue}18, ${C.blue}08)`,
                border: `1px solid ${C.blue}44`, borderRadius: 14, padding: "12px 14px",
                marginBottom: 14, display: "flex", alignItems: "center", gap: 12,
              }}>
                <CloudRain size={22} color={C.blue} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, color: C.mutedLight, fontSize: 13, lineHeight: 1.4 }}>{t("weatherRain")}</div>
                <button className="vai-press" onClick={() => applyRefine({ ...prefs, instruction: `Focus day ${day.day} on indoor stops (museums, galleries, covered markets) — rain expected.` }, t("weatherRainCta"))} style={{
                  background: C.blue, color: "#fff", border: "none", borderRadius: 10,
                  padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
                }}>{t("weatherRainCta")}</button>
              </div>
            )}

            <div style={{ position: "relative", paddingLeft: 10 }}>
              {day.stops.map((stop, i) => {
                const tv = !editing && i < day.stops.length - 1 ? travelBetween(stop, day.stops[i + 1]) : null;
                // In editing mode, check if this stop's time is feasible given the
                // previous stop's finish time + estimated travel between them.
                let conflict = null;
                if (editing && i > 0) {
                  const prev = day.stops[i - 1];
                  const prevStart = parseTime(prev.time);
                  const thisStart = parseTime(stop.time);
                  if (prevStart != null && thisStart != null) {
                    const travel = travelBetween(prev, stop);
                    const required = prevStart + (prev.dur || 60) + (travel?.minutes || 0);
                    if (thisStart < required) conflict = { need: fmtMin(required), travel: travel?.minutes || 0 };
                  }
                }
                // "Now" state per stop — drives dimming for the past and a
                // green glow for the one you're currently visiting.
                let nowKind = "future";
                if (tripNow && !editing) {
                  if (di < tripNow.dayIndex) nowKind = "past";
                  else if (di === tripNow.dayIndex) {
                    if (tripNow.phase === "at" && i === tripNow.currentIndex) nowKind = "current";
                    else if (i < tripNow.currentIndex || (tripNow.phase === "moving" && i < tripNow.nextIndex)) nowKind = "past";
                    else if (tripNow.phase === "moving" && i === tripNow.nextIndex) nowKind = "next";
                  }
                }
                const isCurrent = nowKind === "current";
                const isPast = nowKind === "past";
                return (
                <Fragment key={i}>
                <div style={{ display: "flex", gap: 14, position: "relative" }}>
                  {/* First-time coach mark, hovering above the very first stop */}
                  {di === 0 && i === 0 && showTapHint && !editing && (
                    <Hint id="route-tap-stop" arrow="bottom" okLabel={t("hintOk")} onClose={dismissTapHint}
                      style={{ position: "absolute", top: -68, left: 8, zIndex: 30 }}>
                      {t("hintTapStop")}
                    </Hint>
                  )}
                  {/* timeline */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: "50%",
                      background: stop.done ? C.green : isCurrent ? C.green : C.card,
                      border: `2px solid ${stop.done || isCurrent ? C.green : C.gold}`,
                      color: stop.done || isCurrent ? C.bg : C.gold, display: "flex", alignItems: "center",
                      justifyContent: "center", fontWeight: 800, fontSize: 14, zIndex: 2,
                      opacity: isPast && !stop.done ? 0.5 : 1,
                      boxShadow: isCurrent ? `0 0 0 4px ${C.green}22, 0 0 22px ${C.green}88` : "none",
                      animation: isCurrent ? "vai-pulse 2s ease-in-out infinite" : "none",
                    }}>{stop.done ? <Check size={12} strokeWidth={3.2} /> : isCurrent ? "•" : i + 1}</div>
                    {i < day.stops.length - 1 && (
                      <div style={{
                        width: 2, flex: 1, minHeight: 30,
                        background: `linear-gradient(180deg, ${C.gold}66, ${C.border})`,
                      }} />
                    )}
                  </div>

                  {/* card */}
                  {editing ? (
                    <div style={{
                      flex: 1, background: C.card, border: `1px solid ${C.border}`,
                      borderRadius: 16, padding: "11px 13px", marginBottom: 12,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <CategoryIcon tags={stop.tags} size={20} color={C.gold} />
                        <div style={{ flex: 1, minWidth: 0, color: C.cream, fontWeight: 700, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stop.name}</div>
                        <input value={stop.time} onChange={(e) => setStopTime(di, i, e.target.value)} style={{
                          width: 62, background: C.bg, border: `1px solid ${conflict ? C.red : C.border}`, borderRadius: 8,
                          padding: "6px 8px", color: conflict ? C.red : C.cream, fontSize: 13, fontFamily: "inherit", outline: "none", textAlign: "center",
                        }} />
                      </div>
                      {conflict && (
                        <div style={{
                          background: `${C.red}12`, border: `1px solid ${C.red}40`, borderRadius: 10,
                          padding: "8px 11px", marginTop: 8, color: C.red, fontSize: 12, lineHeight: 1.45,
                        }}>
                          <TriangleAlert size={12} style={{ verticalAlign: -1.5, marginRight: 5 }} />{t("conflictWarn", { time: conflict.need, travel: conflict.travel })}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        {[["↑", () => moveStop(di, i, -1), i === 0], ["↓", () => moveStop(di, i, 1), i === day.stops.length - 1]].map(([lbl, fn, dis], k) => (
                          <button key={k} onClick={fn} disabled={dis} style={{
                            background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8,
                            color: C.mutedLight, fontSize: 15, width: 38, height: 32, cursor: dis ? "default" : "pointer",
                            opacity: dis ? 0.35 : 1, fontFamily: "inherit",
                          }}>{lbl}</button>
                        ))}
                        <button onClick={() => deleteStop(di, i)} aria-label={`${t("galDelete")} — ${stop.name}`} style={{
                          marginLeft: "auto", background: `${C.red}1c`, border: `1px solid ${C.red}55`, borderRadius: 8,
                          color: C.red, fontSize: 13, fontWeight: 700, padding: "0 14px", height: 32, cursor: "pointer", fontFamily: "inherit",
                        }}><Trash2 size={14} style={{ verticalAlign: -2 }} /></button>
                      </div>
                    </div>
                  ) : (
                    <button className="vai-lift" onClick={() => openStopWith(stop, i > 0 ? day.stops[i - 1] : null)} style={{
                      flex: 1, textAlign: "left",
                      background: isCurrent ? `linear-gradient(150deg, ${C.green}18, ${C.card} 65%)` : C.card,
                      border: `1px solid ${isCurrent ? C.green + "66" : C.border}`,
                      borderRadius: 16, padding: "10px 13px", marginBottom: 12, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 12, fontFamily: "inherit",
                      boxShadow: isCurrent ? `0 8px 24px ${C.green}33` : C.shadowSoft,
                      opacity: isPast && !stop.done ? 0.55 : 1,
                    }}>
                      <PoiImage name={stop.name} wiki={stop.wiki} img={stop.img} category={stop.category} context={route.destName} emoji={stop.emoji} tags={stop.tags} width={46} height={46} radius={10} fontSize={22} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: C.cream, fontWeight: 700, fontSize: 16, textDecoration: stop.done ? "line-through" : "none", opacity: stop.done ? 0.6 : 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {stop.name}
                        </div>
                        <div style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>
                          <Clock size={12} style={{ verticalAlign: -1.5, marginRight: 4 }} />{stop.time} · {stop.durLabel}
                          {stop.note ? (
                            <span style={{ color: C.gold, marginLeft: 8 }} title={stop.note}>
                              <NotebookPen size={12} style={{ verticalAlign: -1.5, marginRight: 3 }} />{t("noteBadge")}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <span style={{ color: C.muted, fontSize: 18 }}>›</span>
                    </button>
                  )}
                </div>
                {tv && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "-4px 0 8px 44px", color: C.muted, fontSize: 12 }}>
                    {tv.walk ? <Footprints size={12} style={{ opacity: 0.85 }} /> : <Bus size={12} style={{ opacity: 0.85 }} />}
                    <span>{tv.minutes} min · {tv.dist}</span>
                  </div>
                )}
                </Fragment>
                );
              })}

              {editing && (
                addingDay === di ? (
                  <div style={{ background: C.surface, border: `1px dashed ${C.gold}66`, borderRadius: 14, padding: "12px", marginLeft: 44 }}>
                    <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t("stopName")} autoFocus style={{
                      width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
                      padding: "10px 12px", color: C.cream, fontSize: 14, fontFamily: "inherit", outline: "none", marginBottom: 8,
                    }} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <input value={newTime} onChange={(e) => setNewTime(e.target.value)} placeholder={t("stopTime")} style={{
                        flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
                        padding: "10px 12px", color: C.cream, fontSize: 14, fontFamily: "inherit", outline: "none",
                      }} />
                      <button onClick={() => addStop(di)} style={{
                        background: C.gold, border: "none", borderRadius: 8, color: C.bg, fontWeight: 700,
                        padding: "0 16px", cursor: "pointer", fontFamily: "inherit",
                      }}>{t("add")}</button>
                      <button onClick={() => { setAddingDay(null); setNewName(""); setNewTime(""); }} aria-label={t("cancel")} style={{
                        background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted,
                        padding: "0 12px", cursor: "pointer", fontFamily: "inherit",
                      }}><X size={14} style={{ verticalAlign: -2 }} /></button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setAddingDay(di); setNewName(""); setNewTime(""); }} style={{
                    marginLeft: 44, background: "transparent", border: `1px dashed ${C.border}`, borderRadius: 12,
                    color: C.mutedLight, fontSize: 14, fontWeight: 600, padding: "11px 0", width: "calc(100% - 44px)",
                    cursor: "pointer", fontFamily: "inherit",
                  }}>+ {t("addStop")}</button>
                )
              )}
            </div>

            {/* day extras — skip the panel entirely when there's nothing in it */}
            {(day.lunch || day.transport) && (
              <div style={{ background: `${C.gold}10`, borderRadius: 14, padding: "12px 15px", marginTop: 4 }}>
                {day.lunch && <div style={{ color: C.gold, fontSize: 14, marginBottom: day.transport ? 6 : 0 }}>{day.lunch}</div>}
                {day.transport && <div style={{ color: C.muted, fontSize: 13 }}>{day.transport}</div>}
              </div>
            )}
          </div>
          );
        })}

        {/* End-of-trip summary — hidden until at least one stop is checked off. */}
        <TripSummary stats={computeTripStats(route)} t={t} />

        {/* save block */}
        <div style={{ marginTop: 8 }}>
          {!saved ? (
            <Btn onClick={save}><Save size={16} style={{ verticalAlign: -2.5, marginRight: 8 }} />{t("save")}</Btn>
          ) : (
            <div style={{
              background: `${C.green}18`, border: `1px solid ${C.green}50`, borderRadius: 16,
              padding: "16px", textAlign: "center", color: C.green, fontWeight: 700, fontSize: 16,
            }}><Check size={16} style={{ verticalAlign: -2.5, marginRight: 6 }} />{t("saved")}</div>
          )}
          <Btn variant="soft" color={C.gold} onClick={() => setRecap(true)} style={{ marginTop: 10 }}>
            <PartyPopper size={16} style={{ verticalAlign: -2.5, marginRight: 8 }} />{t("recapOpen")}
          </Btn>
          <Btn variant="ghost" color={C.purple} onClick={() => setRefine(true)} style={{ marginTop: 10 }}>
            <MessageCircle size={16} style={{ verticalAlign: -2.5, marginRight: 8 }} />{t("modify")}
          </Btn>
          <Btn variant="soft" color={C.blue} onClick={() => setCollab(true)} style={{ marginTop: 10 }}>
            <Users size={16} style={{ verticalAlign: -2.5, marginRight: 8 }} />{t("planGroup")}{groupCount > 1 ? ` · ${groupCount}` : ""}
          </Btn>
          {route.hasMap && (
            <Btn variant="soft" color={C.green} onClick={optimize} style={{ marginTop: 10 }}>
              <Zap size={16} style={{ verticalAlign: -2.5, marginRight: 8 }} />{t("optimizeRoute")}
            </Btn>
          )}
          <Btn
            variant={editing ? "primary" : "ghost"}
            color={editing ? C.green : C.muted}
            onClick={() => { setEditing((e) => !e); setAddingDay(null); }}
            style={{ marginTop: 10 }}
          >
            {editing
              ? <><Check size={16} style={{ verticalAlign: -2.5, marginRight: 8 }} />{t("editDone")}</>
              : <><Pencil size={15} style={{ verticalAlign: -2, marginRight: 8 }} />{t("edit")}</>}
          </Btn>
        </div>
      </div>
      )}

      {/* Floating refine FAB */}
      {!refine && !openStop && !share && !collab && !editing && (
        <button className="vai-lift" onClick={() => setRefine(true)} aria-label={t("modify")} style={{
          position: "absolute", right: 20, bottom: 26, zIndex: 20,
          width: 58, height: 58, borderRadius: "50%", border: "none",
          background: `linear-gradient(135deg, ${C.purple}, ${C.blue})`,
          color: "#fff", cursor: "pointer", boxShadow: `0 12px 32px ${C.purple}66`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}><MessageCircle size={24} /></button>
      )}

      {/* Toast — anchored above the floating refine FAB (which sits at bottom:26,
          height:58) plus safe breathing space so both stay readable together. */}
      {toast && (
        <div style={{
          position: "absolute", left: "50%", bottom: 108, transform: "translateX(-50%)",
          maxWidth: "calc(100% - 32px)",
          background: C.cream, color: C.bg, padding: "10px 8px 10px 20px", borderRadius: 999,
          fontSize: 14, fontWeight: 700, zIndex: 40, whiteSpace: "nowrap",
          overflow: "hidden", textOverflow: "ellipsis",
          animation: "vai-pop .2s both", boxShadow: "0 10px 30px #0008",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <span>{typeof toast === "string" ? toast : toast.msg}</span>
          {typeof toast === "object" && toast.action && (
            <button className="vai-press" onClick={() => { toast.action.fn(); setToast(null); }} style={{
              background: C.gold, color: C.bg, border: "none", borderRadius: 999,
              padding: "6px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
            }}><Undo2 size={13} style={{ verticalAlign: -2, marginRight: 5 }} />{toast.action.label}</button>
          )}
        </div>
      )}

      {busy && (
        <div style={{
          position: "absolute", inset: 0, background: "#000b", zIndex: 45,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16,
        }}>
          <div style={{
            width: 46, height: 46, borderRadius: "50%",
            border: `3px solid ${C.border}`, borderTopColor: C.gold,
            animation: "vai-spin 0.9s linear infinite",
          }} />
          <div style={{ color: C.cream, fontSize: 15, fontWeight: 600 }}>{t("updating")}</div>
        </div>
      )}

      {openStop && <StopDetail stop={openStop.stop} prevStop={openStop.prev} onClose={() => setOpenStop(null)} onToggleDone={toggleDone} onRate={rateOpenStop} onNote={noteOpenStop} destName={route.destName} country={route.country} route={route} />}
      {refine && <RefineSheet prefs={prefs} onClose={() => setRefine(false)} onApply={applyRefine} />}
      {recap && <RecapSheet route={route} onClose={() => setRecap(false)} onShare={() => { setRecap(false); setShare(true); }} />}
      {share && <ShareSheet route={route} onClose={() => setShare(false)} printCtx={{ t, fmtDate: (iso) => fmtDate(iso, lang) }} />}
      {collab && <Collab route={route} user={user} onClose={() => setCollab(false)} />}
    </>
  );
}
