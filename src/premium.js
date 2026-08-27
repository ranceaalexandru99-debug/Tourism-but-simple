// Whether this device is entitled to the paid features.
//
// Deliberately NOT a purchase flow. There is no billing integration yet, and a
// "Buy" button that does not charge anything would be a lie told to the user —
// worse, one that Play Store review treats as a broken purchase. When real
// billing arrives (Play Billing / StoreKit, or RevenueCat over both), the ONLY
// thing that changes is where `entitled` gets its value: the store receipt
// becomes the source of truth and everything below stays as it is.
//
// Until then the entitlement can be switched on for testing, explicitly and
// visibly — see unlockForTesting(). It is never granted silently.

const KEY = "vai_premium";

// Read once at module load so callers can ask synchronously during render.
let entitled = (() => {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
})();

// `?premium=1` in the URL turns it on for this device, `?premium=0` off. This
// exists so the feature can be exercised on a real phone before billing is
// wired — it is a testing switch, not a way to obtain the product, and it
// leaves an obvious trace in the address bar rather than pretending anything
// was bought.
try {
  const q = new URLSearchParams(window.location.search).get("premium");
  if (q === "1" || q === "0") {
    entitled = q === "1";
    localStorage.setItem(KEY, entitled ? "1" : "0");
  }
} catch { /* no URL / no storage — leave the stored value alone */ }

const listeners = new Set();

export function isPremium() {
  return entitled;
}

export function unlockForTesting(on = true) {
  entitled = !!on;
  try { localStorage.setItem(KEY, entitled ? "1" : "0"); } catch {}
  listeners.forEach((fn) => { try { fn(entitled); } catch {} });
}

// Subscribe to changes; returns an unsubscribe function.
export function onPremiumChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
