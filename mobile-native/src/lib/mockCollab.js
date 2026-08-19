// Mock collaboration engine — group trip planning without a backend.
// Members, votes, suggestions and a live activity feed are simulated locally
// and persisted in localStorage, the same way mockEngine fakes the AI itinerary.
// A real version would sync this state over a websocket / shared document.

import { C } from "./theme.js";

// Maximum group size — enough to plan a small holiday together without turning
// the vote/expense math into noise. Enforced client-side when inviting.
export const MAX_MEMBERS = 10;

// Everyone who can be part of a trip. `you` is always the owner. The 4 extra
// personas at the bottom keep the invite list interesting once the group grows.
export const PEOPLE = {
  you:    { id: "you",    name: "Tu",     avatar: "😎", color: C.gold },
  maria:  { id: "maria",  name: "Maria",  avatar: "🦊", color: C.blue },
  andrei: { id: "andrei", name: "Andrei", avatar: "🐻", color: C.green },
  ioana:  { id: "ioana",  name: "Ioana",  avatar: "🦉", color: C.purple },
  vlad:   { id: "vlad",   name: "Vlad",   avatar: "🦅", color: C.red },
  elena:  { id: "elena",  name: "Elena",  avatar: "🐱", color: C.goldLight },
  radu:   { id: "radu",   name: "Radu",   avatar: "🐺", color: "#5FC3E4" },
  ana:    { id: "ana",    name: "Ana",    avatar: "🐝", color: "#FFB84C" },
  mihai:  { id: "mihai",  name: "Mihai",  avatar: "🦁", color: "#E0705C" },
  diana:  { id: "diana",  name: "Diana",  avatar: "🦋", color: "#B45CF3" },
};

// Friends you can still invite (not already in the trip when it's seeded).
export const CONTACTS = ["ioana", "vlad", "elena", "radu", "ana", "mihai", "diana"];

const allStops = (route) => route.itinerary.flatMap((d) => d.stops);
const KEY = (id) => `vai_collab_${id}`;

// A fresh group: you + two friends already in, a few seeded votes and a feed.
function seed(route) {
  const stops = allStops(route);
  const votes = {};
  stops.forEach((s, i) => {
    const v = [];
    if (i % 2 === 0) v.push("maria");
    if (i % 3 === 0) v.push("andrei");
    votes[s.name] = v;
  });
  const first = stops[0]?.name || "traseu";
  return {
    members: ["you", "maria", "andrei"], // joined
    pending: [],                         // invited, not joined yet
    votes,                               // { [stopName]: [memberId, ...] }
    suggestions: [],                     // [{ id, by, name, emoji, accepted }]
    expenses: [                          // [{ id, by, label, amount }]
      { id: "e1", by: "maria", label: "Bilete muzeu", amount: 48 },
      { id: "e2", by: "andrei", label: "Cină în grup", amount: 96 },
    ],
    // Feed entries are structured ({who, key, args, t}) so the UI can localize
    // them; `key`/`t` map to i18n keys.
    feed: [
      { id: "s3", who: "maria",  key: "feedVoted", args: { x: first }, t: "t40m" },
      { id: "s2", who: "andrei", key: "feedJoined", t: "t1h" },
      { id: "s1", who: "maria",  key: "feedJoined", t: "t2h" },
    ],
  };
}

export function loadCollab(route) {
  try {
    const raw = localStorage.getItem(KEY(route.id));
    if (raw) return JSON.parse(raw);
  } catch {}
  return seed(route);
}

export function saveCollab(route, state) {
  try { localStorage.setItem(KEY(route.id), JSON.stringify(state)); } catch {}
}

// Split all expenses equally across current members and compute who owes whom.
// Returns per-member net balances (+ = is owed, - = owes) and a minimal set of
// "X → Y: €Z" settlement transfers (greedy debtor/creditor matching).
export function computeBalances(members, expenses) {
  const total = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const share = members.length ? total / members.length : 0;

  const paid = Object.fromEntries(members.map((m) => [m, 0]));
  for (const e of expenses) if (e.by in paid) paid[e.by] += e.amount || 0;

  const net = members.map((m) => ({ id: m, balance: Math.round((paid[m] - share) * 100) / 100 }));

  // Greedy settle-up.
  const debtors = net.filter((n) => n.balance < -0.01).map((n) => ({ ...n })).sort((a, b) => a.balance - b.balance);
  const creditors = net.filter((n) => n.balance > 0.01).map((n) => ({ ...n })).sort((a, b) => b.balance - a.balance);
  const transfers = [];
  let di = 0, ci = 0;
  while (di < debtors.length && ci < creditors.length) {
    const amt = Math.min(-debtors[di].balance, creditors[ci].balance);
    if (amt > 0.01) {
      transfers.push({ from: debtors[di].id, to: creditors[ci].id, amount: Math.round(amt * 100) / 100 });
      debtors[di].balance += amt;
      creditors[ci].balance -= amt;
    }
    if (-debtors[di].balance < 0.01) di++;
    if (creditors[ci].balance < 0.01) ci++;
  }

  return { total, share: Math.round(share * 100) / 100, net, transfers };
}

// A destination-flavoured extra a friend might propose adding to the trip.
// Stored as i18n keys so the suggestion localizes with the UI.
const IDEAS = [
  { key: "ideaFood", emoji: "🍷" },
  { key: "ideaSunrise", emoji: "🌅" },
  { key: "ideaBike", emoji: "🚴" },
  { key: "ideaMarket", emoji: "🧺" },
];
export function ideaFor(route) {
  const i = (route.id || "x").length % IDEAS.length;
  return IDEAS[i];
}

// Scripted "other people are active" events, replayed after the screen opens —
// the same trick the Loading screen uses to make the demo feel alive.
export function activityScript(route, state) {
  const names = allStops(route).map((s) => s.name);
  const notVoted = (who) => names.find((n) => !(state.votes[n] || []).includes(who));
  return [
    { delay: 2600, kind: "vote",    who: "andrei", stop: notVoted("andrei") || names[0] },
    { delay: 5400, kind: "suggest", who: "maria",  idea: ideaFor(route) },
    { delay: 8800, kind: "vote",    who: "ioana",  stop: notVoted("ioana") || names[1] || names[0], join: true },
  ];
}
