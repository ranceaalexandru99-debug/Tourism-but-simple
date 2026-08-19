// localStorage shim for React Native.
//
// The web app's logic modules (theme, i18n, photos, mockCollab, aiEngine cache)
// call `localStorage.getItem/setItem` synchronously. RN has no localStorage, so
// we install an in-memory Map that mirrors to AsyncStorage (async, fire-and-
// forget) for persistence across restarts. `hydrate()` preloads the memory map
// from AsyncStorage on boot — await it before rendering so persisted theme/lang/
// trips are visible on first paint.

import AsyncStorage from "@react-native-async-storage/async-storage";

const mem = new Map();

if (typeof global.localStorage === "undefined") {
  global.localStorage = {
    getItem(key) {
      return mem.has(key) ? mem.get(key) : null;
    },
    setItem(key, value) {
      const v = String(value);
      mem.set(key, v);
      AsyncStorage.setItem(key, v).catch(() => {});
    },
    removeItem(key) {
      mem.delete(key);
      AsyncStorage.removeItem(key).catch(() => {});
    },
    clear() {
      mem.clear();
      AsyncStorage.clear().catch(() => {});
    },
  };
}

// Preload persisted keys into the synchronous memory map.
export async function hydrate() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    if (keys.length) {
      const pairs = await AsyncStorage.multiGet(keys);
      for (const [k, v] of pairs) if (v != null) mem.set(k, v);
    }
  } catch {
    // First run or storage unavailable — start with an empty map.
  }
}
