import { useState } from "react";
import { C, F } from "../theme.js";
import { StatusBar, Label } from "../components/ui.jsx";
import { useI18n, tripTitle } from "../i18n.js";
import { countryFlag } from "../locale.js";
import { tripStatus } from "../utils.js";
import { Trash2, Map, Undo2, MapPin, Clock, CategoryIcon } from "../icons.jsx";

export default function Trips({ saved, onOpen, onDelete, onRestore }) {
  const { t } = useI18n();
  const [confirmId, setConfirmId] = useState(null); // trip pending delete confirmation
  const [undoTrip, setUndoTrip] = useState(null);    // just-deleted trip, restorable

  // Delete but keep the object around briefly so the snackbar can restore it.
  const removeTrip = (r) => {
    onDelete(r.id);
    setConfirmId(null);
    setUndoTrip(r);
    setTimeout(() => setUndoTrip((cur) => (cur === r ? null : cur)), 6000);
  };
  const restoreTrip = () => { if (undoTrip) { onRestore?.(undoTrip); setUndoTrip(null); } };

  const groups = { ongoing: [], upcoming: [], past: [], unknown: [] };
  for (const r of saved) {
    const s = tripStatus(r);
    groups[s ? s.phase : "unknown"].push(r);
  }

  const renderGroup = (items, label, tint) => {
    if (items.length === 0) return null;
    return (
      <div style={{ marginBottom: 22 }}>
        <Label color={tint}>{label}</Label>
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((r) => {
            const s = tripStatus(r);
            const dim = s?.phase === "past" ? 0.55 : 1;
            const confirming = confirmId === r.id;

            // Confirmation state replaces the row so a delete can't be a
            // one-tap accident.
            if (confirming) {
              return (
                <div key={r.id} style={{
                  background: `${C.red}12`, border: `1px solid ${C.red}44`, borderRadius: 18,
                  padding: "14px 16px", display: "flex", alignItems: "center", gap: 12,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: C.red, fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}>
                      <Trash2 size={15} />{t("tripDeleteConfirm")}
                    </div>
                    <div style={{ color: C.muted, fontSize: 12, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {countryFlag(r.country)} {tripTitle(r, t)}
                    </div>
                  </div>
                  <button className="vai-press" onClick={() => setConfirmId(null)} style={{
                    background: "transparent", border: `1px solid ${C.border}`, borderRadius: 10,
                    color: C.mutedLight, fontSize: 13, fontWeight: 700, padding: "9px 14px",
                    cursor: "pointer", fontFamily: "inherit",
                  }}>{t("cancel")}</button>
                  <button className="vai-press" onClick={() => removeTrip(r)} style={{
                    background: C.red, border: "none", borderRadius: 10, color: "#fff",
                    fontSize: 13, fontWeight: 800, padding: "9px 14px", cursor: "pointer", fontFamily: "inherit",
                  }}>{t("galDelete")}</button>
                </div>
              );
            }

            return (
              <div key={r.id} style={{
                background: C.card, border: `1px solid ${C.border}`, borderRadius: 18,
                display: "flex", alignItems: "center", boxShadow: C.shadowSoft, opacity: dim,
              }}>
                <button className="vai-lift" onClick={() => onOpen(r)} style={{
                  flex: 1, minWidth: 0, background: "transparent", border: "none",
                  padding: "14px 4px 14px 16px", display: "flex", alignItems: "center", gap: 14,
                  cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                }}>
                  <span style={{
                    width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                    background: `${tint}18`, border: `1px solid ${tint}30`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}><CategoryIcon tags={r.interests} size={24} color={tint} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: F.display, color: C.cream, fontWeight: 600, fontSize: 17,
                      letterSpacing: -0.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{countryFlag(r.country)} {tripTitle(r, t)}</div>
                    <div style={{ color: C.muted, fontSize: 13, marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                      <MapPin size={12} />{r.totalStops} {t("stops")} · <Clock size={12} />~{r.totalHours}h
                    </div>
                  </div>
                </button>
                <button className="vai-press" onClick={() => setConfirmId(r.id)} title={t("galDelete")} aria-label={t("galDelete")} style={{
                  background: "transparent", border: "none", color: C.muted, lineHeight: 0,
                  padding: "0 16px", height: 52, cursor: "pointer", fontFamily: "inherit",
                }}><Trash2 size={17} /></button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      <StatusBar />
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "4px 22px 20px" }}>
        <div style={{ fontFamily: F.display, color: C.cream, fontSize: 28, fontWeight: 700, letterSpacing: -0.4, margin: "6px 0 22px" }}>
          {t("navTrips")}
        </div>
        {saved.length === 0 && (
          <div style={{
            background: C.surface, border: `1px dashed ${C.border}`, borderRadius: 18,
            padding: "34px 22px", textAlign: "center", color: C.muted, fontSize: 14, lineHeight: 1.6,
          }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12, opacity: 0.6 }}>
              <Map size={44} color={C.muted} strokeWidth={1.4} />
            </div>
            {t("noTrips")}<br />{t("noTripsSub")}
          </div>
        )}
        {renderGroup(groups.ongoing,  t("tripsOngoing"),  C.green)}
        {renderGroup(groups.upcoming, t("tripsUpcoming"), C.gold)}
        {renderGroup(groups.unknown,  t("tripsOther"),    C.blue)}
        {renderGroup(groups.past,     t("tripsPast"),     C.muted)}
      </div>

      {/* Undo snackbar after a delete */}
      {undoTrip && (
        <div style={{
          position: "absolute", left: 16, right: 16, bottom: 84, zIndex: 40,
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14,
          boxShadow: C.shadow, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12,
          animation: "vai-rise .2s both",
        }}>
          <span style={{ flex: 1, color: C.cream, fontSize: 14, display: "flex", alignItems: "center", gap: 7 }}>
            <Trash2 size={14} />{t("tripDeleted")}
          </span>
          <button className="vai-press" onClick={restoreTrip} style={{
            background: `${C.gold}1c`, border: `1px solid ${C.gold}55`, borderRadius: 999,
            color: C.gold, fontSize: 13, fontWeight: 800, padding: "8px 16px", cursor: "pointer", fontFamily: "inherit",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}><Undo2 size={14} />{t("undo")}</button>
        </div>
      )}
    </>
  );
}
