// Mock collaboration engine — group trip planning without a backend.
// Members, votes, suggestions and a live activity feed are simulated locally
// and persisted in localStorage, the same way mockEngine fakes the AI itinerary.
// A real version would sync this state over a websocket / shared document.

import { C } from "./theme.js";

// Maximum group size — enough to plan a small holiday together without turning
// the vote/expense math into noise. Enforced client-side when inviting.
export const MAX_MEMBERS = 10;

// Everyone who can be part of a trip. `you` is always the owner and, at the
// start, the only member — everybody else appears solely once you invite them.
//
// `tone` is a palette KEY, not a colour. Reading `C.gold` here would freeze the
// value at module-load time: the accent and light/dark mode can both change
// afterwards, and on native `C` is still an empty object at this point, so
// every avatar ring would have been `undefined`. Resolve with personColor().
export const PEOPLE = {
  you:    { id: "you",    name: "Tu",     avatar: "😎", tone: "gold" },
  maria:  { id: "maria",  name: "Maria",  avatar: "🦊", tone: "blue" },
  andrei: { id: "andrei", name: "Andrei", avatar: "🐻", tone: "green" },
  ioana:  { id: "ioana",  name: "Ioana",  avatar: "🦉", tone: "purple" },
  vlad:   { id: "vlad",   name: "Vlad",   avatar: "🦅", tone: "red" },
  elena:  { id: "elena",  name: "Elena",  avatar: "🐱", tone: "goldLight" },
  radu:   { id: "radu",   name: "Radu",   avatar: "🐺", tone: "#5FC3E4" },
  ana:    { id: "ana",    name: "Ana",    avatar: "🐝", tone: "#FFB84C" },
  mihai:  { id: "mihai",  name: "Mihai",  avatar: "🦁", tone: "#E0705C" },
  diana:  { id: "diana",  name: "Diana",  avatar: "🦋", tone: "#B45CF3" },
};

// The colour for a person, in the palette as it is right now. A `tone` that is
// already a literal colour passes straight through; an unknown id falls back to
// the accent rather than rendering a ring of `undefined`.
export function personColor(id) {
  const tone = PEOPLE[id]?.tone;
  if (!tone) return C.gold;
  return tone.startsWith("#") ? tone : (C[tone] || C.gold);
}

// Everyone you can invite — i.e. everyone except yourself.
export const CONTACTS = Object.keys(PEOPLE).filter((id) => id !== "you");

const allStops = (route) => route.itinerary.flatMap((d) => d.stops);
// v2: the previous version seeded a group with two invented friends, their
// votes and their expenses. Bumping the prefix retires that state instead of
// resurrecting a fake group on trips planned before this change.
const KEY = (id) => `vai_collab2_${id}`;

// A fresh group is just you. Members, votes, suggestions, expenses and the
// activity feed all start empty and grow only from real invitations.
function seed() {
  return {
    members: ["you"], // joined
    pending: [],      // invited, not joined yet
    votes: {},        // { [stopName]: [memberId, ...] }
    suggestions: [],  // [{ id, by, name, emoji, accepted }]
    expenses: [],     // [{ id, by, label, amount }]
    // Feed entries are structured ({who, key, args, t}) so the UI can localize
    // them; `key`/`t` map to i18n keys.
    feed: [],
  };
}

export function loadCollab(route) {
  try {
    const raw = localStorage.getItem(KEY(route.id));
    if (raw) return JSON.parse(raw);
  } catch {}
  return seed();
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

// Scripted "the others are active" events, replayed after the screen opens.
// Only people who ACTUALLY joined — i.e. whom you invited — ever act: a group
// of one stays a group of one, and nobody appears uninvited. Previously this
// pulled in two strangers and made a third join on its own.
export function activityScript(route, state) {
  const names = allStops(route).map((s) => s.name);
  const others = (state.members || []).filter((m) => m !== "you" && PEOPLE[m]);
  if (!others.length || !names.length) return [];

  const notVoted = (who) => names.find((n) => !(state.votes[n] || []).includes(who));
  const events = [];
  others.slice(0, 3).forEach((who, i) => {
    const stop = notVoted(who);
    if (stop) events.push({ delay: 2600 + i * 2800, kind: "vote", who, stop });
  });
  // One of them proposes an extra, but only if there's someone there to do it.
  events.push({ delay: 5400, kind: "suggest", who: others[0], idea: ideaFor(route) });
  return events;
}
