import { describe, it, expect, vi, beforeEach } from "vitest";
import * as picker from "expo-image-picker";
import { choosePhotoSource } from "../../mobile-native/src/lib/photoSource.js";
import { pickPhoto } from "../../mobile-native/src/lib/gallery.js";

// Every photo used to have to be taken inside the app. That is the wrong way
// round for a travel app: people photograph a place with whatever camera app is
// already open and remember the trip gallery afterwards.

const t = (k) => k;

// Stand-in for Alert.alert: records the buttons and lets a test press one.
function fakeAlert() {
  const state = { title: null, buttons: [], dismiss: null };
  const ask = (title, buttons, onDismiss) => {
    state.title = title;
    state.buttons = buttons;
    state.dismiss = onDismiss;
  };
  const press = (text) => state.buttons.find((b) => b.text === text)?.onPress?.();
  return { ask, press, state };
}

describe("choosePhotoSource", () => {
  it("offers the camera, the gallery, and a way out", async () => {
    const a = fakeAlert();
    choosePhotoSource(t, a.ask);
    expect(a.state.title).toBe("galAddPhoto");
    expect(a.state.buttons.map((b) => b.text)).toEqual(["galFromCamera", "galFromLibrary", "cancel"]);
    expect(a.state.buttons[2].style).toBe("cancel");
  });

  it("resolves with what was chosen", async () => {
    for (const [button, expected] of [["galFromCamera", "camera"], ["galFromLibrary", "library"], ["cancel", null]]) {
      const a = fakeAlert();
      const p = choosePhotoSource(t, a.ask);
      a.press(button);
      await expect(p).resolves.toBe(expected);
    }
  });

  it("resolves with null when the alert is dismissed", async () => {
    // The back gesture on Android. Without an onDismiss the promise never
    // settles and the caller waits forever — the button would simply stop
    // working for the rest of the session.
    const a = fakeAlert();
    const p = choosePhotoSource(t, a.ask);
    a.state.dismiss();
    await expect(p).resolves.toBeNull();
  });

  it("settles exactly once", async () => {
    // A press and a dismiss can both arrive; the second must not win.
    const a = fakeAlert();
    const p = choosePhotoSource(t, a.ask);
    a.press("galFromLibrary");
    a.state.dismiss();
    await expect(p).resolves.toBe("library");
  });
});

describe("pickPhoto", () => {
  beforeEach(() => {
    picker.calls.length = 0;
    picker.next.permission = { granted: true };
    picker.next.result = { canceled: true };
  });

  it("asks for the camera permission before the camera", async () => {
    picker.next.permission = { granted: false };
    await expect(pickPhoto(true)).resolves.toBe("denied");
  });

  it("asks for NOTHING before the library", async () => {
    // Measured in the module's own Android source: launchImageLibraryAsync
    // checks no permission, and the request resolves to an empty permission set
    // on Android 13+. Below that it would ask for READ/WRITE_EXTERNAL_STORAGE —
    // which this app blocks, so asking would only produce a refusal for a
    // permission the operation does not need.
    picker.next.permission = { granted: false };
    await expect(pickPhoto(false)).resolves.toBeNull();   // cancelled, not denied
    expect(picker.calls.some((c) => /Permission/i.test(c))).toBe(false);
  });

  it("treats a picker that will not open as a cancel", async () => {
    // No camera or gallery activity on the device. Throwing here would surface
    // as an unhandled rejection from a button press.
    picker.next.throws = new Error("no activity found");
    await expect(pickPhoto(false)).resolves.toBeNull();
    picker.next.throws = null;
  });
});
