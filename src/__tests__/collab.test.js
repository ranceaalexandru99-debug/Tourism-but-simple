import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "node:fs";
import {
  PEOPLE, CONTACTS, MAX_MEMBERS, personColor, computeBalances,
  loadCollab, saveCollab, activityScript, ideaFor,
} from "../mockCollab.js";
import { C } from "../theme.js";

const route = (n = 3) => ({
  id: "r1",
  days: 1,
  itinerary: [{ day: 1, stops: Array.from({ length: n }, (_, i) => ({ name: `Stop ${i + 1}` })) }],
});

describe("the shared group-planning engine", () => {
  it("is byte-identical on web and native", () => {
    // These two files are a copy of each other on purpose: the native one was
    // an abandoned older version that still invented two friends, seeded fake
    // votes and let a stranger join on her own — the exact bug the web copy had
    // been fixed for. Wiring a screen to it would have shipped that bug back.
    const web = fs.readFileSync("src/mockCollab.js", "utf8").replace(/\r\n/g, "\n");
    const native = fs.readFileSync("mobile-native/src/lib/mockCollab.js", "utf8").replace(/\r\n/g, "\n");
    expect(native).toBe(web);
  });

  it("starts a trip as a group of one, with nothing invented", () => {
    const st = loadCollab(route());
    expect(st.members).toEqual(["you"]);
    expect(st.pending).toEqual([]);
    expect(st.votes).toEqual({});
    expect(st.expenses).toEqual([]);
    expect(st.suggestions).toEqual([]);
    expect(st.feed).toEqual([]);
  });

  it("lets nobody act while you are alone", () => {
    // A group of one must stay a group of one. The old native copy scripted
    // "ioana" joining uninvited, which is how a stranger appeared in your trip.
    expect(activityScript(route(), loadCollab(route()))).toEqual([]);
  });

  it("only ever scripts people who actually joined", () => {
    const state = { members: ["you", "maria"], votes: {} };
    const events = activityScript(route(), state);
    expect(events.length).toBeGreaterThan(0);
    for (const ev of events) expect(ev.who).toBe("maria");
  });

  it("never scripts a vote a member has already cast", () => {
    const state = { members: ["you", "maria"], votes: { "Stop 1": ["maria"] } };
    const votes = activityScript(route(), state).filter((e) => e.kind === "vote");
    for (const ev of votes) expect(ev.stop).not.toBe("Stop 1");
  });

  it("offers everyone but you as a contact, and caps the group", () => {
    expect(CONTACTS).not.toContain("you");
    expect(CONTACTS.length).toBe(Object.keys(PEOPLE).length - 1);
    // The cap has to be reachable, or it is not a cap anyone can hit.
    expect(MAX_MEMBERS).toBeLessThanOrEqual(Object.keys(PEOPLE).length);
  });
});

describe("personColor", () => {
  it("resolves a palette key against the palette as it is now", () => {
    expect(personColor("you")).toBe(C.gold);
    expect(personColor("maria")).toBe(C.blue);
  });

  it("passes a literal colour straight through", () => {
    expect(personColor("radu")).toBe("#5FC3E4");
  });

  it("never returns undefined, whatever it is handed", () => {
    // An avatar ring of `undefined` is what reading the palette at import time
    // produced on native, where C is still empty when modules load.
    for (const id of [...Object.keys(PEOPLE), "nobody", "", null, undefined])
      expect(personColor(id)).toBeTruthy();
  });

  it("stores keys, not colours — so a theme switch reaches the avatars", () => {
    for (const p of Object.values(PEOPLE)) {
      expect(p.color).toBeUndefined();
      expect(typeof p.tone).toBe("string");
    }
  });
});

describe("splitting the bill", () => {
  const ids = ["you", "maria", "andrei"];

  it("says nothing is owed when nothing was spent", () => {
    const b = computeBalances(ids, []);
    expect(b.total).toBe(0);
    expect(b.transfers).toEqual([]);
  });

  it("splits one person's payment across everyone", () => {
    const b = computeBalances(ids, [{ by: "you", amount: 90 }]);
    expect(b.total).toBe(90);
    expect(b.share).toBe(30);
    expect(b.transfers).toHaveLength(2);
    for (const tr of b.transfers) {
      expect(tr.to).toBe("you");
      expect(tr.amount).toBe(30);
    }
  });

  it("asks for no transfers when everyone paid their share", () => {
    const b = computeBalances(ids, ids.map((by) => ({ by, amount: 30 })));
    expect(b.transfers).toEqual([]);
  });

  it("settles up: every balance ends at zero", () => {
    const expenses = [
      { by: "you", amount: 120 }, { by: "maria", amount: 15 }, { by: "andrei", amount: 0.5 },
    ];
    const b = computeBalances(ids, expenses);
    const net = Object.fromEntries(b.net.map((n) => [n.id, n.balance]));
    for (const tr of b.transfers) { net[tr.from] += tr.amount; net[tr.to] -= tr.amount; }
    for (const id of ids) expect(Math.abs(net[id])).toBeLessThan(0.02);
  });

  it("moves no more money than it has to", () => {
    // Greedy matching should need at most one transfer fewer than there are
    // people — anything more is someone paying someone who then pays on.
    const b = computeBalances(ids, [{ by: "you", amount: 60 }, { by: "maria", amount: 30 }]);
    expect(b.transfers.length).toBeLessThanOrEqual(ids.length - 1);
  });

  it("ignores an expense from someone no longer in the group", () => {
    // Removing a member must not make the totals disagree with the list.
    const b = computeBalances(["you", "maria"], [{ by: "ghost", amount: 50 }]);
    expect(b.total).toBe(50);
    const sum = b.net.reduce((s, n) => s + n.balance, 0);
    expect(sum).toBeCloseTo(-50, 2);
  });

  it("copes with an empty group rather than dividing by zero", () => {
    const b = computeBalances([], [{ by: "you", amount: 10 }]);
    expect(Number.isFinite(b.share)).toBe(true);
    expect(b.transfers).toEqual([]);
  });

  it("rounds to whole cents", () => {
    const b = computeBalances(ids, [{ by: "you", amount: 10 }]);
    expect(b.share).toBe(3.33);
    for (const tr of b.transfers) expect(tr.amount).toBe(Math.round(tr.amount * 100) / 100);
  });
});

describe("persistence", () => {
  beforeEach(() => {
    const map = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
      clear: () => map.clear(),
    });
  });

  it("reads back what it saved", () => {
    const r = route();
    saveCollab(r, { members: ["you", "vlad"], pending: [], votes: {}, suggestions: [], expenses: [], feed: [] });
    expect(loadCollab(r).members).toEqual(["you", "vlad"]);
  });

  it("keeps each trip's group to itself", () => {
    saveCollab({ id: "a" }, { members: ["you", "ana"] });
    expect(loadCollab({ id: "b" }).members).toEqual(["you"]);
  });

  it("falls back to a fresh group when the stored state is corrupt", () => {
    localStorage.setItem("vai_collab2_r1", "{not json");
    expect(loadCollab(route()).members).toEqual(["you"]);
  });

  it("proposes an idea that is stable for a given trip", () => {
    expect(ideaFor(route())).toEqual(ideaFor(route()));
    expect(ideaFor(route()).key).toMatch(/^idea/);
  });
});
