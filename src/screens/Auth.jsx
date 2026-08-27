import { useState } from "react";
import { C, F } from "../theme.js";
import { StatusBar, Btn } from "../components/ui.jsx";
import { useI18n } from "../i18n.js";
import { signIn, signUp } from "../auth.js";
import { Lock, Eye, EyeOff, TriangleAlert } from "../icons.jsx";
import PoiImage from "../components/PoiImage.jsx";

// Featured destinations for the login hero collage (middle one wider). Real
// photos come from Wikipedia via PoiImage; a broken lookup falls back to an icon.
const HERO_CITIES = ["Paris", "Roma", "Tokyo"];

export default function Auth({ onAuth }) {
  const { t } = useI18n();
  const [mode, setMode] = useState("login"); // login | signup
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [err, setErr] = useState("");
  const [errCode, setErrCode] = useState("");
  const [busy, setBusy] = useState(false);

  // Any edit clears a stale error so the user isn't left staring at a message
  // that no longer matches what they've typed.
  const edit = (setter) => (e) => { if (err) { setErr(""); setErrCode(""); } setter(e.target.value); };

  const inputStyle = {
    width: "100%", background: C.card, border: `1px solid ${C.border}`,
    borderRadius: 12, padding: "14px 16px", color: C.cream, fontSize: 15,
    fontFamily: "inherit", outline: "none", marginBottom: 10,
  };

  const submit = async () => {
    setErr(""); setErrCode("");
    setBusy(true);
    try {
      const user = mode === "signup"
        ? await signUp({ email, password: pass, name })
        : await signIn({ email, password: pass });
      onAuth(user);
    } catch (e) {
      // Map the thrown error code to a localized message. t() echoes the key
      // back when it has no translation, so `||` never fired and an unmapped
      // code rendered as the literal string "authErr_<code>" — compare instead.
      const key = "authErr_" + e.message;
      const msg = t(key);
      setErr(msg === key ? t("authErrGeneric") : msg);
      setErrCode(e.message);
    } finally {
      setBusy(false);
    }
  };

  const swap = () => { setMode(mode === "login" ? "signup" : "login"); setErr(""); setErrCode(""); };

  return (
    <>
      <StatusBar />
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 24px" }}>
        {/* Destination hero collage */}
        <div style={{ display: "flex", gap: 8, height: 116, marginBottom: 18 }}>
          {HERO_CITIES.map((city, i) => (
            <div key={city} style={{
              flex: i === 1 ? 1.35 : 1, position: "relative", borderRadius: 18,
              overflow: "hidden", border: `1px solid ${C.gold}25`, boxShadow: C.shadowSoft,
            }}>
              <PoiImage name={city} width="100%" height="100%" radius={0} fontSize={30} />
              <span style={{
                position: "absolute", inset: 0, pointerEvents: "none",
                background: "linear-gradient(to top, rgba(0,0,0,.55) 0%, transparent 55%)",
              }} />
              <span style={{
                position: "absolute", left: 8, bottom: 6, color: "#fff", fontSize: 11,
                fontWeight: 700, letterSpacing: 0.2, textShadow: "0 1px 4px rgba(0,0,0,.6)",
              }}>{city}</span>
            </div>
          ))}
        </div>

        {/* Small lock chip so the "secure sign-in" cue survives the collage */}
        <div style={{
          width: 52, height: 52, borderRadius: 16, margin: "0 auto 12px",
          background: `linear-gradient(150deg, ${C.gold}26, ${C.card})`,
          border: `1px solid ${C.gold}35`, display: "flex", alignItems: "center",
          justifyContent: "center", boxShadow: C.shadowSoft,
        }}><Lock size={24} color={C.gold} strokeWidth={1.8} /></div>
        <h1 style={{
          fontFamily: F.display, color: C.cream, fontSize: 28, fontWeight: 700,
          letterSpacing: -0.4, textAlign: "center", margin: "0 0 6px",
        }}>
          {mode === "signup" ? t("authSignupTitle") : t("authTitle")}
        </h1>
        <p style={{ color: C.muted, fontSize: 14, textAlign: "center", margin: "0 0 22px" }}>
          {mode === "signup" ? t("authSignupSub") : t("authSub")}
        </p>

        {mode === "signup" && (
          <input style={inputStyle} placeholder={t("authName")} value={name}
            onChange={edit(setName)} autoComplete="name" />
        )}
        <input style={inputStyle} placeholder={t("email")} value={email} type="email"
          onChange={edit(setEmail)} autoComplete="email" autoCapitalize="none" />

        {/* Password with a show/hide toggle so users can catch typos */}
        <div style={{ position: "relative", marginBottom: mode === "signup" ? 4 : 10 }}>
          <input
            style={{ ...inputStyle, marginBottom: 0, paddingRight: 52 }}
            placeholder={t("password")} type={showPass ? "text" : "password"} value={pass}
            onChange={edit(setPass)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            autoComplete={mode === "signup" ? "new-password" : "current-password"} />
          <button type="button" onClick={() => setShowPass((v) => !v)}
            aria-label={showPass ? t("authHidePass") : t("authShowPass")}
            aria-pressed={showPass}
            style={{
              position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
              background: "transparent", border: "none", cursor: "pointer",
              padding: "8px 10px", lineHeight: 0, color: C.muted, fontFamily: "inherit",
            }}>{showPass ? <EyeOff size={18} /> : <Eye size={18} />}</button>
        </div>
        {mode === "signup" && (
          <div style={{ color: C.muted, fontSize: 12, margin: "0 0 12px 2px" }}>
            {t("authPassHint")}
          </div>
        )}

        {err && (
          <div style={{
            background: `${C.red}14`, border: `1px solid ${C.red}44`, borderRadius: 10,
            padding: "9px 12px", color: C.red, fontSize: 13, marginBottom: 10, lineHeight: 1.4,
          }}>
            <TriangleAlert size={13} style={{ verticalAlign: -2, marginRight: 5 }} />{err}
            {/* Offer the obvious next step for the two "wrong mode" errors */}
            {(errCode === "nouser" || errCode === "exists") && (
              <span onClick={swap} style={{ color: C.gold, fontWeight: 700, cursor: "pointer", marginLeft: 6 }}>
                {errCode === "nouser" ? t("authErrCreateCta") : t("authErrSignInCta")}
              </span>
            )}
          </div>
        )}

        <Btn onClick={submit} disabled={busy} style={{ marginTop: 4 }}>
          {busy ? "…" : (mode === "signup" ? t("authCreate") : t("authLogin"))}
        </Btn>

        <div style={{ textAlign: "center", marginTop: 16, color: C.muted, fontSize: 14 }}>
          {mode === "signup" ? t("authHaveAccount") : t("authNoAccount")}{" "}
          <span onClick={swap} style={{ color: C.gold, fontWeight: 700, cursor: "pointer" }}>
            {mode === "signup" ? t("authLogin") : t("authCreate")}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0 16px" }}>
          <div style={{ flex: 1, height: 1, background: C.border }} />
          <span style={{ color: C.muted, fontSize: 12 }}>{t("authOr")}</span>
          <div style={{ flex: 1, height: 1, background: C.border }} />
        </div>

        <Btn variant="ghost" color={C.muted} onClick={() => onAuth({ name: null, guest: true, method: "guest" })}>
          {t("authGuest")}
        </Btn>
      </div>
    </>
  );
}
