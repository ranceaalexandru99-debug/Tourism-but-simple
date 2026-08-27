// Supabase browser client.
//
// Both values are safe to ship in the bundle: the URL is public and the
// publishable (anon) key only grants what Row Level Security allows. The
// service_role key is the dangerous one — it must never appear here, only on
// the server (see server/index.js).
//
// The app must keep working without Supabase configured — guest mode, saved
// trips and the whole planner are local-first. So a missing config is not a
// crash: `supabase` is null and auth.js reports a clear error only when someone
// actually tries to sign in.

import { createClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL;
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// We pin the storage key instead of letting Supabase derive `sb-<ref>-auth-token`.
// auth.js reads this entry synchronously on boot to answer currentUser() before
// any async call can resolve — depending on a name we chose is far safer than
// depending on one Supabase generates internally and could change.
export const AUTH_STORAGE_KEY = "vai_sb_auth";

export const hasSupabase = Boolean(URL && PUBLISHABLE_KEY);

// supabase-js calls fetch with no timeout, so a slow or unreachable database
// leaves every caller awaiting forever: the search returns nothing and looks
// broken, the Home rails never fill, route generation hangs behind the loading
// screen, sign-in spins. A free-tier project waking from idle is exactly when
// this happens, which is the worst possible moment for it.
//
// Failing after 15s is far better than not failing: every caller already treats
// a rejected query as "no data" and degrades to a cached or empty result, so the
// timeout turns an invisible hang into the fallback path that was designed for.
// PER ATTEMPT, not per call. supabase-js retries a failed request four times
// with exponential backoff — measured: attempts at 0s, 3s, 7s and 13s — so the
// wall-clock a caller waits is roughly 7s + 4× this value. A first guess of 15s
// would therefore have taken about ninety seconds to surface a failure, which is
// barely better than the hang it was meant to fix.
//
// 5s is generous for a real query (an indexed Supabase select answers in well
// under a second; a cold start in two or three) while keeping the worst case
// near 27s. The retries are worth keeping: most failures here are transient.
const TIMEOUT_MS = 5000;

// AbortSignal.timeout and .any are recent (Safari 17.4, Firefox 124). If either
// is missing we must fall through to a plain fetch: a timeout that throws on
// every request would be far worse than no timeout at all.
const canTimeout = typeof AbortSignal !== "undefined"
  && typeof AbortSignal.timeout === "function";

const fetchWithTimeout = (input, init = {}) => {
  if (!canTimeout) return fetch(input, init);
  const ours = AbortSignal.timeout(TIMEOUT_MS);
  // Respect a caller's own signal — supabase-js passes one to abort in-flight
  // requests — by racing it against ours instead of replacing it.
  const signal = init.signal && typeof AbortSignal.any === "function"
    ? AbortSignal.any([init.signal, ours])
    : (init.signal || ours);
  return fetch(input, { ...init, signal });
};

export const supabase = hasSupabase
  ? createClient(URL, PUBLISHABLE_KEY, {
      global: { fetch: fetchWithTimeout },
      auth: {
        storageKey: AUTH_STORAGE_KEY,
        persistSession: true,
        autoRefreshToken: true,
        // The app has no OAuth redirect flow; parsing the URL fragment would
        // also collide with the `#tripz=` shared-trip links the app uses.
        detectSessionInUrl: false,
      },
    })
  : null;

if (!hasSupabase && import.meta.env.DEV) {
  console.warn(
    "[auth] VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY are not set — " +
    "sign-in is disabled; the app still runs in guest mode.",
  );
}
