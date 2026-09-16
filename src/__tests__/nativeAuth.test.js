import { describe, it, expect, vi, beforeEach } from "vitest";

// The native app's account store. It is on-device and prototype-grade — the
// module says so itself — but it still decides who gets in, and every one of
// these behaviours would fail silently if it broke: a wrong password accepted,
// a password stored where it can be read, a session surviving a sign-out.
//
// expo-crypto has no web build; vite.config.js aliases it to a stub backed by
// Node's own crypto, so the hashing here is real. What these check is the
// logic around it.

// The app runs on a localStorage polyfill backed by AsyncStorage.
function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
    get _map() { return map; },
  };
}

let auth;
beforeEach(async () => {
  vi.stubGlobal("localStorage", memoryStorage());
  vi.resetModules();
  auth = await import("../../mobile-native/src/lib/auth.js");
});

describe("isValidEmail", () => {
  it("accepts ordinary addresses", () => {
    for (const e of ["a@b.co", "Alex.R@example.com", " user@site.ro "]) {
      expect(auth.isValidEmail(e)).toBe(true);
    }
  });

  it("rejects what is not an address", () => {
    for (const e of ["", "abc", "a@b", "a b@c.com", "@b.co", "a@.co", null]) {
      expect(auth.isValidEmail(e)).toBe(false);
    }
  });
});

describe("signUp", () => {
  it("creates an account and signs it in", async () => {
    const u = await auth.signUp({ email: "Alex@Example.com ", password: "hunter22", name: "Alex" });
    expect(u).toMatchObject({ name: "Alex", email: "alex@example.com", guest: false });
    expect(auth.currentUser()).toMatchObject({ email: "alex@example.com" });
  });

  it("derives a name from the address when none is given", async () => {
    const u = await auth.signUp({ email: "maria@example.com", password: "hunter22", name: "  " });
    expect(u.name).toBe("maria");
  });

  it("refuses an invalid address and a short password", async () => {
    await expect(auth.signUp({ email: "nope", password: "hunter22" })).rejects.toThrow("email");
    await expect(auth.signUp({ email: "a@b.co", password: "12345" })).rejects.toThrow("password");
  });

  it("refuses to overwrite an existing account", async () => {
    await auth.signUp({ email: "a@b.co", password: "hunter22" });
    await expect(auth.signUp({ email: "A@B.CO", password: "different" })).rejects.toThrow("exists");
  });

  it("never stores the password itself", async () => {
    await auth.signUp({ email: "a@b.co", password: "correct-horse" });
    const dump = JSON.stringify([...localStorage._map.entries()]);
    expect(dump).not.toContain("correct-horse");
    expect(dump).toContain("hash");
    expect(dump).toContain("salt");
  });

  it("salts per account, so identical passwords do not hash alike", async () => {
    await auth.signUp({ email: "a@b.co", password: "same-password" });
    await auth.signUp({ email: "c@d.co", password: "same-password" });
    const users = JSON.parse(localStorage.getItem("vai_users"));
    expect(users["a@b.co"].salt).not.toBe(users["c@d.co"].salt);
    expect(users["a@b.co"].hash).not.toBe(users["c@d.co"].hash);
  });
});

describe("signIn", () => {
  beforeEach(async () => {
    await auth.signUp({ email: "a@b.co", password: "hunter22", name: "Alex" });
    auth.clearSession();
  });

  it("accepts the right password", async () => {
    const u = await auth.signIn({ email: " A@B.co ", password: "hunter22" });
    expect(u.email).toBe("a@b.co");
    expect(auth.currentUser()).not.toBeNull();
  });

  it("rejects the wrong password, and leaves no session behind", async () => {
    await expect(auth.signIn({ email: "a@b.co", password: "hunter23" })).rejects.toThrow("wrongpass");
    expect(auth.currentUser()).toBeNull();
  });

  it("rejects an unknown account", async () => {
    await expect(auth.signIn({ email: "nobody@b.co", password: "hunter22" })).rejects.toThrow("nouser");
  });
});

describe("sessions", () => {
  it("clearSession signs the user out", async () => {
    await auth.signUp({ email: "a@b.co", password: "hunter22" });
    expect(auth.currentUser()).not.toBeNull();
    auth.clearSession();
    expect(auth.currentUser()).toBeNull();
  });

  it("a session pointing at a deleted account resolves to nobody", async () => {
    await auth.signUp({ email: "a@b.co", password: "hunter22" });
    localStorage.removeItem("vai_users");
    expect(auth.currentUser()).toBeNull();
  });

  it("survives storage being unavailable instead of throwing", async () => {
    await auth.signUp({ email: "a@b.co", password: "hunter22" });
    vi.stubGlobal("localStorage", {
      getItem() { throw new Error("private mode"); },
      setItem() { throw new Error("private mode"); },
      removeItem() { throw new Error("private mode"); },
    });
    expect(() => auth.currentUser()).not.toThrow();
    expect(auth.currentUser()).toBeNull();
  });
});
