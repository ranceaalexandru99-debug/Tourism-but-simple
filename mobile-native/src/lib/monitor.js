// Production-error visibility for the native app, mirroring the web's
// src/monitor.js approach:
//
//   - a global handler catches uncaught JS exceptions (fatal + non-fatal)
//     and unhandled promise rejections;
//   - every error is kept in a small AsyncStorage ring buffer so it can be
//     inspected on-device after the fact (no account needed);
//   - optionally POSTs to ERROR_ENDPOINT when one is configured;
//   - a single seam (`setErrorReporter`) lets Sentry plug in later with one
//     line — see mobile-native/SENTRY.md.
//
// No third-party dependency. Safe in Expo Go and in production builds.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// Remote sink (optional). Leave "" to keep everything on-device. When the
// error-proxy Worker exists, point this at its /errors route.
const ERROR_ENDPOINT = "";

const BUFFER_KEY = "vai_errors";
const BUFFER_MAX = 20;
const MAX_REMOTE_REPORTS = 10; // per session — an error loop can't spam
let sent = 0;

// Sentry (or any collector) hooks in here; null = local-only.
let externalReporter = null;
export function setErrorReporter(fn) { externalReporter = fn; }

async function bufferPush(entry) {
  try {
    const raw = await AsyncStorage.getItem(BUFFER_KEY);
    const list = raw ? JSON.parse(raw) : [];
    list.push(entry);
    await AsyncStorage.setItem(BUFFER_KEY, JSON.stringify(list.slice(-BUFFER_MAX)));
  } catch { /* storage full/unavailable — reporting must never throw */ }
}

export function report(kind, message, stack, extra) {
  const entry = {
    kind,
    message: String(message || "").slice(0, 500),
    stack: String(stack || "").slice(0, 2000),
    platform: `${Platform.OS} ${Platform.Version}`,
    ts: new Date().toISOString(),
    ...(extra || {}),
  };
  bufferPush(entry);
  try { externalReporter && externalReporter(entry); } catch {}
  if (!ERROR_ENDPOINT || sent >= MAX_REMOTE_REPORTS) return;
  sent++;
  try {
    fetch(ERROR_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    }).catch(() => {});
  } catch { /* never let reporting itself throw */ }
}

// Read / clear the on-device buffer (for a debug view or adb inspection).
export async function getBufferedErrors() {
  try { const raw = await AsyncStorage.getItem(BUFFER_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
export async function clearBufferedErrors() {
  try { await AsyncStorage.removeItem(BUFFER_KEY); } catch {}
}

// Install the global hooks once at boot.
export function installMonitor() {
  // Uncaught JS exceptions. Chain the previous handler so RN's default
  // behaviour (dev RedBox, production crash-and-restart) is preserved —
  // we observe, we don't swallow.
  if (global.ErrorUtils) {
    const prev = global.ErrorUtils.getGlobalHandler?.();
    global.ErrorUtils.setGlobalHandler((error, isFatal) => {
      report(isFatal ? "fatal" : "error", error?.message || String(error), error?.stack);
      if (prev) prev(error, isFatal);
    });
  }
  // Unhandled promise rejections — Hermes has a built-in tracker; the JSC
  // path uses the promise polyfill's tracking module. Both guarded: this
  // must never break boot.
  try {
    if (global.HermesInternal?.enablePromiseRejectionTracker) {
      global.HermesInternal.enablePromiseRejectionTracker({
        allRejections: true,
        onUnhandled: (_id, error) => report("rejection", error?.message || String(error), error?.stack),
        onHandled: () => {},
      });
    } else {
      const tracking = require("promise/setimmediate/rejection-tracking");
      tracking.enable({
        allRejections: true,
        onUnhandled: (_id, error) => report("rejection", error?.message || String(error), error?.stack),
      });
    }
  } catch { /* tracker unavailable — exceptions still covered above */ }
}
