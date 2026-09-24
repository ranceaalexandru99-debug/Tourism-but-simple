// Camera, or a photo already on the phone?
//
// Until now every photo had to be taken inside the app, which is the wrong way
// round for a travel app: people photograph a place with whatever camera app
// they already have open, and remember the trip gallery afterwards. The plumbing
// for picking existed and had never been offered.
//
// An OS alert rather than a sheet of our own: it is two choices and a cancel,
// it needs no layout, and it is what every other app on the phone does — the
// back gesture already dismisses it, which a hand-rolled sheet has to remember
// to handle.
//
// `ask` is injected so this can be tested without a renderer. It defaults to
// React Native's Alert.

import { Alert } from "react-native";

/**
 * @param t    the i18n function
 * @param ask  (title, buttons, onDismiss) → void, defaulting to Alert.alert
 * @returns Promise<"camera" | "library" | null>  null when dismissed
 */
export function choosePhotoSource(t, ask) {
  const show = ask || ((title, buttons, onDismiss) =>
    Alert.alert(title, undefined, buttons, { cancelable: true, onDismiss }));
  return new Promise((resolve) => {
    // Resolve exactly once. A dismissed alert fires onDismiss, and on some
    // platforms a button press can arrive alongside it; resolving twice would
    // leave the second caller waiting forever on a promise already settled.
    let done = false;
    const settle = (value) => { if (!done) { done = true; resolve(value); } };

    show(t("galAddPhoto"), [
      { text: t("galFromCamera"), onPress: () => settle("camera") },
      { text: t("galFromLibrary"), onPress: () => settle("library") },
      { text: t("cancel"), style: "cancel", onPress: () => settle(null) },
    ], () => settle(null));
  });
}
