import { useEffect, useMemo, useState } from "react";
import { C, F } from "../theme.js";
import { StatusBar, Label } from "../components/ui.jsx";
import { POPULAR } from "../mockEngine.js";
import { getTrending, getHiddenGems, getEuropeWeekend } from "../destinations.js";
import { useI18n, tripTitle } from "../i18n.js";
import { countryFlag } from "../locale.js";
import { tripStatus } from "../utils.js";
import { Search, History, ArrowRight, Plane, CategoryIcon } from "../icons.jsx";
import PoiImage from "../components/PoiImage.jsx";

// Horizontal-scroll rail of curated destinations. `items` are compact
// records from src/destinations.json (n=name, c=country ISO).
function Rail({ label, items, countryName, onOpen }) {
  return (
    <div style={{ marginBottom: 24, animation: "vai-rise .4s both" }}>
      <div style={{ marginBottom: 10 }}>
        <Label color={C.gold}>{label}</Label>
      </div>
      {/* A wrapping 2-column grid — everything is reachable by scrolling down,
          no sideways scroll anywhere. */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {items.map((d) => (
          <button
            key={d.id}
            className="vai-lift"
            onClick={() => onOpen(d.n)}
            style={{
              height: 150, borderRadius: 16,
              overflow: "hidden", border: `1px solid ${C.border}`,
              padding: 0, cursor: "pointer", fontFamily: "inherit",
              background: C.card, boxShadow: C.shadowSoft,
              position: "relative",
            }}
          >
            {/* `img` is the Commons filename already resolved in the city
                index, so the photo renders immediately instead of waiting on
                the lookup chain — the rails used to fill in over seconds. */}
            <PoiImage
              name={d.n}
              context={countryName(d.c) || d.c}
              img={d.img}
              width="100%" height="100%" radius={0} fontSize={36}
            />
            <span style={{
              position: "absolute", inset: 0, pointerEvents: "none",
              background: "linear-gradient(to top, rgba(0,0,0,.78) 0%, rgba(0,0,0,.14) 46%, transparent 68%)",
            }} />
            <span style={{ position: "absolute", left: 10, right: 10, bottom: 8, textAlign: "left", display: "block" }}>
              <span style={{ display: "block", fontFamily: F.display, color: "#fff", fontWeight: 700, fontSize: 15, letterSpacing: -0.2, textShadow: "0 1px 5px rgba(0,0,0,.55)" }}>{d.n}</span>
              <span style={{ display: "block", color: "rgba(255,255,255,.88)", fontSize: 11, textShadow: "0 1px 4px rgba(0,0,0,.6)" }}>{countryName(d.c) || d.c}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Time-of-day greeting key. Cutoffs match how most people mentally split the
// day: morning until 12, afternoon until 18, evening until 22, night otherwise.
function greetingKey() {
  const h = new Date().getHours();
  if (h < 5) return "hiNight";
  if (h < 12) return "hiMorning";
  if (h < 18) return "hiAfternoon";
  if (h < 22) return "hiEvening";
  return "hiNight";
}

// Fisher-Yates shuffle. Used to freshen the popular grid each session so users
// don't stare at the same order every time they open the app.
function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function StatusBadge({ status, t }) {
  if (!status) return null;
  if (status.phase === "ongoing") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
        <span style={{
          background: `${C.green}22`, color: C.green, fontSize: 11, fontWeight: 800,
          letterSpacing: 0.5, padding: "3px 9px", borderRadius: 999,
        }}>{t("tripOngoing", { d: status.currentDay, n: status.of })}</span>
        <div style={{ flex: 1, height: 4, background: C.border, borderRadius: 3, overflow: "hidden", maxWidth: 100 }}>
          <div style={{ width: `${status.progress * 100}%`, height: "100%", background: C.green }} />
        </div>
      </div>
    );
  }
  if (status.phase === "upcoming") {
    return (
      <span style={{
        marginTop: 6, display: "inline-block",
        background: `${C.gold}18`, color: C.gold, fontSize: 11, fontWeight: 800,
        letterSpacing: 0.5, padding: "3px 9px", borderRadius: 999,
      }}>{status.daysUntil === 1 ? t("tripTomorrow") : t("tripStartsIn", { n: status.daysUntil })}</span>
    );
  }
  return (
    <span style={{
      marginTop: 6, display: "inline-block",
      background: `${C.muted}22`, color: C.muted, fontSize: 11, fontWeight: 800,
      letterSpacing: 0.5, padding: "3px 9px", borderRadius: 999,
    }}><Plane size={11} style={{ verticalAlign: -1.5, marginRight: 3 }} />{t("tripPast")}</span>
  );
}

// SVG progress ring — draws a stroked circle with a foreground arc whose length
// is controlled by `strokeDashoffset`. Rendered around the emoji in the "Continue"
// card to signal how far through the trip the user is at a glance.
function ProgressRing({ size = 74, stroke = 3, progress = 0, color, track, children }) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.max(0, Math.min(1, progress)));
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset .6s cubic-bezier(.2,.8,.3,1)" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {children}
      </div>
    </div>
  );
}

export default function Home({ user, saved, recent, lastOpenedId, onSearch, onQuick, onOpenSaved }) {
  const { t, lang } = useI18n();
  const name = user?.name || t("traveler");
  const TINTS = [C.gold, C.blue, C.green, C.purple];
  // Shuffle stays stable for the lifetime of this Home instance (this session)
  // so the tiles don't jump around mid-scroll. Grid shows a subset — enough
  // variety per open, without an endlessly scrolling wall.
  const popular = useMemo(() => shuffle(POPULAR).slice(0, 12), []);
  const greeting = t(greetingKey());
  // Country name in the user's language via ISO code — no per-language table.
  const countryName = useMemo(() => {
    try {
      const dn = new Intl.DisplayNames([lang, "en"], { type: "region" });
      return (code) => (code ? dn.of(code) : null);
    } catch { return () => null; }
  }, [lang]);

  // Curated destination rails from the 5000-city Wikidata bundle (lazy-loaded).
  // Refresh on an interval so the trending/hidden/europe feeds feel alive —
  // opening the same screen twice shows a different mix.
  const [rails, setRails] = useState({ trending: [], hidden: [], europe: [] });
  useEffect(() => {
    let alive = true;
    const refresh = () => Promise.all([getTrending(6), getHiddenGems(6), getEuropeWeekend(6)])
      .then(([trending, hidden, europe]) => { if (alive) setRails({ trending, hidden, europe }); })
      .catch(() => {});
    refresh();
    const timer = setInterval(refresh, 45000);
    return () => { alive = false; clearInterval(timer); };
  }, []);

  // Continue card = the last opened saved route, if still there.
  const lastOpened = lastOpenedId ? saved.find((r) => r.id === lastOpenedId) : null;
  const continueStatus = lastOpened ? tripStatus(lastOpened) : null;

  return (
    <>
      <StatusBar />
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "4px 22px 28px" }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ color: C.muted, fontSize: 14, letterSpacing: 0.2 }}>{greeting}</div>
          <div style={{
            fontFamily: F.display, color: C.cream, fontSize: 28, fontWeight: 700, letterSpacing: -0.4,
          }}>{name}</div>
        </div>

        {/* Continue where you left off */}
        {lastOpened && (
          <>
            <Label color={C.gold}>{t("continueLabel")}</Label>
            <button className="vai-lift" onClick={() => onOpenSaved(lastOpened)} style={{
              width: "100%", margin: "10px 0 24px",
              background: `linear-gradient(150deg, ${C.gold}22, ${C.card} 65%)`,
              border: `1px solid ${C.gold}40`, borderRadius: 20, padding: "16px 18px",
              display: "flex", alignItems: "center", gap: 14, cursor: "pointer",
              textAlign: "left", boxShadow: `0 12px 34px ${C.gold}14, ${C.shadowSoft}`,
            }}>
              {/* Progress ring is only meaningful when a trip has time-relative
                  progress; upcoming/past fall back to a solid gradient tile. */}
              {continueStatus?.phase === "ongoing" ? (
                <ProgressRing progress={continueStatus.progress} color={C.green} track={`${C.green}33`}>
                  <CategoryIcon tags={lastOpened.interests} size={28} color={C.green} />
                </ProgressRing>
              ) : (
                <span style={{
                  width: 60, height: 60, borderRadius: 18, flexShrink: 0,
                  background: C.goldGrad, boxShadow: `0 8px 20px ${C.gold}55`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}><CategoryIcon tags={lastOpened.interests} size={28} color={C.bg} /></span>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: F.display, color: C.cream, fontWeight: 700, fontSize: 18,
                  letterSpacing: -0.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{countryFlag(lastOpened.country)} {tripTitle(lastOpened, t)}</div>
                <StatusBadge status={continueStatus} t={t} />
              </div>
              <ArrowRight size={22} color={C.gold} />
            </button>
          </>
        )}

        <button className="vai-lift" onClick={onSearch} style={{
          width: "100%", display: "flex", alignItems: "center", gap: 12,
          background: C.card, border: `1px solid ${C.gold}45`, borderRadius: 18,
          padding: "13px 14px", cursor: "pointer", marginBottom: recent.length ? 14 : 28,
          boxShadow: `0 12px 34px ${C.gold}14, ${C.shadowSoft}`,
        }}>
          <span style={{
            width: 38, height: 38, borderRadius: 12, flexShrink: 0,
            background: C.goldGrad, display: "flex", alignItems: "center",
            justifyContent: "center", boxShadow: `0 6px 16px ${C.gold}44`,
          }}><Search size={18} color={C.bg} strokeWidth={2.4} /></span>
          <span style={{ color: C.muted, fontSize: 16 }}>{t("where")}</span>
        </button>

        {/* Recent searches */}
        {recent.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 26, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ color: C.muted, fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5 }}>
              <History size={13} />{t("recentSearches")}
            </span>
            {recent.map((q) => (
              <button key={q} className="vai-press" onClick={() => onQuick(q)} style={{
                background: C.card, border: `1px solid ${C.border}`, borderRadius: 999,
                padding: "6px 12px", color: C.mutedLight, fontSize: 13, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
              }}>{q}</button>
            ))}
          </div>
        )}

        <Label color={C.gold}>{t("popular")}</Label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, margin: "12px 0 28px", borderRadius: 18, overflow: "hidden", boxShadow: C.shadowSoft }}>
          {popular.map((p, i) => {
            const tint = TINTS[i % TINTS.length];
            return (
              <button className="vai-lift" key={p.q} onClick={() => onQuick(p.q)} style={{
                position: "relative", height: 176, overflow: "hidden",
                border: `1px solid ${tint}45`, padding: 0, cursor: "pointer",
                fontFamily: "inherit", background: C.card,
              }}>
                {/* Real destination photo (Wikipedia) with a graceful icon fallback */}
                <PoiImage name={p.q} tags={p.cat} width="100%" height="100%" radius={0} fontSize={44} />
                {/* Legibility gradient so the label stays readable on any photo */}
                <span style={{
                  position: "absolute", inset: 0, pointerEvents: "none",
                  background: "linear-gradient(to top, rgba(0,0,0,.74) 0%, rgba(0,0,0,.12) 46%, transparent 68%)",
                }} />
                {/* Category chip */}
                <span style={{
                  position: "absolute", top: 9, right: 9, width: 28, height: 28, borderRadius: 9,
                  background: "rgba(0,0,0,.42)", backdropFilter: "blur(3px)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}><CategoryIcon tags={p.cat} size={15} color="#fff" /></span>
                {/* Title + country */}
                <span style={{ position: "absolute", left: 12, right: 12, bottom: 9, textAlign: "left", display: "block" }}>
                  <span style={{ display: "block", fontFamily: F.display, color: "#fff", fontWeight: 700, fontSize: 17, letterSpacing: -0.2, textShadow: "0 1px 5px rgba(0,0,0,.55)" }}>{p.q}</span>
                  <span style={{ display: "block", color: "rgba(255,255,255,.88)", fontSize: 12, textShadow: "0 1px 4px rgba(0,0,0,.6)" }}>{countryName(p.country) || p.sub}</span>
                </span>
              </button>
            );
          })}
        </div>

        {rails.trending.length > 0 && (
          <Rail key={"tr-" + rails.trending[0].id} label={t("railTrending")} items={rails.trending} countryName={countryName} onOpen={onQuick} />
        )}
        {rails.hidden.length > 0 && (
          <Rail key={"hg-" + rails.hidden[0].id} label={t("railHiddenGems")} items={rails.hidden} countryName={countryName} onOpen={onQuick} />
        )}
        {rails.europe.length > 0 && (
          <Rail key={"ew-" + rails.europe[0].id} label={t("railEuropeWeekend")} items={rails.europe} countryName={countryName} onOpen={onQuick} />
        )}

      </div>
    </>
  );
}
