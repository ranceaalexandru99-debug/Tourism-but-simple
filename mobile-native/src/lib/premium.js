// Whether this device is entitled to the paid features.
//
// The entitlement comes from RevenueCat, which sits on top of Google Play
// Billing and validates the purchase receipt server-side. That validation is
// the reason for using it: without it, "has this person paid?" is a question
// the phone answers to itself, and the answer is trivially forged.
//
// Everything else in the app asks isPremium() and nothing else. That call has
// to be SYNCHRONOUS because it decides what a screen renders, while the store
// answers asynchronously — so the last known answer is cached here and the
// network result updates it, notifying listeners.
//
// Without an API key configured the app still runs: nothing is entitled, the
// paid buttons stay locked, and no error is shown. A missing key is a
// configuration state, not a failure.

import { useState, useEffect } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";

// Loaded lazily, and never at module scope.
//
// react-native-purchases is a third-party native module, so it does not exist
// in Expo Go. A top-level import therefore made the whole app fail to start
// there — premium.js is imported by App, Gallery and Route — which meant the
// only way to try ANYTHING on a phone was a full EAS development build.
//
// Requiring it inside a try lets Expo Go run everything except billing, which
// simply reports itself unavailable.
let Purchases = null;
let purchasesTried = false;
function loadPurchases() {
  if (purchasesTried) return Purchases;
  purchasesTried = true;
  try {
    // eslint-disable-next-line global-require
    Purchases = require("react-native-purchases").default;
  } catch {
    Purchases = null;
  }
  return Purchases;
}

// True only where the SDK is actually present — a development build or a store
// build, never Expo Go.
export const billingAvailable = () => !!loadPurchases();

const KEY = "vai_premium";
// The identifier configured in RevenueCat for the paid tier. One entitlement,
// however many products end up pointing at it.
export const ENTITLEMENT = "premium";

const apiKey = Platform.select({
  android: Constants.expoConfig?.extra?.revenueCatAndroidKey,
  ios: Constants.expoConfig?.extra?.revenueCatIosKey,
}) || null;

export const billingConfigured = Boolean(apiKey) && billingAvailable();

// Last known answer, read synchronously on boot from the AsyncStorage-backed
// shim so someone who has already paid is not locked out for the second it takes the
// store to reply.
let entitled = (() => {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
})();

const listeners = new Set();

function setEntitled(value) {
  const next = !!value;
  if (next === entitled) return;
  entitled = next;
  try { localStorage.setItem(KEY, next ? "1" : "0"); } catch {}
  listeners.forEach((fn) => { try { fn(next); } catch {} });
}

const readInfo = (info) => !!info?.entitlements?.active?.[ENTITLEMENT];

let ready = null;

// Configure once, at startup. Safe to call repeatedly.
export function initPremium() {
  if (ready) return ready;
  if (!billingConfigured) { ready = Promise.resolve(false); return ready; }

  ready = (async () => {
    try {
      const P = loadPurchases();
      if (!P) return false;
      await P.configure({ apiKey });
      // Keep the cached answer in step with renewals, cancellations and
      // refunds, which arrive without the user touching anything.
      P.addCustomerInfoUpdateListener((info) => setEntitled(readInfo(info)));
      setEntitled(readInfo(await P.getCustomerInfo()));
      return true;
    } catch {
      // Offline, or the store is unavailable. The cached answer stands: a
      // buyer must not lose access because a flight has no signal.
      return false;
    }
  })();
  return ready;
}

export function isPremium() {
  return entitled;
}

export function onPremiumChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// The offering, with prices as the store reports them. Never
// hard-code a price: it varies by country and currency, and both stores require
// the real localised one to be shown.
export async function getOffering() {
  if (!billingConfigured) return null;
  await initPremium();
  try {
    const offerings = await loadPurchases().getOfferings();
    return offerings?.current || null;
  } catch {
    return null;
  }
}

/**
 * Buy a package. Resolves to true when the entitlement is active afterwards.
 *
 * A cancellation arrives as a THROW carrying `userCancelled`, not as a false —
 * the SDK's own shape, left as it is so the caller can tell "changed my mind"
 * from "the payment failed" and say different things. Paywall.js does.
 */
export async function purchase(pkg) {
  if (!billingConfigured) throw new Error("notconfigured");
  const { customerInfo } = await loadPurchases().purchasePackage(pkg);
  const ok = readInfo(customerInfo);
  setEntitled(ok);
  return ok;
}

// Both stores require this: a buyer reinstalling, or on a second device,
// must be able to get their access back without paying twice.
export async function restore() {
  if (!billingConfigured) throw new Error("notconfigured");
  const info = await loadPurchases().restorePurchases();
  const ok = readInfo(info);
  setEntitled(ok);
  return ok;
}

// Test switch, for exercising the paid screens before billing exists. Never
// called from a purchase flow — it grants nothing to a real user.
//
// The row that calls it is behind __DEV__, so it is stripped from a release
// bundle; the function itself is an export, so Metro keeps it. A no-op outside
// development means the bundle carries no purpose-built lever for granting the
// entitlement, rather than one that happens to have nothing calling it.
export function unlockForTesting(on = true) {
  // `typeof` rather than a bare read: __DEV__ is defined by Metro and exists
  // nowhere else, so touching it directly throws a ReferenceError under vitest.
  // Absent means "not a React Native bundle at all" — a test — where the switch
  // is the thing being tested. A release bundle defines it as false.
  if (typeof __DEV__ !== "undefined" && !__DEV__) return;
  setEntitled(on);
}

// Re-renders a component when the entitlement changes — after a purchase, a
// restore, or a renewal arriving in the background. Without it a screen keeps
// showing the lock until something else happens to re-render it, which looks
// exactly like a purchase that did not work.
export function usePremium() {
  const [value, setValue] = useState(entitled);
  useEffect(() => onPremiumChange(setValue), []);
  return value;
}
