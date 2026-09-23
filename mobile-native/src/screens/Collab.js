// Group trip planning, ported from src/screens/Collab.jsx.
//
// The engine underneath (mockCollab.js) is shared byte-for-byte with the web
// app and is a LOCAL SIMULATION: nothing syncs between devices, the friends are
// personas, and their votes are replayed from a script. The invite sheet says
// so, in every language, because a group feature that quietly does nothing is
// worse than no group feature.
//
// What is real: the trip text the invite shares, and everything you enter
// yourself — votes, expenses, the settle-up arithmetic.

import { useEffect, useRef, useState } from "react";
import {
  View, Text, ScrollView, Pressable, Modal, TextInput, Share,
  StyleSheet, KeyboardAvoidingView, Platform,
} from "react-native";
import { C, themedStyles } from "../lib/theme.js";
import { useI18n, tripTitle } from "../lib/i18n.js";
import { FONT } from "../fonts.js";
import { Btn } from "../components/ui.js";
import {
  PEOPLE, CONTACTS, MAX_MEMBERS, loadCollab, saveCollab, activityScript, computeBalances,
  personColor,
} from "../lib/mockCollab.js";
import { tripAsText } from "../lib/tripText.js";
import {
  Plus, TriangleAlert, Link2, Check, Users, Clock, Lightbulb, Zap, Wallet,
  ThumbsUp, Heart, Handshake, Hourglass, Vote, X,
} from "../icons.js";

// ---- small bits -------------------------------------------------------------
function Avatar({ id, size = 34, ring = true, dim = false }) {
  const p = PEOPLE[id];
  if (!p) return null;
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2, backgroundColor: C.card,
      borderWidth: ring ? 2 : 0, borderColor: personColor(id),
      alignItems: "center", justifyContent: "center", opacity: dim ? 0.5 : 1,
    }}>
      <Text style={{ fontSize: size * 0.5 }}>{p.avatar}</Text>
    </View>
  );
}

// Overlapping voter avatars (max 3 + "+n").
function VoterStack({ ids }) {
  const { t } = useI18n();
  if (!ids || ids.length === 0) return <Text style={styles.dim}>{t("noVotes")}</Text>;
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {ids.slice(0, 3).map((id, i) => (
        <View key={id} style={{ marginLeft: i === 0 ? 0 : -8 }}><Avatar id={id} size={22} /></View>
      ))}
      {ids.length > 3 && <Text style={[styles.dim, { marginLeft: 6 }]}>+{ids.length - 3}</Text>}
    </View>
  );
}

// ---- invite sheet -----------------------------------------------------------
function InviteSheet({ route, members, pending, onInvite, onClose }) {
  const { t } = useI18n();
  const [sent, setSent] = useState(false);
  const inTrip = (id) => members.includes(id) || pending.includes(id);
  const groupSize = members.length + pending.length;
  const full = groupSize >= MAX_MEMBERS;

  // The web app copies a link, because the whole trip fits in a URL hash there.
  // Here there is no such URL, so the invitation carries the itinerary itself
  // through the OS share sheet — a real thing to send, not a dead link.
  const shareInvite = async () => {
    try {
      const title = tripTitle(route, t);
      await Share.share({ message: tripAsText(route, t, title, t("inviteSub")), title });
      setSent(true);
    } catch { /* the user dismissed the sheet */ }
  };

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* The sheet scrolls: with the full contact list it used to grow past
            the screen on the web, covering the backdrop that was the only way
            out. There is an explicit close button too, for the same reason. */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grab} />
          <View style={styles.sheetHead}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7, flex: 1 }}>
              <Plus size={18} color={C.cream} />
              <Text style={styles.sheetTitle}>{t("inviteTitle")}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={[styles.countPill, {
                backgroundColor: (full ? C.red : C.gold) + "22",
                borderColor: (full ? C.red : C.gold) + "55",
              }]}>
                <Text style={{ color: full ? C.red : C.gold, fontFamily: FONT.bold, fontSize: 12 }}>
                  {groupSize} / {MAX_MEMBERS}
                </Text>
              </View>
              <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={t("back")}>
                <X size={20} color={C.muted} />
              </Pressable>
            </View>
          </View>

          <ScrollView style={{ maxHeight: 460 }} keyboardShouldPersistTaps="handled">
            {full && (
              <View style={[styles.note, { backgroundColor: C.red + "12", borderColor: C.red + "40" }]}>
                <TriangleAlert size={13} color={C.red} />
                <Text style={[styles.noteText, { color: C.red }]}>{t("groupFull", { n: MAX_MEMBERS })}</Text>
              </View>
            )}

            <Pressable onPress={shareInvite} style={styles.linkBtn}>
              {sent ? <Check size={20} color={C.green} /> : <Link2 size={20} color={C.gold} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.linkTitle}>{sent ? t("inviteCopied") : t("copyInvite")}</Text>
                <Text style={styles.dim}>{t("inviteSub")}</Text>
              </View>
            </Pressable>

            {/* Honest disclosure: the group itself is a local demo — only the
                shared trip is real. Keeps testers from expecting live
                invitations that are never going to arrive. */}
            <View style={[styles.note, { backgroundColor: C.blue + "10", borderColor: C.blue + "33" }]}>
              <TriangleAlert size={11} color={C.mutedLight} />
              <Text style={[styles.noteText, { color: C.mutedLight }]}>{t("inviteDemoHint")}</Text>
            </View>

            <Text style={styles.section}>{t("fromContacts")}</Text>
            <View style={{ gap: 10, paddingBottom: 8 }}>
              {CONTACTS.map((id) => {
                const added = inTrip(id);
                return (
                  <View key={id} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Avatar id={id} size={38} />
                    <Text style={styles.personName}>{PEOPLE[id].name}</Text>
                    <Pressable
                      onPress={() => !added && !full && onInvite(id)}
                      disabled={added || full}
                      style={[styles.invBtn, {
                        backgroundColor: added ? "transparent" : full ? C.card : C.gold,
                        borderColor: added ? C.green + "55" : full ? C.border : "transparent",
                        opacity: full && !added ? 0.55 : 1,
                      }]}>
                      <Text style={{
                        color: added ? C.green : full ? C.muted : C.bg,
                        fontFamily: FONT.bold, fontSize: 14,
                      }}>{added ? t("invited") : t("invite")}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
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
  const toastTimer = useRef(null);

  const flash = (msg) => {
    setToast(msg);
    // One timer, replaced: rapid actions used to queue several, and an early
    // one would clear a later toast the moment it appeared.
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

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
      }, ev.delay),
    );
    return () => {
      timers.current.forEach(clearTimeout);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
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
    // The UI greys these out at capacity; this is the belt to that's braces.
    if (st.members.length + st.pending.length >= MAX_MEMBERS) {
      flash(t("groupFull", { n: MAX_MEMBERS }));
      return;
    }
    setSt((prev) => ({ ...prev, pending: [...prev.pending, id], feed: pushFeed(prev.feed, "you", "feedYouInvited", { name: PEOPLE[id].name }) }));
    flash(t("toastInviteSent", { name: PEOPLE[id].name }));
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

  const TABS = [["votes", Vote, t("tabVotes")], ["costs", Wallet, t("tabCosts")], ["activity", Zap, t("tabActivity")]];

  return (
    <View style={styles.wrap}>
      {/* header */}
      <View style={styles.header}>
        <View style={styles.headRow}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel={t("back")}>
            <Text style={{ color: C.cream, fontSize: 24 }}>‹</Text>
          </Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <Users size={16} color={C.cream} />
            <Text style={styles.headTitle}>{t("collabTitle")}</Text>
          </View>
          <Pressable onPress={() => setInvite(true)} hitSlop={12} accessibilityLabel={t("inviteTitle")}>
            <Plus size={22} color={C.cream} />
          </Pressable>
        </View>
        <Text style={[styles.dim, { marginTop: 2 }]}>{tripTitle(route, t)}</Text>

        {/* members strip */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          {st.members.map((id) => <Avatar key={id} id={id} />)}
          {st.pending.map((id) => (
            <View key={id}>
              <Avatar id={id} dim />
              <View style={{ position: "absolute", bottom: -2, right: -2 }}>
                <Hourglass size={11} color={C.gold} />
              </View>
            </View>
          ))}
          <Pressable onPress={() => setInvite(true)} accessibilityLabel={t("inviteMore")} style={styles.addDot}>
            <Text style={{ color: C.muted, fontSize: 18 }}>+</Text>
          </Pressable>
          <Text style={styles.dim}>
            {t("inGroup", { n: st.members.length })} ·{" "}
            <Text style={{ color: st.members.length >= MAX_MEMBERS ? C.red : C.muted, fontFamily: FONT.bold }}>
              {st.members.length}/{MAX_MEMBERS}
            </Text>
          </Text>
        </View>

        {/* tabs */}
        <View style={styles.tabs}>
          {TABS.map(([v, TabIcon, label]) => {
            const on = tab === v;
            return (
              <Pressable key={v} onPress={() => setTab(v)} style={[styles.tab, { backgroundColor: on ? C.gold : "transparent" }]}>
                <TabIcon size={13} color={on ? C.bg : C.mutedLight} />
                <Text style={{ color: on ? C.bg : C.mutedLight, fontFamily: FONT.bold, fontSize: 13 }}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ---- Votes tab ---- */}
      {tab === "votes" && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>
          {pendingSuggestions.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <View style={styles.sectionRow}>
                <Lightbulb size={12} color={C.purple} />
                <Text style={[styles.section, { color: C.purple, marginBottom: 0 }]}>{t("groupSuggestions")}</Text>
              </View>
              {pendingSuggestions.map((s) => (
                <View key={s.id} style={styles.suggestion}>
                  <Text style={{ fontSize: 24 }}>{s.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{t(s.ideaKey)}</Text>
                    <Text style={styles.dim}>{t("proposedBy", { name: PEOPLE[s.by].name })}</Text>
                  </View>
                  <Pressable onPress={() => acceptSuggestion(s.id)} style={[styles.pillBtn, { backgroundColor: C.purple }]}>
                    <Text style={{ color: C.bg, fontFamily: FONT.bold, fontSize: 13 }}>{t("add")}</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <Text style={[styles.dim, { marginBottom: 14 }]}>{t("voteHint")}</Text>

          {route.itinerary.map((day) => (
            <View key={day.day} style={{ marginBottom: 18 }}>
              {route.days > 1 && (
                <View style={styles.dayChip}>
                  <Text style={{ color: C.bg, fontFamily: FONT.bold, fontSize: 13 }}>{t("day", { n: day.day })}</Text>
                </View>
              )}
              <View style={{ gap: 10 }}>
                {day.stops.map((stop) => {
                  const mine = youVoted(stop.name);
                  const count = voteCount(stop.name);
                  const isTop = topCount > 0 && stop.name === topName;
                  return (
                    <View key={stop.name} style={[styles.card, { borderColor: isTop ? C.gold + "66" : C.border }]}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                        <Text style={{ fontSize: 24 }}>{stop.emoji}</Text>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <Text style={styles.rowTitle} numberOfLines={1}>{stop.name}</Text>
                            {isTop && (
                              <View style={styles.favChip}>
                                <Heart size={11} color={C.gold} fill={C.gold} />
                                <Text style={{ color: C.gold, fontFamily: FONT.bold, fontSize: 11 }}>{t("favorite")}</Text>
                              </View>
                            )}
                          </View>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                            <Clock size={12} color={C.muted} />
                            <Text style={styles.dim}>{stop.time} · {stop.durLabel}</Text>
                          </View>
                        </View>
                        <Pressable
                          onPress={() => toggleVote(stop.name)}
                          accessibilityLabel={`${t("tabVotes")} — ${stop.name}`}
                          style={[styles.voteBtn, {
                            backgroundColor: mine ? C.gold : "transparent",
                            borderColor: mine ? C.gold : C.gold + "66",
                          }]}>
                          <ThumbsUp size={14} color={mine ? C.bg : C.gold} fill={mine ? C.bg : "none"} />
                          <Text style={{ color: mine ? C.bg : C.gold, fontFamily: FONT.bold, fontSize: 14 }}>{count}</Text>
                        </Pressable>
                      </View>
                      <View style={styles.cardFoot}><VoterStack ids={st.votes[stop.name]} /></View>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* ---- Costs tab ---- */}
      {tab === "costs" && (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <View style={[styles.card, { marginBottom: 16 }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                <Text style={styles.section}>{t("costsTotal")}</Text>
                <Text style={{ color: C.gold, fontSize: 24, fontFamily: FONT.bold }}>€{balances.total}</Text>
              </View>
              <Text style={styles.dim}>{t("perPerson", { x: balances.share, n: st.members.length })}</Text>
            </View>

            <View style={styles.sectionRow}>
              <Handshake size={12} color={C.gold} />
              <Text style={[styles.section, { color: C.gold, marginBottom: 0 }]}>{t("settle")}</Text>
            </View>
            {balances.transfers.length === 0 ? (
              <View style={styles.balanced}>
                <Text style={{ color: C.green, fontSize: 14, fontFamily: FONT.semibold, textAlign: "center" }}>{t("balanced")}</Text>
              </View>
            ) : (
              <View style={{ gap: 8, marginBottom: 18 }}>
                {balances.transfers.map((tr, i) => (
                  <View key={i} style={styles.transfer}>
                    <Avatar id={tr.from} size={28} />
                    <Text style={styles.person}>{PEOPLE[tr.from].name}</Text>
                    <Text style={{ color: C.muted, fontSize: 16 }}>→</Text>
                    <Avatar id={tr.to} size={28} />
                    <Text style={[styles.person, { flex: 1 }]}>{PEOPLE[tr.to].name}</Text>
                    <Text style={{ color: C.gold, fontSize: 15, fontFamily: FONT.bold }}>€{tr.amount}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.sectionRow}>
              <Plus size={12} color={C.gold} />
              <Text style={[styles.section, { color: C.gold, marginBottom: 0 }]}>{t("addExpenseTitle")}</Text>
            </View>
            <View style={[styles.card, { marginBottom: 18 }]}>
              <TextInput
                value={expLabel} onChangeText={setExpLabel}
                placeholder={t("expensePh")} placeholderTextColor={C.muted}
                style={[styles.input, { marginBottom: 10 }]}
              />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput
                  value={expAmount}
                  onChangeText={(v) => setExpAmount(v.replace(/[^0-9.]/g, ""))}
                  keyboardType="decimal-pad"
                  placeholder={t("amountPh")} placeholderTextColor={C.muted}
                  style={[styles.input, { width: 100 }]}
                />
                <Pressable onPress={addExpense} style={styles.addBtn} accessibilityLabel={t("addExpenseTitle")}>
                  <Plus size={18} color={C.bg} />
                </Pressable>
              </View>
              {/* A <select> on the web; chips here. With ten possible members a
                  picker would hide who is paying behind a tap, and getting that
                  wrong silently skews every balance below. */}
              {st.members.length > 1 && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                  {st.members.map((id) => {
                    const on = id === expBy;
                    return (
                      <Pressable key={id} onPress={() => setExpBy(id)} style={[styles.payChip, {
                        backgroundColor: on ? C.gold : C.bg, borderColor: on ? C.gold : C.border,
                      }]}>
                        <Text style={{ fontSize: 13 }}>{PEOPLE[id].avatar}</Text>
                        <Text style={{ color: on ? C.bg : C.mutedLight, fontFamily: FONT.semibold, fontSize: 13 }}>
                          {id === "you" ? t("youPaid") : t("paidByOpt", { name: PEOPLE[id].name })}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            <Text style={styles.section}>{t("historyLabel", { n: expenses.length })}</Text>
            <View style={{ gap: 8 }}>
              {expenses.length === 0 && (
                <Text style={[styles.dim, { textAlign: "center", paddingVertical: 10 }]}>{t("noExpenses")}</Text>
              )}
              {expenses.map((e) => (
                <View key={e.id} style={styles.expense}>
                  <Avatar id={e.by} size={30} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{e.label}</Text>
                    <Text style={styles.dim}>{t("paidBy", { name: PEOPLE[e.by].name })}</Text>
                  </View>
                  <Text style={{ color: C.cream, fontSize: 15, fontFamily: FONT.bold }}>€{e.amount}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* ---- Activity tab ---- */}
      {tab === "activity" && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>
          {st.feed.length === 0 && <Text style={[styles.dim, { textAlign: "center", paddingVertical: 20 }]}>—</Text>}
          {st.feed.map((ev, i) => (
            <View key={ev.id} style={[styles.feedRow, { borderBottomWidth: i < st.feed.length - 1 ? 1 : 0 }]}>
              <Avatar id={ev.who} size={38} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.cream, fontSize: 15, fontFamily: FONT.body }}>
                  <Text style={{ fontFamily: FONT.bold }}>{PEOPLE[ev.who]?.name}</Text>
                  {" "}{ev.key ? t(ev.key, ev.args) : ev.text}
                </Text>
                <Text style={[styles.dim, { marginTop: 1 }]}>{t(ev.t)}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* footer */}
      <View style={styles.footer}>
        <Btn icon={Plus} variant="soft" color={C.blue} onPress={() => setInvite(true)}>{t("inviteMore")}</Btn>
      </View>

      {toast && (
        <View style={styles.toast} pointerEvents="none">
          <Text style={{ color: C.bg, fontSize: 14, fontFamily: FONT.bold }}>{toast}</Text>
        </View>
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
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12 },
  headRow: { height: 36, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headTitle: { color: C.cream, fontSize: 16, fontFamily: FONT.bold },
  dim: { color: C.muted, fontSize: 13, fontFamily: FONT.body },
  body: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 28 },

  addDot: {
    width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderStyle: "dashed",
    borderColor: C.border, alignItems: "center", justifyContent: "center",
  },
  tabs: { flexDirection: "row", gap: 6, marginTop: 14, backgroundColor: C.card, borderRadius: 12, padding: 4 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 9, borderRadius: 9 },

  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 14 },
  cardFoot: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border },
  rowTitle: { color: C.cream, fontFamily: FONT.bold, fontSize: 15, flexShrink: 1 },
  section: { color: C.muted, fontSize: 11, fontFamily: FONT.bold, letterSpacing: 1.2, marginBottom: 10 },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 10 },

  dayChip: { alignSelf: "flex-start", backgroundColor: C.gold, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 12 },
  favChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.gold + "22", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  voteBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  suggestion: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.purple + "14",
    borderWidth: 1, borderColor: C.purple + "40", borderRadius: 14, padding: 12, marginBottom: 10,
  },
  pillBtn: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },

  balanced: {
    backgroundColor: C.green + "14", borderWidth: 1, borderColor: C.green + "40",
    borderRadius: 14, padding: 14, marginBottom: 18,
  },
  transfer: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  person: { color: C.cream, fontSize: 14, fontFamily: FONT.semibold },
  expense: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
  input: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, color: C.cream, fontSize: 14, fontFamily: FONT.body },
  addBtn: { flex: 1, backgroundColor: C.gold, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  payChip: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },

  feedRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomColor: C.border },
  footer: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 22, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg },
  toast: {
    position: "absolute", alignSelf: "center", bottom: 110, backgroundColor: C.cream,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999,
  },

  backdrop: { flex: 1, backgroundColor: "#000a", justifyContent: "flex-end" },
  sheet: { backgroundColor: C.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 22, paddingTop: 10, paddingBottom: 28 },
  grab: { width: 40, height: 5, backgroundColor: C.border, borderRadius: 3, alignSelf: "center", marginBottom: 16 },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 },
  sheetTitle: { color: C.cream, fontSize: 19, fontFamily: FONT.bold },
  countPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  note: { flexDirection: "row", alignItems: "flex-start", gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 16 },
  noteText: { flex: 1, fontSize: 12, lineHeight: 18, fontFamily: FONT.body },
  linkBtn: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.gold + "40", borderRadius: 14, padding: 14, marginBottom: 12 },
  linkTitle: { color: C.cream, fontFamily: FONT.bold, fontSize: 15 },
  personName: { flex: 1, color: C.cream, fontSize: 16, fontFamily: FONT.semibold },
  invBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
}));
