import { useState, useEffect, useRef, useMemo } from "react";
import { C, F } from "../theme.js";
import { StatusBar, Label, Btn } from "../components/ui.jsx";
import { useI18n, tripTitle } from "../i18n.js";
import { addMemory, listMemories, deleteMemory, resizeImage } from "../gallery.js";
import { buildAlbum, hasEnoughForAlbum, MIN_PHOTOS } from "../album.js";
import { applyRecipe } from "../shortEdit.js";
import { printAlbum } from "../exporters.js";
import { renderShort, canRenderShort, saveOrShareShort, toScenes } from "../shortVideo.js";
import { isPremium } from "../premium.js";
import MemoryMap from "../components/MemoryMap.jsx";
import ShortEditor from "../components/ShortEditor.jsx";
import { Camera, Save, Trash2, MapPin, TriangleAlert, LayoutGrid, Map, Lock, Film } from "../icons.jsx";

// Soft warning once the gallery grows large — photos live in the browser's
// storage, which has limits; nudge the user to prune before it fills up.
const GALLERY_WARN = 50;

const fmtDay = (ts, locale) =>
  new Date(ts).toLocaleDateString(locale === "zh" ? "zh-CN" : locale || "en", { day: "numeric", month: "short", year: "numeric" });

// Compose overlay shown after a photo is picked: preview + caption + optional
// link to one of the user's saved trips.
function Compose({ photo, saved, onSave, onCancel }) {
  const { t } = useI18n();
  const [caption, setCaption] = useState("");
  const [tripId, setTripId] = useState(saved[0]?.id || "");
  const trip = saved.find((r) => r.id === tripId);

  return (
    <div onClick={onCancel} style={{
      position: "absolute", inset: 0, background: "#000c", zIndex: 40,
      display: "flex", alignItems: "flex-end", animation: "vai-pop .2s both",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", background: C.surface, borderRadius: "26px 26px 0 0",
        padding: "10px 22px 26px", animation: "vai-rise .25s both", maxHeight: "92%", overflowY: "auto",
      }}>
        <div style={{ width: 40, height: 5, background: C.border, borderRadius: 3, margin: "0 auto 16px" }} />
        <div style={{ fontFamily: F.display, color: C.cream, fontSize: 21, fontWeight: 700, letterSpacing: -0.3, marginBottom: 14 }}>
          <Camera size={19} style={{ verticalAlign: -3, marginRight: 7 }} />{t("galAddTitle")}
        </div>

        {/* contain, not cover: this is the moment someone decides whether to
            keep the picture and what to call it, and they were being shown a
            cropped version of it. */}
        <img src={photo} alt="" style={{ width: "100%", borderRadius: 16, marginBottom: 16, maxHeight: 260, objectFit: "contain", background: C.bg }} />

        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder={t("galCaptionPh")}
          style={{
            width: "100%", background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
            padding: "13px 14px", color: C.cream, fontSize: 15, fontFamily: "inherit", outline: "none", marginBottom: 14,
          }}
        />

        {saved.length > 0 && (
          <>
            <Label color={C.muted}>{t("galLinkTrip")}</Label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0 18px" }}>
              {saved.map((r) => {
                const on = r.id === tripId;
                return (
                  <button key={r.id} className="vai-press" onClick={() => setTripId(on ? "" : r.id)} style={{
                    background: on ? C.gold : C.card, color: on ? C.bg : C.mutedLight,
                    border: `1px solid ${on ? C.gold : C.border}`, borderRadius: 999,
                    padding: "8px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  }}>{r.emoji} {r.destName}</button>
                );
              })}
            </div>
          </>
        )}

        <Btn onClick={() => onSave({ caption: caption.trim(), tripId: trip?.id || null, tripTitle: trip ? tripTitle(trip, t) : null })}>
          <Save size={16} style={{ verticalAlign: -2.5, marginRight: 7 }} />{t("galSave")}
        </Btn>
      </div>
    </div>
  );
}

// Full-screen viewer for one memory, with delete.
function Viewer({ memory, onClose, onDelete }) {
  const { t, lang } = useI18n();
  return (
    <div onClick={onClose} style={{
      position: "absolute", inset: 0, background: "#000d", zIndex: 45,
      display: "flex", flexDirection: "column", animation: "vai-pop .2s both",
    }}>
      <div style={{ height: 44, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px" }}>
        <button onClick={onClose} aria-label={t("back")} style={{ background: "none", border: "none", color: "#fff", fontSize: 26, cursor: "pointer" }}>✕</button>
        <button onClick={() => onDelete(memory.id)} style={{
          background: `${C.red}22`, border: `1px solid ${C.red}66`, color: C.red,
          borderRadius: 999, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        }}><Trash2 size={13} style={{ verticalAlign: -2, marginRight: 5 }} />{t("galDelete")}</button>
      </div>
      <div onClick={(e) => e.stopPropagation()} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 16px 24px" }}>
        <img src={memory.dataUrl} alt={memory.caption || t("navGallery")} style={{ width: "100%", borderRadius: 16, maxHeight: "62%", objectFit: "contain" }} />
        {memory.caption ? (
          <div style={{ color: "#fff", fontSize: 17, fontWeight: 600, marginTop: 16 }}>{memory.caption}</div>
        ) : null}
        <div style={{ color: "#ffffffaa", fontSize: 13, marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
          {memory.tripTitle ? <><MapPin size={12} />{memory.tripTitle} · </> : null}{fmtDay(memory.ts, lang)}
        </div>
      </div>
    </div>
  );
}

export default function Gallery({ saved }) {
  const { t, lang } = useI18n();
  const [memories, setMemories] = useState(null); // null = loading
  const [pending, setPending] = useState(null);   // a resized dataUrl awaiting caption
  const [viewing, setViewing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState("grid");        // grid | map
  const fileRef = useRef(null);

  const geoCount = (memories || []).filter((m) => Array.isArray(m.ll)).length;

  const refresh = () => listMemories().then(setMemories).catch(() => setMemories([]));
  useEffect(() => { refresh(); }, []);

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await resizeImage(file);
      setPending(dataUrl);
    } catch {
      /* ignore bad image */
    } finally {
      setBusy(false);
    }
  };

  const save = async ({ caption, tripId, tripTitle: tt }) => {
    const memory = {
      id: `m${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      ts: Date.now(), dataUrl: pending, caption, tripId, tripTitle: tt, stopName: null,
    };
    await addMemory(memory);
    setPending(null);
    refresh();
  };

  const remove = async (id) => {
    await deleteMemory(id);
    setViewing(null);
    refresh();
  };

  // Which saved trips actually have enough photos here to make an album. A trip
  // whose photos were deleted, or one that was itself deleted, must not appear —
  // offering a button that can only fail is worse than offering nothing.
  const albumTrips = useMemo(() => {
    if (!memories?.length) return [];
    // A plain object, not a Map: this module imports lucide's `Map` icon, which
    // shadows the global constructor — `new Map()` here tried to instantiate a
    // React component and crashed the whole screen.
    const counts = {};
    for (const m of memories) {
      if (m.tripId) counts[m.tripId] = (counts[m.tripId] || 0) + 1;
    }
    return (saved || [])
      .map((route) => ({ route, count: counts[route.id] || 0 }))
      .filter((x) => x.count >= MIN_PHOTOS)
      .sort((a, b) => b.count - a.count);
  }, [memories, saved]);

  const [picking, setPicking] = useState(false);
  const [albumBusy, setAlbumBusy] = useState(false);
  const [albumMsg, setAlbumMsg] = useState("");

  const makeAlbum = async (route) => {
    if (!isPremium()) { setAlbumMsg(t("albumLocked")); return; }
    setAlbumBusy(true);
    setAlbumMsg("");
    try {
      const album = buildAlbum(route, memories || []);
      if (!hasEnoughForAlbum(album)) { setAlbumMsg(t("albumTooFew", { n: MIN_PHOTOS })); return; }
      await printAlbum(album, t, tripTitle(route, t), (iso) =>
        new Date(iso + "T00:00:00").toLocaleDateString(lang === "zh" ? "zh-CN" : lang || "en",
          { weekday: "short", day: "numeric", month: "short" }));
    } catch {
      setAlbumMsg(t("albumFailed"));
    } finally {
      setAlbumBusy(false);
    }
  };

  // The short, from the same photos and the same trip choice as the album.
  //
  // It lived only on the trip screen's share sheet, which is not where anyone
  // looks: the gallery is where the photos are, so it is where turning them
  // into something belongs — the same reasoning that moved the album here.
  //
  // Encoding runs in real time (MediaRecorder against a live canvas), so a ~35s
  // short takes ~35s. Without a percentage that is indistinguishable from a
  // frozen app.
  const [shortPct, setShortPct] = useState(null);

  // Step one: open the editor. Rendering runs in real time, so choosing what
  // goes in AFTER paying that wait would be an expensive way to find out you
  // wanted a different photo.
  const [editing, setEditing] = useState(null);   // { route, album, scenes }

  const makeShort = (route) => {
    if (!isPremium()) { setAlbumMsg(t("albumLocked")); return; }
    if (!canRenderShort()) { setAlbumMsg(t("shortUnsupported")); return; }
    setAlbumMsg("");
    const album = buildAlbum(route, memories || []);
    if (!hasEnoughForAlbum(album)) { setAlbumMsg(t("albumTooFew", { n: MIN_PHOTOS })); return; }
    setEditing({ route, album, scenes: toScenes(album) });
  };

  // Step two: render exactly what the editor settled on.
  const renderEdited = async (route, album, recipe) => {
    setEditing(null);
    setShortPct(0);
    // Counted from the recipe, not from the album: after dropping seven of ten
    // photos the title card would otherwise announce ten over a three-photo
    // video.
    const chosen = applyRecipe(toScenes(album), recipe).length;
    try {
      const blob = await renderShort(album, {
        title: route.destName,
        subtitle: `${chosen} ${t("albumPhotos")}`,
        dayLabel: (n) => t("day", { n }),
        outro: "Turism, dar simplu!",
      }, { onProgress: setShortPct, recipe });
      await saveOrShareShort(blob, `${(route.destName || "trip").replace(/\s+/g, "-").toLowerCase()}.mp4`);
    } catch (e) {
      if (e?.message !== "aborted") setAlbumMsg(t("shortFailed"));
    } finally {
      setShortPct(null);
    }
  };

  // Which action the trip picker is collecting a trip for.
  const [pickFor, setPickFor] = useState("album");
  const runPick = (route) => (pickFor === "short" ? makeShort(route) : makeAlbum(route));
  const start = (kind) => {
    const only = albumTrips.length === 1;
    if (only) return kind === "short" ? makeShort(albumTrips[0].route) : makeAlbum(albumTrips[0].route);
    setPickFor(kind);
    setPicking((p) => !(p && pickFor === kind));
  };

  return (
    <>
      <StatusBar />
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPick} style={{ display: "none" }} />

      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "4px 22px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "6px 0 6px" }}>
          <div style={{ fontFamily: F.display, color: C.cream, fontSize: 28, fontWeight: 700, letterSpacing: -0.4 }}>
            {t("navGallery")}
          </div>
          <button className="vai-press" onClick={() => fileRef.current?.click()} disabled={busy} style={{
            background: C.goldGrad, color: C.bg, border: "none", borderRadius: 999,
            padding: "9px 15px", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
            boxShadow: `0 8px 20px ${C.gold}44`, opacity: busy ? 0.6 : 1,
          }}>{busy ? "…" : `＋ ${t("galAdd")}`}</button>
        </div>
        <div style={{ color: C.muted, fontSize: 13, marginBottom: 14 }}>{t("gallerySub")}</div>

        {/* Album straight from the gallery — this is where the photos are, so
            it is where someone thinks to turn them into something. An album is
            built per trip, because the day-and-stop structure comes from the
            itinerary; photos with no trip cannot be laid out that way. */}
        {/* When no trip qualifies yet, say what is missing instead of hiding the
            feature. A button that silently fails to exist is indistinguishable
            from one that is broken — and the requirement (link photos to a
            saved trip) is not something anyone would guess. */}
        {memories && memories.length > 0 && albumTrips.length === 0 && (
          <div style={{
            marginBottom: 18, background: C.card, border: `1px dashed ${C.border}`,
            borderRadius: 14, padding: "12px 14px",
            display: "flex", alignItems: "flex-start", gap: 10,
          }}>
            <Camera size={16} color={C.muted} style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ color: C.muted, fontSize: 13, lineHeight: 1.5 }}>
              {t("galAlbumNeeds", { n: MIN_PHOTOS })}
            </div>
          </div>
        )}

        {albumTrips.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            {(() => {
              const busy = albumBusy || shortPct !== null;
              const btn = {
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                background: "transparent", border: `1px solid ${C.gold}55`, borderRadius: 14,
                padding: "11px 14px", cursor: busy ? "default" : "pointer", fontFamily: "inherit",
                color: C.gold, fontSize: 14, fontWeight: 700, opacity: busy ? 0.6 : 1,
              };
              return (
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="vai-press" onClick={() => start("album")} disabled={busy} style={btn}>
                    {isPremium() ? <Camera size={16} /> : <Lock size={16} />}
                    {albumBusy ? t("albumWorking") : t("galMakeAlbum")}
                  </button>
                  <button className="vai-press" onClick={() => start("short")} disabled={busy} style={btn}>
                    {isPremium() ? <Film size={16} /> : <Lock size={16} />}
                    {/* The percentage is the whole point: encoding is real-time,
                        so a silent button looks like a frozen one. */}
                    {shortPct !== null
                      ? `${t("shortRendering")} ${Math.round(shortPct * 100)}%`
                      : t("shareShort")}
                  </button>
                </div>
              );
            })()}

            {picking && (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                {albumTrips.map(({ route, count }) => (
                  <button
                    key={route.id}
                    className="vai-press"
                    onClick={() => { setPicking(false); runPick(route); }}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
                      padding: "11px 14px", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                    }}
                  >
                    <span style={{ color: C.cream, fontSize: 14, fontWeight: 600 }}>{tripTitle(route, t)}</span>
                    <span style={{ color: C.muted, fontSize: 12 }}>{count} {t("albumPhotos")}</span>
                  </button>
                ))}
              </div>
            )}

            {!!albumMsg && (
              <div style={{
                marginTop: 10, background: `${C.gold}14`, border: `1px solid ${C.gold}44`,
                borderRadius: 12, padding: "10px 12px", color: C.gold, fontSize: 13, lineHeight: 1.5,
              }}>{albumMsg}</div>
            )}
          </div>
        )}

        {memories && memories.length >= GALLERY_WARN && (
          <div style={{
            background: `${C.gold}14`, border: `1px solid ${C.gold}44`, borderRadius: 14,
            padding: "10px 14px", marginBottom: 16, color: C.gold, fontSize: 13, lineHeight: 1.45,
          }}><TriangleAlert size={13} style={{ verticalAlign: -2, marginRight: 6 }} />{t("galLimitWarn", { n: memories.length })}</div>
        )}

        {memories && memories.length === 0 && (
          <button onClick={() => fileRef.current?.click()} style={{
            width: "100%", background: C.surface, border: `1.5px dashed ${C.gold}55`, borderRadius: 20,
            padding: "42px 22px", textAlign: "center", cursor: "pointer", fontFamily: "inherit",
          }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
              <Camera size={48} color={C.gold} strokeWidth={1.4} />
            </div>
            <div style={{ color: C.cream, fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{t("galEmpty")}</div>
            <div style={{ color: C.muted, fontSize: 13, lineHeight: 1.5 }}>{t("galEmptySub")}</div>
          </button>
        )}

        {/* Grid / Map toggle — only when there are geotagged photos to map */}
        {memories && memories.length > 0 && geoCount > 0 && (
          <div style={{ display: "flex", gap: 6, marginBottom: 16, background: C.card, borderRadius: 12, padding: 4 }}>
            {[["grid", LayoutGrid, t("galGridView")], ["map", Map, t("galMapView")]].map(([v, TabIcon, label]) => (
              <button key={v} onClick={() => setView(v)} style={{
                flex: 1, background: view === v ? C.gold : "transparent",
                color: view === v ? C.bg : C.mutedLight, border: "none", borderRadius: 9,
                padding: "9px 0", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}><TabIcon size={14} />{label}</button>
            ))}
          </div>
        )}

        {memories && memories.length > 0 && view === "map" && geoCount > 0 && (
          <div style={{ height: 380, borderRadius: 16, overflow: "hidden", border: `1px solid ${C.border}` }}>
            <MemoryMap memories={memories} onPick={(m) => setViewing(m)} />
          </div>
        )}

        {memories && memories.length > 0 && view === "grid" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {memories.map((m) => (
              <button key={m.id} className="vai-lift" onClick={() => setViewing(m)} style={{
                background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
                overflow: "hidden", cursor: "pointer", textAlign: "left", padding: 0, fontFamily: "inherit",
                display: "flex", flexDirection: "column",
              }}>
                {/* The whole photo, never a crop of it.
                    This was a 1:1 tile with object-fit: cover, which hard-crops
                    to a square — and phone photos are mostly portrait, so it
                    cut the top and bottom off almost everything. Someone's
                    picture of a tower lost the tower.
                    Now the photo is contained, so nothing is lost, and a
                    blurred, scaled copy of itself fills whatever the shape
                    leaves over. The tiles stay a uniform 4:5 — taller than
                    square because that is the shape most of these photos are —
                    and no edge is thrown away. */}
                <div style={{ position: "relative", width: "100%", aspectRatio: "4 / 5", overflow: "hidden", background: C.surface }}>
                  <div aria-hidden="true" style={{
                    position: "absolute", inset: 0,
                    backgroundImage: `url(${m.dataUrl})`, backgroundSize: "cover", backgroundPosition: "center",
                    // Scaled up so the blur's soft edges never show as a seam.
                    filter: "blur(18px) saturate(1.15)", transform: "scale(1.25)",
                  }} />
                  <img
                    src={m.dataUrl}
                    alt={m.caption || t("navGallery")}
                    loading="lazy"
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }}
                  />
                </div>
                <div style={{ padding: "10px 12px" }}>
                  {m.caption ? (
                    <div style={{ color: C.cream, fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.caption}</div>
                  ) : (
                    <div style={{ color: C.muted, fontSize: 14, fontStyle: "italic" }}>{t("galNoCaption")}</div>
                  )}
                  <div style={{ color: C.muted, fontSize: 11, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.tripTitle ? <><MapPin size={10} style={{ verticalAlign: -1.5, marginRight: 3 }} />{m.tripTitle}</> : fmtDay(m.ts, lang)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {pending && <Compose photo={pending} saved={saved} onSave={save} onCancel={() => setPending(null)} />}
      {viewing && <Viewer memory={viewing} onClose={() => setViewing(null)} onDelete={remove} />}

      {editing && (
        <ShortEditor
          scenes={editing.scenes}
          onCancel={() => setEditing(null)}
          onRender={(recipe) => renderEdited(editing.route, editing.album, recipe)}
        />
      )}
    </>
  );
}
