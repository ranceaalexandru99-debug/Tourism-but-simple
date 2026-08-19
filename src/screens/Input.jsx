import { useState, useRef, useEffect } from "react";
import { C, F } from "../theme.js";
import { Label } from "../components/ui.jsx";
import { useI18n } from "../i18n.js";
import { searchDestinations } from "../destinations.js";
import { Sunrise, Users, Wallet, Utensils, ArrowRight } from "../icons.jsx";

// Nominatim fallback for the long tail (small villages, specific POIs). Only
// hit when the curated 4700-city index returns nothing — so most searches
// stay instant + offline.
async function searchCitiesRemote(q, signal) {
  const params = new URLSearchParams({
    q, format: "json", limit: "6", addressdetails: "1", "accept-language": "en",
  });
  const r = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    signal, headers: { "Accept": "application/json" },
  });
  if (!r.ok) return [];
  const data = await r.json();
  const KEEP = new Set(["city", "town", "village", "administrative", "hamlet", "municipality"]);
  return data
    .filter((d) => KEEP.has(d.type) || KEEP.has(d.class) || d.addresstype === "city" || d.addresstype === "town")
    .slice(0, 5)
    .map((d) => {
      const a = d.address || {};
      const name = a.city || a.town || a.village || a.hamlet || a.municipality || d.name || d.display_name.split(",")[0];
      return { name, country: a.country || "", cc: (a.country_code || "").toUpperCase(), display: d.display_name };
    });
}

// Local-first city lookup. Returns curated matches instantly; falls back to
// Nominatim only if the curated index has no hits.
async function searchCities(q, signal, lang) {
  const local = await searchDestinations(q, 6);
  if (local.length > 0) {
    let dn;
    try { dn = new Intl.DisplayNames([lang, "en"], { type: "region" }); } catch {}
    return local.map((d) => ({
      name: d.n,
      country: dn?.of(d.c) || d.c,
      cc: d.c,
      display: `${d.n}, ${dn?.of(d.c) || d.c}`,
    }));
  }
  return signal?.aborted ? [] : searchCitiesRemote(q, signal);
}

// Country code (ISO) → flag emoji.
const flag = (cc) => cc && cc.length === 2 ? String.fromCodePoint(...[...cc].map((c) => 127397 + c.charCodeAt(0))) : "🌍";

export default function Input({ initial, initialHints, onBack, onSubmit }) {
  const { t, lang } = useI18n();
  const QUICK = [
    { key: "weekend", Icon: Sunrise,  label: t("chipWeekend"), add: t("addWeekend"), hints: { days: 3 } },
    { key: "family",  Icon: Users,    label: t("chipFamily"),  add: t("addFamily"),  hints: { addInterests: ["family"] } },
    { key: "budget",  Icon: Wallet,   label: t("chipBudget"),  add: t("addBudget"),  hints: { budget: "low", pace: "relaxed" } },
    { key: "food",    Icon: Utensils, label: t("chipFood"),    add: t("addFood"),    hints: { addInterests: ["food"] } },
  ];
  const [text, setText] = useState(initial || "");
  const [selected, setSelected] = useState(() => new Set(initialHints?.chips || []));
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  // The destination the user explicitly picked (or arrived with) — once the
  // head of the text matches it, autocomplete stays quiet so adding details
  // via chips or free text doesn't keep re-opening the dropdown.
  const pickedRef = useRef(initial ? (initial.split(",")[0] || "").trim() : null);
  useEffect(() => { ref.current?.focus(); }, []);

  // Get the "destination phrase" — text before the first comma (after that
  // come chip-appended modifiers like ", a weekend").
  const headOf = (s) => (s.split(",")[0] || "").trim();

  // Debounced autocomplete lookup. Aborts prior requests + skips <=2 chars.
  // Skips entirely while the head equals the already-picked destination.
  useEffect(() => {
    const head = headOf(text);
    if (head.length < 2) { setSuggestions([]); setShowSuggest(false); return; }
    if (pickedRef.current && head.toLowerCase() === pickedRef.current.toLowerCase()) {
      setShowSuggest(false);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchCities(head, ctrl.signal, lang);
        setSuggestions(res);
        setShowSuggest(res.length > 0);
      } catch (e) {
        if (e.name !== "AbortError") { setSuggestions([]); setShowSuggest(false); }
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [text]);

  const buildHints = (keys) => {
    const out = { chips: [...keys] };
    const interests = new Set();
    for (const k of keys) {
      const chip = QUICK.find((c) => c.key === k);
      if (!chip) continue;
      const { addInterests, ...rest } = chip.hints;
      Object.assign(out, rest);
      (addInterests || []).forEach((i) => interests.add(i));
    }
    if (interests.size) out.interests = [...interests];
    return out;
  };

  const toggleChip = (chip) => {
    const next = new Set(selected);
    const on = next.has(chip.key);
    if (on) {
      next.delete(chip.key);
      const esc = chip.add.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      setText((prev) => prev.replace(new RegExp(`(,\\s*)?${esc}`), "").trim().replace(/^,\s*/, ""));
    } else {
      next.add(chip.key);
      setText((prev) => (prev.trim() ? `${prev.trim()}, ${chip.add}` : chip.add));
    }
    setSelected(next);
  };

  // Replace only the destination portion (before first comma) with the picked city.
  const pickCity = (s) => {
    const rest = text.includes(",") ? "," + text.split(",").slice(1).join(",") : "";
    setText(`${s.name}${rest}`);
    pickedRef.current = s.name; // remember the choice — no more suggestions for it
    setSuggestions([]);
    setShowSuggest(false);
  };

  const submit = (q) => {
    const value = (q || text).trim();
    if (value) onSubmit(value, buildHints(selected));
  };

  return (
    <>
      <div style={{ height: 44, flexShrink: 0, display: "flex", alignItems: "center", padding: "0 16px" }}>
        <button onClick={onBack} aria-label={t("back")} style={{
          background: "none", border: "none", color: C.cream, fontSize: 22, cursor: "pointer",
        }}>‹</button>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0 24px" }}>
        <h1 style={{
          fontFamily: F.display, color: C.cream, fontSize: 30, fontWeight: 700,
          letterSpacing: -0.5, margin: "10px 0 8px", lineHeight: 1.2,
        }}>
          {t("inputTitle")}
        </h1>
        <p style={{ color: C.muted, fontSize: 14, margin: "0 0 20px" }}>
          {t("inputHint")}
        </p>

        <div style={{ position: "relative" }}>
          <textarea
            ref={ref}
            value={text}
            onChange={(e) => { setText(e.target.value); setShowSuggest(true); }}
            onFocus={() => {
              const head = headOf(text);
              if (pickedRef.current && head.toLowerCase() === pickedRef.current.toLowerCase()) return;
              if (suggestions.length) setShowSuggest(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setShowSuggest(false);
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
            placeholder={t("inputPh")}
            rows={4}
            style={{
              width: "100%", background: C.card, border: `1px solid ${C.gold}40`,
              borderRadius: 18, padding: "16px", color: C.cream, fontSize: 17,
              fontFamily: "inherit", outline: "none", resize: "none", lineHeight: 1.5,
              boxShadow: `0 12px 34px ${C.gold}10, ${C.shadowSoft}`,
            }}
          />
          {loading && (
            <div style={{
              position: "absolute", top: 16, right: 16, width: 16, height: 16, borderRadius: "50%",
              border: `2px solid ${C.border}`, borderTopColor: C.gold,
              animation: "vai-spin 0.8s linear infinite", pointerEvents: "none",
            }} />
          )}
          {showSuggest && suggestions.length > 0 && (
            <div style={{
              position: "absolute", left: 0, right: 0, top: "calc(100% + 6px)", zIndex: 5,
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14,
              padding: 6, boxShadow: C.shadow, animation: "vai-rise .2s both",
              maxHeight: 300, overflowY: "auto",
            }}>
              {suggestions.map((s, i) => (
                <button key={i} className="vai-press" onClick={() => pickCity(s)} style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 12px", background: "transparent", border: "none",
                  borderRadius: 10, cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                }}>
                  <span style={{ fontSize: 22 }}>{flag(s.cc)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: C.cream, fontWeight: 600, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                    <div style={{ color: C.muted, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.country}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <Label color={C.gold} >{" "}</Label>
        <div style={{ color: C.gold, fontSize: 11, fontWeight: 800, letterSpacing: 1.4, margin: "20px 0 12px" }}>
{t("inputDetails")}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {QUICK.map((c) => {
            const on = selected.has(c.key);
            return (
              <button className="vai-press" key={c.key} onClick={() => toggleChip(c)} style={{
                background: on ? C.gold : C.card,
                border: `1px solid ${on ? C.gold : C.border}`, borderRadius: 999,
                padding: "11px 16px", color: on ? C.bg : C.mutedLight, fontSize: 14, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
                boxShadow: on ? `0 6px 18px ${C.gold}33` : "none",
                display: "inline-flex", alignItems: "center", gap: 7,
              }}><c.Icon size={15} />{c.label}</button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: "12px 24px 26px" }}>
        <button className="vai-press" onClick={() => submit()} disabled={!text.trim()} style={{
          width: "100%", border: "none", borderRadius: 16, padding: "16px",
          fontSize: 17, fontWeight: 700, fontFamily: "inherit", letterSpacing: 0.2,
          background: text.trim() ? C.goldGrad : C.card,
          color: text.trim() ? C.bg : C.muted,
          boxShadow: text.trim() ? C.goldGlow : "none",
          cursor: text.trim() ? "pointer" : "default",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          {t("continue")} <ArrowRight size={18} />
        </button>
      </div>
    </>
  );
}
