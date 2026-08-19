// On-device account store — real credential validation + persistence, but
// client-side only (no server). Accounts live in this browser's localStorage.
// Passwords are salted and SHA-256 hashed via SubtleCrypto so the plaintext is
// never stored. NOTE: anyone with access to the device can read localStorage,
// so this is prototype-grade auth, not a security boundary. Swap for a real
// provider (Firebase / Supabase / Auth0) + backend before a commercial launch.

const USERS_KEY = "vai_users";
const SESSION_KEY = "vai_session";

const loadUsers = () => { try { return JSON.parse(localStorage.getItem(USERS_KEY)) || {}; } catch { return {}; } };
const saveUsers = (u) => { try { localStorage.setItem(USERS_KEY, JSON.stringify(u)); } catch {} };
const normEmail = (e) => (e || "").trim().toLowerCase();

export function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail(e));
}

function randomSalt() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password, salt) {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const publicUser = (u) => ({ name: u.name, email: u.email, guest: false, method: "email" });

export function setSession(email) { try { localStorage.setItem(SESSION_KEY, normEmail(email)); } catch {} }
export function clearSession() { try { localStorage.removeItem(SESSION_KEY); } catch {} }

// Restore the signed-in user from a previous session, or null.
export function currentUser() {
  try {
    const email = localStorage.getItem(SESSION_KEY);
    if (!email) return null;
    const u = loadUsers()[email];
    return u ? publicUser(u) : null;
  } catch { return null; }
}

// Create a new account. Throws Error with code: "email" | "password" | "exists".
export async function signUp({ email, password, name }) {
  email = normEmail(email);
  if (!isValidEmail(email)) throw new Error("email");
  if ((password || "").length < 6) throw new Error("password");
  const users = loadUsers();
  if (users[email]) throw new Error("exists");
  const salt = randomSalt();
  const hash = await hashPassword(password, salt);
  users[email] = {
    email, name: (name || "").trim() || email.split("@")[0],
    salt, hash, createdAt: Date.now(),
  };
  saveUsers(users);
  setSession(email);
  return publicUser(users[email]);
}

// Validate credentials. Throws Error with code: "nouser" | "wrongpass".
export async function signIn({ email, password }) {
  email = normEmail(email);
  const u = loadUsers()[email];
  if (!u) throw new Error("nouser");
  const hash = await hashPassword(password, u.salt);
  if (hash !== u.hash) throw new Error("wrongpass");
  setSession(email);
  return publicUser(u);
}

// Remove the account itself (email, name, password hash) and end the session.
// Saved trips and gallery photos are deliberately left alone — they belong to
// the device, not the account, and the Me screen offers a separate "erase
// everything" action. Both app stores require an in-app way to delete an
// account, and this is it.
export function deleteAccount(email) {
  const target = normEmail(email || "");
  if (!target) return false;
  const users = loadUsers();
  if (!users[target]) { clearSession(); return false; }
  delete users[target];
  saveUsers(users);
  clearSession();
  return true;
}
