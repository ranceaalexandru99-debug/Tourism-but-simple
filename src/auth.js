// Account handling, backed by Supabase Auth.
//
// The exported surface is unchanged from the old localStorage implementation
// (signUp, signIn, currentUser, deleteAccount, setSession, clearSession,
// isValidEmail) so App.jsx and Auth.jsx need no edits — but what happens behind
// it is now real: passwords are verified by Supabase, never stored on device,
// and a session is a signed JWT rather than an email string in localStorage.
//
// Two constraints shaped this file:
//
// 1. `currentUser()` must stay SYNCHRONOUS. App.jsx calls it inside a
//    `useRef(...)` during the first render to decide whether to skip
//    onboarding; making it async would mean restructuring the app. Supabase's
//    getSession() is async, so we keep a module-level cache, hydrate it
//    synchronously from the persisted session on load, and let
//    onAuthStateChange keep it current.
//
// 2. Supabase deliberately does NOT distinguish "no such account" from "wrong
//    password" — both come back as invalid_credentials, to stop attackers
//    enumerating which emails are registered. The old local code could tell
//    them apart. See mapSignInError() for how that maps onto the existing
//    error codes and what the user now sees.

import { supabase, hasSupabase, AUTH_STORAGE_KEY } from "./lib/supabaseClient.js";

const normEmail = (e) => (e || "").trim().toLowerCase();

export function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail(e));
}

// The shape the rest of the app expects. The display name lives in Supabase's
// user_metadata (set at sign-up); we fall back to the email's local part so a
// user created elsewhere still shows something sensible.
function publicUser(u) {
  if (!u) return null;
  const name = u.user_metadata?.name || u.user_metadata?.full_name || (u.email || "").split("@")[0] || null;
  return { name, email: u.email, guest: false, method: "email" };
}

// ---- synchronous session cache ---------------------------------------------

// Read the session Supabase persisted under our own storage key. This is the
// only way to answer currentUser() during the first render; everything after
// boot comes from onAuthStateChange.
function readPersistedUser() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    const u = s?.user || s?.currentSession?.user;
    if (!u) return null;
    // An expired token would be refreshed asynchronously; treating it as signed
    // out for one render is better than flashing a stale identity that then
    // fails on the next authenticated call.
    const expiresAt = s?.expires_at ?? s?.currentSession?.expires_at;
    if (expiresAt && Number(expiresAt) * 1000 < Date.now()) return null;
    return publicUser(u);
  } catch {
    return null;
  }
}

let _user = hasSupabase ? readPersistedUser() : null;

if (supabase) {
  // Fires INITIAL_SESSION on load and then on every sign-in/out/refresh, which
  // keeps the synchronous cache honest for the rest of the session.
  supabase.auth.onAuthStateChange((_event, session) => {
    _user = publicUser(session?.user) || null;
  });
}

// Restore the signed-in user from a previous session, or null. Synchronous by
// design — see the note at the top of the file.
export function currentUser() {
  return _user;
}

// ---- session helpers --------------------------------------------------------

// Kept for API compatibility. Supabase owns the session now: it is established
// by signUp/signIn and persisted by the client, so there is nothing to set by
// hand. Callers that used this to "log someone in" should call signIn instead.
export function setSession() {
  _user = readPersistedUser();
}

// Sign out. Fire-and-forget: the local cache clears immediately so the UI can
// navigate away, while the network round-trip that revokes the refresh token
// completes in the background.
export function clearSession() {
  _user = null;
  if (supabase) supabase.auth.signOut().catch(() => {});
}

// ---- error mapping ----------------------------------------------------------

const NOT_CONFIGURED = () => new Error("notconfigured");

function mapSignUpError(error, data) {
  const code = error?.code || "";
  const msg = (error?.message || "").toLowerCase();

  if (code === "user_already_exists" || msg.includes("already registered")) return new Error("exists");
  if (code === "weak_password" || msg.includes("password should be")) return new Error("password");
  if (code === "email_address_invalid" || code === "validation_failed" || msg.includes("email")) return new Error("email");
  if (code === "over_email_send_rate_limit" || msg.includes("rate limit")) return new Error("ratelimit");

  // With email confirmation enabled, Supabase does not error on a duplicate
  // address — it returns a decoy user with an empty `identities` array so an
  // attacker can't tell registered emails apart. That decoy is what "exists"
  // looks like on this path.
  if (!error && data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return new Error("exists");
  }
  return null;
}

function mapSignInError(error) {
  const code = error?.code || "";
  const msg = (error?.message || "").toLowerCase();

  if (code === "email_not_confirmed" || msg.includes("email not confirmed")) return new Error("confirm");
  if (code === "over_request_rate_limit" || msg.includes("rate limit")) return new Error("ratelimit");
  // invalid_credentials covers BOTH "no such user" and "wrong password".
  // Supabase merges them on purpose (account enumeration defence), so the old
  // "nouser" code can no longer be produced on this path and every failure
  // surfaces as "wrongpass". The "create an account?" prompt the UI used to
  // show for "nouser" therefore no longer appears after a failed sign-in.
  if (code === "invalid_credentials" || msg.includes("invalid login credentials")) return new Error("wrongpass");
  return null;
}

// ---- public API -------------------------------------------------------------

// Create a new account. Throws Error whose `message` is one of:
// "email" | "password" | "exists" | "confirm" | "ratelimit" | "notconfigured".
export async function signUp({ email, password, name }) {
  email = normEmail(email);
  // Check locally first so obvious mistakes never cost a network round-trip and
  // the messages stay identical to the old implementation.
  if (!isValidEmail(email)) throw new Error("email");
  if ((password || "").length < 6) throw new Error("password");
  if (!supabase) throw NOT_CONFIGURED();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name: (name || "").trim() || null } },
  });

  const mapped = mapSignUpError(error, data);
  if (mapped) throw mapped;
  if (error) throw new Error("generic");

  // No session means the project requires email confirmation: the account
  // exists but cannot be used yet. Reporting success here would leave the app
  // showing a signed-in user whose every authenticated call fails.
  if (!data.session) throw new Error("confirm");

  _user = publicUser(data.user);
  return _user;
}

// Validate credentials. Throws Error whose `message` is one of:
// "wrongpass" | "confirm" | "ratelimit" | "notconfigured".
export async function signIn({ email, password }) {
  email = normEmail(email);
  if (!supabase) throw NOT_CONFIGURED();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  const mapped = mapSignInError(error);
  if (mapped) throw mapped;
  if (error) throw new Error("generic");

  _user = publicUser(data.user);
  return _user;
}

// Permanently delete the signed-in account.
//
// This CANNOT be done from the browser. Deleting a user requires Supabase's
// admin API (`auth.admin.deleteUser`), which only accepts the service_role key
// — a key that bypasses Row Level Security entirely and would give anyone who
// read the bundle full access to the database. It therefore lives only on the
// server: see POST /api/delete-account in server/index.js, which verifies the
// caller's own JWT and deletes exactly that user, never an id sent by the
// client.
//
// Async and never throws (returns a boolean), so the existing fire-and-forget
// call site in App.jsx keeps working unchanged. The local session is cleared
// either way — a user who asked to delete their account should not stay signed
// in because the server was briefly unreachable.
export async function deleteAccount() {
  let ok = false;
  try {
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (token) {
        const base = import.meta.env.VITE_API_BASE || "";
        const res = await fetch(`${base}/api/delete-account`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        ok = res.ok;
        if (!ok) console.warn("[auth] account deletion failed:", res.status);
      }
    }
  } catch (e) {
    console.warn("[auth] account deletion failed:", e);
  } finally {
    clearSession();
  }
  return ok;
}
