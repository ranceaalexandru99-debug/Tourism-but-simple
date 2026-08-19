// On-device account store for the native app. Mirrors the web src/auth.js but
// uses expo-crypto (React Native has no crypto.subtle). Accounts live in the
// localStorage polyfill (backed by AsyncStorage). Prototype-grade — swap for a
// real provider + backend before a commercial launch.

import * as Crypto from "expo-crypto";

const USERS_KEY = "vai_users";
const SESSION_KEY = "vai_session";

const loadUsers = () => { try { return JSON.parse(localStorage.getItem(USERS_KEY)) || {}; } catch { return {}; } };
const saveUsers = (u) => { try { localStorage.setItem(USERS_KEY, JSON.stringify(u)); } catch {} };
const normEmail = (e) => (e || "").trim().toLowerCase();

export function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail(e));
}

async function hashPassword(password, salt) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${password}`);
}

const publicUser = (u) => ({ name: u.name, email: u.email, guest: false, method: "email" });

export function setSession(email) { try { localStorage.setItem(SESSION_KEY, normEmail(email)); } catch {} }
export function clearSession() { try { localStorage.removeItem(SESSION_KEY); } catch {} }

export function currentUser() {
  try {
    const email = localStorage.getItem(SESSION_KEY);
    if (!email) return null;
    const u = loadUsers()[email];
    return u ? publicUser(u) : null;
  } catch { return null; }
}

export async function signUp({ email, password, name }) {
  email = normEmail(email);
  if (!isValidEmail(email)) throw new Error("email");
  if ((password || "").length < 6) throw new Error("password");
  const users = loadUsers();
  if (users[email]) throw new Error("exists");
  const salt = Crypto.randomUUID();
  const hash = await hashPassword(password, salt);
  users[email] = { email, name: (name || "").trim() || email.split("@")[0], salt, hash, createdAt: Date.now() };
  saveUsers(users);
  setSession(email);
  return publicUser(users[email]);
}

export async function signIn({ email, password }) {
  email = normEmail(email);
  const u = loadUsers()[email];
  if (!u) throw new Error("nouser");
  const hash = await hashPassword(password, u.salt);
  if (hash !== u.hash) throw new Error("wrongpass");
  setSession(email);
  return publicUser(u);
}
