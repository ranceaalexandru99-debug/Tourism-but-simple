// Moved to src/shared/persist.js, which the native app now shares byte-for-
// byte. Trips were being saved there with a bare try/catch — the exact silent
// loss this module was written to stop, which had never crossed over.
//
// Re-exported from here because this is where every caller and its tests have
// always imported it from.
export { persist, persistCache } from "./shared/persist.js";
