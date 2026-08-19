import { useEffect, useRef, useState } from "react";
import { C } from "../theme.js";
import { Btn } from "../components/ui.jsx";
import {
  PEOPLE, CONTACTS, MAX_MEMBERS, loadCollab, saveCollab, activityScript, computeBalances,
} from "../mockCollab.js";
import { useI18n, tripTitle } from "../i18n.js";
import {
  Plus, TriangleAlert, Link2, Check, Users, Clock, Lightbulb, Zap, Wallet,
  ThumbsUp, Heart, Handshake, Hourglass, Vote, X,
} from "../icons.jsx";
import { useEscape } from "../useEscape.js";
import { buildShareUrl } from "../components/ShareSheet.jsx";

// ---- small bits -------------------------------------------------------------
function Avatar({ id, size = 34, ring = true, dim = false }) {
  const p = PEOPLE[id];
  return (
    <div title={p.name} style={{
      width: size, height: size, borderRadius: "50%", background: C.card,
      border: ring ? `2px solid ${p.color}` : "none",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.5, flexShrink: 0, opacity: dim ? 0.5 : 1,
    }}>{p.avatar}</div>
  );
}

// Overlapping voter avatars (max 3 + "+n").
function VoterStack({ ids }) {
  const { t } = useI18n();
  if (!ids || ids.length === 0)
    return <span style={{ color: C.muted, fontSize: 12 }}>{t("noVotes")}</span>;
  const shown = ids.slice(0, 3);
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {shown.map((id, i) => (
        <div key={id} style={{ marginLeft: i === 0 ? 0 : -8 }}>
          <Avatar id={id} size={22} />
        </div>
      ))}
      {ids.length > 3 && (
        <span style={{ color: C.muted, fontSize: 12, marginLeft: 6 }}>+{ids.length - 3}</span>
      )}
    </div>
  );
}

// ---- invite sheet -----------------------------------------------------------
function InviteSheet({ route, members, pending, onInvite, onClose }) {
  const { t } = useI18n();
  useEscape(onClose);
  const [copied, setCopied] = useState(false);
  const inTrip = (id) => members.includes(id) || pending.includes(id);
  const groupSize = members.length + pending.length;
  const full = groupSize >= MAX_MEMBERS;
  return (
    <div onClick={onClose} style={{
      position: "absolute", inset: 0, background: "#000a", zIndex: 60,
      display: "flex", alignItems: "flex-end", animation: "vai-pop .2s both",
    }}>
      {/* maxHeight + scrolling: with a full contact list the sheet used to grow
          past the screen, covering the backdrop — and since the backdrop was
          the only way out, the user was trapped with no way back. */}
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", background: C.surface, borderRadius: "26px 26px 0 0",
        padding: "10px 22px 28px", animation: "vai-rise .25s both",
        maxHeight: "88%", overflowY: "auto", overflowX: "hidden",
      }}>
        <div style={{ width: 40, height: 5, background: C.border, borderRadius: 3, margin: "0 auto 16px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 10 }}>
          <div style={{ color: C.cream, fontSize: 19, fontWeight: 800, display: "flex", alignItems: "center", gap: 7 }}>
            <Plus size={18} />{t("inviteTitle")}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <span style={{
              background: full ? `${C.red}22` : `${C.gold}22`, color: full ? C.red : C.gold,
              border: `1px solid ${full ? C.red : C.gold}55`,
              borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 800,
              letterSpacing: 0.3,
            }}>{groupSize} / {MAX_MEMBERS}</span>
            {/* Explicit way out — never rely on tapping the backdrop alone. */}
            <button onClick={onClose} aria-label={t("back")} style={{
              background: "none", border: "none", color: C.muted,
              cursor: "pointer", lineHeight: 0, padding: 4,
            }}><X size={20} /></button>
          </div>
        </div>
        {full && (
          <div style={{
            background: `${C.red}12`, border: `1px solid ${C.red}40`, borderRadius: 12,
            padding: "10px 14px", marginBottom: 16, color: C.red, fontSize: 13, lineHeight: 1.45,
          }}><TriangleAlert size={13} style={{ verticalAlign: -2, marginRight: 5 }} />{t("groupFull", { n: MAX_MEMBERS })}</div>
        )}

        {/* shareable link */}
        <button onClick={() => {
          // Copy the real shareable trip URL (the whole trip lives in the hash),
          // not a made-up domain — recipients actually see the itinerary.
          navigator.clipboard?.writeText(buildShareUrl(route));
          setCopied(true);
        }} style={{
          width: "100%", display: "flex", alignItems: "center", gap: 12,
          background: C.card, border: `1px solid ${C.gold}40`, borderRadius: 14,
          padding: "14px 16px", cursor: "pointer", marginBottom: 18, fontFamily: "inherit",
        }}>
          <Link2 size={20} color={C.gold} />
          <div style={{ flex: 1, textAlign: "left" }}>
            <div style={{ color: C.cream, fontWeight: 700, fontSize: 15 }}>
              {copied ? <><Check size={14} style={{ verticalAlign: -2, marginRight: 4 }} />{t("inviteCopied")}</> : t("copyInvite")}
            </div>
            <div style={{ color: C.muted, fontSize: 12 }}>{t("inviteSub")}</div>
          </div>
        </button>

        {/* Honest disclosure: the group itself is a local demo — only the trip
            link is real. Keeps testers from expecting live invitations. */}
        <div style={{
          background: `${C.blue}10`, border: `1px solid ${C.blue}33`, borderRadius: 10,
          padding: "8px 12px", marginTop: -8, marginBottom: 18, color: C.mutedLight, fontSize: 12, lineHeight: 1.5,
        }}>
          <TriangleAlert size={11} style={{ verticalAlign: -1.5, marginRight: 5 }} />{t("inviteDemoHint")}
        </div>

        <div style={{ color: C.muted, fontSize: 11, fontWeight: 800, letterSpacing: 1.2, marginBottom: 10 }}>
          {t("fromContacts")}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {CONTACTS.map((id) => {
            const added = inTrip(id);
            return (
              <div key={id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar id={id} size={38} />
                <span style={{ flex: 1, color: C.cream, fontSize: 16, fontWeight: 600 }}>{PEOPLE[id].name}</span>
                <button
                  onClick={() => !added && !full && onInvite(id)}
                  disabled={added || full}
                  style={{
                    background: added ? "transparent" : full ? C.card : C.gold,
                    color: added ? C.green : full ? C.muted : C.bg,
                    border: added
                      ? `1px solid ${C.green}55`
                      : full ? `1px solid ${C.border}` : "none",
                    borderRadius: 999, padding: "9px 16px", fontSize: 14, fontWeight: 700,
                    cursor: added || full ? "default" : "pointer", fontFamily: "inherit",
                    opacity: full && !added ? 0.55 : 1,
                  }}>
                  {added ? t("invited") : t("invite")}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---- main collaboration screen ---------------------------------------------
export default function Collab({ route, onClose }) {
  const { t } = useI18n();
  const [st, setSt] = useState(() => loadCollab(route));
  const [tab, setTab] = useState("votes");
  const [invite, setInvite] = useState(false);
  const [toast, setToast] = useState(null);
  const [expLabel, setExpLabel] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expBy, setExpBy] = useState("you");
  const timers = useRef([]);

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2200); };

  // persist on every change
  useEffect(() => { saveCollab(route, st); }, [route, st]);

  const pushFeed = (feed, who, key, args) =>
    [{ id: `f${Date.now()}${Math.random().toString(36).slice(2, 6)}`, who, key, args, t: "tNow" }, ...feed];

  // replay scripted friend activity once, on open
  useEffect(() => {
    const script = activityScript(route, loadCollab(route));
    timers.current = script.map((ev) =>
      setTimeout(() => {
        setSt((prev) => {
          if (ev.kind === "vote") {
            // Scripted voters are always existing members now — joining is
            // driven solely by the invite flow, never by this replay.
            const voters = prev.votes[ev.stop] || [];
            if (voters.includes(ev.who)) return prev;
            return {
              ...prev,
              votes: { ...prev.votes, [ev.stop]: [...voters, ev.who] },
              feed: pushFeed(prev.feed, ev.who, "feedVoted", { x: ev.stop }),
            };
          }
          if (ev.kind === "suggest") {
            const sug = { id: `g${Date.now()}`, by: ev.who, ideaKey: ev.idea.key, emoji: ev.idea.emoji, accepted: false };
            return { ...prev, suggestions: [...prev.suggestions, sug], feed: pushFeed(prev.feed, ev.who, "feedProposed", { x: t(ev.idea.key) }) };
          }
          return prev;
        });
        if (ev.kind === "suggest") flash(t("toastProposed", { name: PEOPLE[ev.who].name }));
        if (ev.join) flash(t("toastJoined", { name: PEOPLE[ev.who].name }));
      }, ev.delay)
    );
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- user actions ----
  const toggleVote = (stopName) => {
    setSt((prev) => {
      const voters = prev.votes[stopName] || [];
      const has = voters.includes("you");
      const next = has ? voters.filter((v) => v !== "you") : [...voters, "you"];
      return {
        ...prev,
        votes: { ...prev.votes, [stopName]: next },
        feed: has ? prev.feed : pushFeed(prev.feed, "you", "feedYouVoted", { x: stopName }),
      };
    });
  };

  const doInvite = (id) => {
    // Refuse silently if the group is already at capacity — the UI also greys
    // the invite buttons out, so this is a belt-and-braces guard.
    if (st.members.length + st.pending.length >= MAX_MEMBERS) {
      flash(t("groupFull", { n: MAX_MEMBERS }));
      return;
    }
    setSt((prev) => ({ ...prev, pending: [...prev.pending, id], feed: pushFeed(prev.feed, "you", "feedYouInvited", { name: PEOPLE[id].name }) }));
    flash(t("toastInviteSent", { name: PEOPLE[id].name }));
    // they "join" shortly after
    const timer = setTimeout(() => {
      setSt((prev) => prev.pending.includes(id)
        ? { ...prev, members: [...prev.members, id], pending: prev.pending.filter((p) => p !== id), feed: pushFeed(prev.feed, id, "feedJoined") }
        : prev);
      flash(t("toastJoined", { name: PEOPLE[id].name }));
    }, 2400);
    timers.current.push(timer);
  };

  const addExpense = () => {
    const amount = parseFloat(expAmount);
    const label = expLabel.trim();
    if (!label || !(amount > 0)) return;
    setSt((prev) => ({
      ...prev,
      expenses: [{ id: `x${Date.now()}`, by: expBy, label, amount: Math.round(amount * 100) / 100 }, ...(prev.expenses || [])],
      feed: pushFeed(prev.feed, expBy, "feedAddedExpense", { label, amt: amount }),
    }));
    setExpLabel(""); setExpAmount("");
    flash(t("toastExpenseAdded"));
  };

  const acceptSuggestion = (id) => {
    setSt((prev) => {
      const sug = prev.suggestions.find((s) => s.id === id);
      return {
        ...prev,
        suggestions: prev.suggestions.map((s) => (s.id === id ? { ...s, accepted: true } : s)),
        feed: sug ? pushFeed(prev.feed, "you", "feedAddedStop", { x: t(sug.ideaKey) }) : prev.feed,
      };
    });
    flash(t("toastStopAdded"));
  };

  // ---- derived ----
  const voteCount = (name) => (st.votes[name] || []).length;
  const youVoted = (name) => (st.votes[name] || []).includes("you");
  let topName = null, topCount = 0;
  for (const d of route.itinerary)
    for (const s of d.stops)
      if (voteCount(s.name) > topCount) { topCount = voteCount(s.name); topName = s.name; }

  const pendingSuggestions = st.suggestions.filter((s) => !s.accepted);
  const expenses = st.expenses || [];
  const balances = computeBalances(st.members, expenses);

  return (
    <div style={{
      position: "absolute", inset: 0, background: C.bg, zIndex: 50,
      display: "flex", flexDirection: "column", animation: "vai-rise .25s both",
    }}>
      {/* header */}
      <div style={{ flexShrink: 0, padding: "8px 18px 12px", background: `linear-gradient(180deg, ${C.blue}1f, transparent)` }}>
        <div style={{ height: 36, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={onClose} aria-label={t("back")} style={{ background: "none", border: "none", color: C.cream, fontSize: 24, cursor: "pointer" }}>‹</button>
          <span style={{ color: C.cream, fontSize: 16, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 7 }}>
            <Users size={16} />{t("collabTitle")}
          </span>
          <button onClick={() => setInvite(true)} aria-label={t("inviteTitle")} style={{ background: "none", border: "none", color: C.cream, cursor: "pointer", lineHeight: 0 }}><Plus size={22} /></button>
        </div>
        <div style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>{tripTitle(route, t)}</div>

        {/* members strip */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
          {st.members.map((id) => <Avatar key={id} id={id} />)}
          {st.pending.map((id) => (
            <div key={id} style={{ position: "relative" }}>
              <Avatar id={id} dim />
              <span style={{ position: "absolute", bottom: -2, right: -2, display: "flex" }}><Hourglass size={11} color={C.gold} /></span>
            </div>
          ))}
          <button onClick={() => setInvite(true)} aria-label={t("inviteMore")} style={{
            width: 34, height: 34, borderRadius: "50%", background: "transparent",
            border: `2px dashed ${C.border}`, color: C.muted, fontSize: 18, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>+</button>
          <span style={{ color: C.muted, fontSize: 13, marginLeft: 4 }}>{t("inGroup", { n: st.members.length })} · <span style={{ color: st.members.length >= MAX_MEMBERS ? C.red : C.muted, fontWeight: 700 }}>{st.members.length}/{MAX_MEMBERS}</span></span>
        </div>

        {/* tabs */}
        <div style={{ display: "flex", gap: 6, marginTop: 14, background: C.card, borderRadius: 12, padding: 4 }}>
          {[["votes", Vote, t("tabVotes")], ["costs", Wallet, t("tabCosts")], ["activity", Zap, t("tabActivity")]].map(([v, TabIcon, label]) => (
            <button key={v} onClick={() => setTab(v)} style={{
              flex: 1, background: tab === v ? C.gold : "transparent",
              color: tab === v ? C.bg : C.mutedLight, border: "none", borderRadius: 9,
              padding: "9px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
            }}><TabIcon size={13} />{label}</button>
          ))}
        </div>
      </div>

      {/* ---- Votes tab ---- */}
      {tab === "votes" && (
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "12px 18px 28px" }}>
          {pendingSuggestions.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ color: C.purple, fontSize: 11, fontWeight: 800, letterSpacing: 1.2, marginBottom: 10 }}>
                <Lightbulb size={12} style={{ verticalAlign: -1.5, marginRight: 5 }} />{t("groupSuggestions")}
              </div>
              {pendingSuggestions.map((s) => (
                <div key={s.id} style={{
                  display: "flex", alignItems: "center", gap: 12, background: `${C.purple}14`,
                  border: `1px solid ${C.purple}40`, borderRadius: 14, padding: "12px 14px", marginBottom: 10,
                }}>
                  <span style={{ fontSize: 24 }}>{s.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: C.cream, fontWeight: 700, fontSize: 15 }}>{t(s.ideaKey)}</div>
                    <div style={{ color: C.muted, fontSize: 12 }}>{t("proposedBy", { name: PEOPLE[s.by].name })}</div>
                  </div>
                  <button onClick={() => acceptSuggestion(s.id)} style={{
                    background: C.purple, color: C.bg, border: "none", borderRadius: 999,
                    padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                  }}>{t("add")}</button>
                </div>
              ))}
            </div>
          )}

          <div style={{ color: C.muted, fontSize: 13, marginBottom: 14 }}>
            {t("voteHint")}
          </div>

          {route.itinerary.map((day) => (
            <div key={day.day} style={{ marginBottom: 18 }}>
              {route.days > 1 && (
                <div style={{
                  display: "inline-block", background: C.gold, color: C.bg, fontWeight: 800,
                  fontSize: 13, borderRadius: 8, padding: "5px 12px", marginBottom: 12,
                }}>{t("day", { n: day.day })}</div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {day.stops.map((stop) => {
                  const mine = youVoted(stop.name);
                  const count = voteCount(stop.name);
                  const isTop = topCount > 0 && stop.name === topName;
                  return (
                    <div key={stop.name} style={{
                      background: C.card, border: `1px solid ${isTop ? `${C.gold}66` : C.border}`,
                      borderRadius: 16, padding: "13px 14px",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontSize: 24 }}>{stop.emoji}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: C.cream, fontWeight: 700, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stop.name}</span>
                            {isTop && (
                              <span style={{ background: `${C.gold}22`, color: C.gold, fontSize: 11, fontWeight: 800, borderRadius: 6, padding: "2px 7px", flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4 }}><Heart size={11} fill="currentColor" />{t("favorite")}</span>
                            )}
                          </div>
                          <div style={{ color: C.muted, fontSize: 13, marginTop: 2 }}><Clock size={12} style={{ verticalAlign: -1.5, marginRight: 4 }} />{stop.time} · {stop.durLabel}</div>
                        </div>
                        <button onClick={() => toggleVote(stop.name)} style={{
                          background: mine ? C.gold : "transparent", color: mine ? C.bg : C.gold,
                          border: `1.5px solid ${C.gold}${mine ? "" : "66"}`, borderRadius: 999,
                          padding: "8px 14px", fontSize: 14, fontWeight: 800, cursor: "pointer",
                          fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
                        }}>
                          <ThumbsUp size={14} fill={mine ? "currentColor" : "none"} /> {count}
                        </button>
                      </div>
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                        <VoterStack ids={st.votes[stop.name]} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---- Costs tab ---- */}
      {tab === "costs" && (
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "12px 18px 28px" }}>
          {/* summary */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ color: C.muted, fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>{t("costsTotal")}</span>
              <span style={{ color: C.gold, fontSize: 24, fontWeight: 800 }}>€{balances.total}</span>
            </div>
            <div style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>
              {t("perPerson", { x: balances.share, n: st.members.length })}
            </div>
          </div>

          {/* settle up */}
          <div style={{ color: C.gold, fontSize: 11, fontWeight: 800, letterSpacing: 1.2, marginBottom: 10 }}>
            <Handshake size={12} style={{ verticalAlign: -1.5, marginRight: 5 }} />{t("settle")}
          </div>
          {balances.transfers.length === 0 ? (
            <div style={{ background: `${C.green}14`, border: `1px solid ${C.green}40`, borderRadius: 14, padding: "14px 16px", marginBottom: 18, color: C.green, fontSize: 14, fontWeight: 600, textAlign: "center" }}>
              {t("balanced")}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
              {balances.transfers.map((t, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 14px" }}>
                  <Avatar id={t.from} size={28} />
                  <span style={{ color: C.cream, fontSize: 14, fontWeight: 600 }}>{PEOPLE[t.from].name}</span>
                  <span style={{ color: C.muted, fontSize: 16 }}>→</span>
                  <Avatar id={t.to} size={28} />
                  <span style={{ color: C.cream, fontSize: 14, fontWeight: 600, flex: 1 }}>{PEOPLE[t.to].name}</span>
                  <span style={{ color: C.gold, fontSize: 15, fontWeight: 800 }}>€{t.amount}</span>
                </div>
              ))}
            </div>
          )}

          {/* add expense */}
          <div style={{ color: C.gold, fontSize: 11, fontWeight: 800, letterSpacing: 1.2, marginBottom: 10 }}>
            <Plus size={12} style={{ verticalAlign: -1.5, marginRight: 5 }} />{t("addExpenseTitle")}
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 14px", marginBottom: 18 }}>
            <input
              value={expLabel}
              onChange={(e) => setExpLabel(e.target.value)}
              placeholder={t("expensePh")}
              style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 12px", color: C.cream, fontSize: 14, fontFamily: "inherit", outline: "none", marginBottom: 10 }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={expAmount}
                onChange={(e) => setExpAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                placeholder={t("amountPh")}
                style={{ width: 90, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 12px", color: C.cream, fontSize: 14, fontFamily: "inherit", outline: "none" }}
              />
              <select
                value={expBy}
                onChange={(e) => setExpBy(e.target.value)}
                style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 12px", color: C.cream, fontSize: 14, fontFamily: "inherit", outline: "none" }}
              >
                {st.members.map((id) => (
                  <option key={id} value={id} style={{ background: C.surface }}>
                    {PEOPLE[id].avatar} {id === "you" ? t("youPaid") : t("paidByOpt", { name: PEOPLE[id].name })}
                  </option>
                ))}
              </select>
              <button onClick={addExpense} style={{
                background: C.gold, border: "none", borderRadius: 10, padding: "0 16px",
                color: C.bg, fontSize: 18, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
              }}>+</button>
            </div>
          </div>

          {/* expense list */}
          <div style={{ color: C.muted, fontSize: 11, fontWeight: 800, letterSpacing: 1.2, marginBottom: 10 }}>
            {t("historyLabel", { n: expenses.length })}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {expenses.length === 0 && (
              <div style={{ color: C.muted, fontSize: 14, textAlign: "center", padding: "10px 0" }}>{t("noExpenses")}</div>
            )}
            {expenses.map((e) => (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "11px 14px" }}>
                <Avatar id={e.by} size={30} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: C.cream, fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.label}</div>
                  <div style={{ color: C.muted, fontSize: 12 }}>{t("paidBy", { name: PEOPLE[e.by].name })}</div>
                </div>
                <span style={{ color: C.cream, fontSize: 15, fontWeight: 800 }}>€{e.amount}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- Activity tab ---- */}
      {tab === "activity" && (
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "12px 18px 28px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {st.feed.map((ev, i) => (
              <div key={ev.id} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 4px",
                borderBottom: i < st.feed.length - 1 ? `1px solid ${C.border}` : "none",
                animation: ev.t === "tNow" ? "vai-rise .35s both" : undefined,
              }}>
                <Avatar id={ev.who} size={38} />
                <div style={{ flex: 1 }}>
                  <div style={{ color: C.cream, fontSize: 15 }}>
                    <b style={{ fontWeight: 800 }}>{PEOPLE[ev.who].name}</b> {ev.key ? t(ev.key, ev.args) : ev.text}
                  </div>
                  <div style={{ color: C.muted, fontSize: 12, marginTop: 1 }}>{t(ev.t)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* footer */}
      <div style={{ flexShrink: 0, padding: "12px 18px 22px", borderTop: `1px solid ${C.border}`, background: C.bg }}>
        <Btn variant="soft" color={C.blue} onClick={() => setInvite(true)}><Plus size={15} style={{ verticalAlign: -2, marginRight: 7 }} />{t("inviteMore")}</Btn>
      </div>

      {toast && (
        <div style={{
          position: "absolute", left: "50%", bottom: 110, transform: "translateX(-50%)",
          background: C.cream, color: C.bg, padding: "12px 20px", borderRadius: 999,
          fontSize: 14, fontWeight: 700, zIndex: 70, whiteSpace: "nowrap",
          animation: "vai-pop .2s both", boxShadow: "0 10px 30px #0008",
        }}>{toast}</div>
      )}

      {invite && (
        <InviteSheet
          route={route}
          members={st.members}
          pending={st.pending}
          onInvite={doInvite}
          onClose={() => setInvite(false)}
        />
      )}
    </div>
  );
}
