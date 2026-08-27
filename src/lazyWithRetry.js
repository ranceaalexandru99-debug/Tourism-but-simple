// React.lazy that survives a failed chunk download.
//
// The failure this exists for is not exotic, it is what happens after every
// deploy: a visitor holding the previous index.html asks for
// `Route-DIhTEKH3.js`, the new build named it something else, and the request
// 404s. React.lazy rejects, Suspense does not catch errors, and the rejection
// reaches the error boundary — so opening a saved trip shows "Something went
// wrong" for what is really just "you have yesterday's page open". Mobile
// networks produce the same failure without any deploy at all.
//
// Two remedies, in order of how disruptive they are:
//   1. Retry once. A dropped request on a train succeeds a second later.
//   2. Reload the page. If the chunk is genuinely gone, only a fresh
//      index.html can name the file that replaced it.
//
// The reload is capped at once per tab per session: if a reload cannot fix it —
// the file really is missing from the server — looping forever would be worse
// than showing the error.

import { lazy } from "react";

const RELOADED_KEY = "vai_chunk_reloaded";

function alreadyReloaded() {
  try { return sessionStorage.getItem(RELOADED_KEY) === "1"; } catch { return false; }
}
function markReloaded() {
  try { sessionStorage.setItem(RELOADED_KEY, "1"); } catch {}
}

// Clear the guard once the app is running normally, so a later deploy in the
// same long-lived tab can still trigger its own single reload.
export function clearChunkReloadGuard() {
  try { sessionStorage.removeItem(RELOADED_KEY); } catch {}
}

export default function lazyWithRetry(factory) {
  return lazy(() =>
    factory().catch(async (err) => {
      try {
        return await factory();
      } catch {
        if (!alreadyReloaded()) {
          markReloaded();
          window.location.reload();
          // Keep the promise pending: resolving or rejecting here would flash
          // the error screen in the instant before the reload takes effect.
          return new Promise(() => {});
        }
        throw err;
      }
    }),
  );
}
