import { useState } from "react";
import { C, F } from "../theme.js";
import { StatusBar, Label } from "../components/ui.jsx";
import { useI18n, tripTitle } from "../i18n.js";
import { fmtDate } from "../utils.js";
import { countryFlag } from "../locale.js";
import LanguageSelector from "../components/LanguageSelector.jsx";
import ThemeSelector from "../components/ThemeSelector.jsx";
import ShareSheet from "../components/ShareSheet.jsx";
import LegalSheet from "../components/LegalSheet.jsx";
import { clearAllMemories } from "../gallery.js";
import { User, Smile, Share2, MapPin, Clock, Globe, Palette, Scale, Trash2, UserX, KeyRound, LogOut, CategoryIcon } from "../icons.jsx";

// Profile / preferences hub for the "Me" tab. Groups language & theme, an
// account summary, and — per request — a place to share any saved trip without
// having to open it first.
export default function Me({ user, saved, onLogout, onDeleteAccount }) {
  const { t, lang } = useI18n();
  const name = user?.name || t("traveler");
  const [shareTarget, setShareTarget] = useState(null); // a route to share, or null
  const [legal, setLegal] = useState(false);
  const [armErase, setArmErase] = useState(false); // two-step confirm for wipe
  const [armDelAcc, setArmDelAcc] = useState(false); // two-step confirm for account deletion

  // Erase everything this app stored on the device: all localStorage keys we own
  // (trips, searches, account, session, theme, consent…) plus the photo gallery
  // in IndexedDB. Then hard-reload so the app boots fresh from the splash.
  const eraseAll = async () => {
    try { await clearAllMemories(); } catch {}
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("vai_"))
        .forEach((k) => localStorage.removeItem(k));
    } catch {}
    window.location.hash = "";
    window.location.reload();
  };

  return (
    <>
      <StatusBar />
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "4px 22px 20px" }}>
        <div style={{ fontFamily: F.display, color: C.cream, fontSize: 28, fontWeight: 700, letterSpacing: -0.4, margin: "6px 0 22px" }}>
          {t("navMe")}
        </div>

        {/* Identity card */}
        <div style={{
          display: "flex", alignItems: "center", gap: 16, marginBottom: 26,
          background: `linear-gradient(150deg, ${C.gold}18, ${C.card} 65%)`,
          border: `1px solid ${C.gold}30`, borderRadius: 20, padding: "18px 20px",
          boxShadow: C.shadowSoft,
        }}>
          <div style={{
            width: 68, height: 68, borderRadius: "50%", flexShrink: 0,
            background: C.goldGrad, boxShadow: `0 8px 20px ${C.gold}55`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>{user?.guest ? <User size={32} color={C.bg} /> : <Smile size={32} color={C.bg} />}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: F.display, color: C.cream, fontSize: 22, fontWeight: 700, letterSpacing: -0.3,
            }}>{name}</div>
            <div style={{ color: C.mutedLight, fontSize: 13, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user?.guest ? t("guestMode") : (user?.method === "share" ? t("sharedMode") : (user?.email || t("signedIn")))}
            </div>
            <div style={{ color: C.gold, fontSize: 12, fontWeight: 700, marginTop: 6, letterSpacing: 0.3 }}>
              {saved.length} {saved.length === 1 ? t("trip1") : t("tripN")}
            </div>
          </div>
        </div>

        {/* Share a saved trip */}
        <Label color={C.gold}><Share2 size={11} style={{ verticalAlign: -1.5, marginRight: 5 }} />{t("shareTitle")}</Label>
        <div style={{ marginTop: 12, marginBottom: 26 }}>
          {saved.length === 0 ? (
            <div style={{
              background: C.surface, border: `1px dashed ${C.border}`, borderRadius: 18,
              padding: "22px", textAlign: "center", color: C.muted, fontSize: 14, lineHeight: 1.6,
            }}>
              {t("shareNoTrips")}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {saved.map((r) => (
                <div key={r.id} style={{
                  display: "flex", alignItems: "center", gap: 14,
                  background: C.card, border: `1px solid ${C.border}`, borderRadius: 18,
                  padding: "12px 14px", boxShadow: C.shadowSoft,
                }}>
                  <span style={{
                    width: 46, height: 46, borderRadius: 12, flexShrink: 0, fontSize: 22,
                    background: `${C.gold}14`, border: `1px solid ${C.gold}30`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}><CategoryIcon tags={r.interests} size={22} color={C.gold} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: F.display, color: C.cream, fontWeight: 600, fontSize: 16,
                      letterSpacing: -0.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{countryFlag(r.country)} {tripTitle(r, t)}</div>
                    <div style={{ color: C.muted, fontSize: 12, marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                      <MapPin size={11} />{r.totalStops} {t("stops")} · <Clock size={11} />~{r.totalHours}h
                    </div>
                  </div>
                  <button className="vai-press" onClick={() => setShareTarget(r)} title={t("shareTitle")} aria-label={`${t("shareTitle")} — ${tripTitle(r, t)}`} style={{
                    flexShrink: 0, background: C.goldGrad, color: C.bg, border: "none",
                    borderRadius: 12, padding: "10px 14px", fontSize: 14, fontWeight: 800,
                    cursor: "pointer", fontFamily: "inherit", boxShadow: `0 6px 16px ${C.gold}44`,
                  }}><Share2 size={16} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Label color={C.gold}>{t("preferences")}</Label>
        <div style={{
          display: "flex", flexDirection: "column", gap: 12, marginTop: 12,
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 14,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ color: C.mutedLight, fontSize: 14, display: "inline-flex", alignItems: "center", gap: 7 }}><Globe size={15} />{t("language")}</span>
            <LanguageSelector align="right" />
          </div>
          <div style={{ height: 1, background: C.border }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ color: C.mutedLight, fontSize: 14, display: "inline-flex", alignItems: "center", gap: 7 }}><Palette size={15} />{t("themeLabel")}</span>
            <ThemeSelector align="right" />
          </div>
        </div>

        {/* Legal */}
        <button className="vai-press" onClick={() => setLegal(true)} style={{
          width: "100%", marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between",
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: "16px 16px",
          cursor: "pointer", fontFamily: "inherit",
        }}>
          <span style={{ color: C.mutedLight, fontSize: 14, display: "inline-flex", alignItems: "center", gap: 7 }}><Scale size={15} />{t("legalTitle")}</span>
          <span style={{ color: C.muted, fontSize: 18 }}>›</span>
        </button>

        {/* Account deletion — required by both stores, and distinct from the
            full wipe below: it removes the account only, leaving the trips and
            photos that belong to this device. Hidden for guests, who have no
            account to delete. */}
        {onDeleteAccount && user && !user.guest && (
          !armDelAcc ? (
            <button className="vai-press" onClick={() => setArmDelAcc(true)} style={{
              width: "100%", marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "transparent", border: `1px solid ${C.border}`, borderRadius: 18, padding: "16px 16px",
              cursor: "pointer", fontFamily: "inherit",
            }}>
              <span style={{ color: C.muted, fontSize: 14, display: "inline-flex", alignItems: "center", gap: 7 }}><UserX size={15} />{t("deleteAccount")}</span>
              <span style={{ color: C.muted, fontSize: 18 }}>›</span>
            </button>
          ) : (
            <div style={{
              marginTop: 14, background: `${C.red}10`, border: `1px solid ${C.red}44`,
              borderRadius: 18, padding: "16px",
            }}>
              <div style={{ color: C.red, fontSize: 14, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}><UserX size={15} />{t("deleteAccount")}</div>
              <div style={{ color: C.mutedLight, fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>{t("deleteAccountWarn")}</div>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="vai-press" onClick={() => setArmDelAcc(false)} style={{
                  flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
                  padding: "13px", cursor: "pointer", fontFamily: "inherit", color: C.cream, fontSize: 14, fontWeight: 700,
                }}>{t("cancel")}</button>
                <button className="vai-press" onClick={onDeleteAccount} style={{
                  flex: 1, background: C.red, border: "none", borderRadius: 12,
                  padding: "13px", cursor: "pointer", fontFamily: "inherit", color: "#fff", fontSize: 14, fontWeight: 800,
                }}>{t("deleteAccountConfirm")}</button>
              </div>
            </div>
          )
        )}

        {/* Danger zone: wipe all on-device data (two-step confirm) */}
        {!armErase ? (
          <button className="vai-press" onClick={() => setArmErase(true)} style={{
            width: "100%", marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "transparent", border: `1px solid ${C.border}`, borderRadius: 18, padding: "16px 16px",
            cursor: "pointer", fontFamily: "inherit",
          }}>
            <span style={{ color: C.muted, fontSize: 14, display: "inline-flex", alignItems: "center", gap: 7 }}><Trash2 size={15} />{t("eraseData")}</span>
            <span style={{ color: C.muted, fontSize: 18 }}>›</span>
          </button>
        ) : (
          <div style={{
            marginTop: 14, background: `${C.red}10`, border: `1px solid ${C.red}44`,
            borderRadius: 18, padding: "16px",
          }}>
            <div style={{ color: C.red, fontSize: 14, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}><Trash2 size={15} />{t("eraseData")}</div>
            <div style={{ color: C.mutedLight, fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>{t("eraseDataWarn")}</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="vai-press" onClick={() => setArmErase(false)} style={{
                flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
                padding: "13px", cursor: "pointer", fontFamily: "inherit", color: C.cream, fontSize: 14, fontWeight: 700,
              }}>{t("cancel")}</button>
              <button className="vai-press" onClick={eraseAll} style={{
                flex: 1, background: C.red, border: "none", borderRadius: 12,
                padding: "13px", cursor: "pointer", fontFamily: "inherit", color: "#fff", fontSize: 14, fontWeight: 800,
              }}>{t("eraseDataConfirm")}</button>
            </div>
          </div>
        )}

        {onLogout && (
          <button className="vai-press" onClick={onLogout} style={{
            width: "100%", marginTop: 14, background: user?.guest ? C.card : `${C.red}12`,
            border: `1px solid ${user?.guest ? C.border : C.red + "44"}`, borderRadius: 18,
            padding: "15px", cursor: "pointer", fontFamily: "inherit",
            color: user?.guest ? C.gold : C.red, fontSize: 15, fontWeight: 700,
          }}>{user?.guest
            ? <><KeyRound size={15} style={{ verticalAlign: -2, marginRight: 7 }} />{t("authSignInCta")}</>
            : <><LogOut size={15} style={{ verticalAlign: -2, marginRight: 7 }} />{t("authSignOut")}</>}</button>
        )}
      </div>

      {legal && <LegalSheet onClose={() => setLegal(false)} />}

      {shareTarget && (
        <ShareSheet
          route={shareTarget}
          onClose={() => setShareTarget(null)}
          printCtx={{ t, fmtDate: (iso) => fmtDate(iso, lang) }}
        />
      )}
    </>
  );
}
