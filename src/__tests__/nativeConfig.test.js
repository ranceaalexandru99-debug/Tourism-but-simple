import { describe, it, expect } from "vitest";
import fs from "node:fs";

// What the Android app asks the phone for, and what its WebViews are allowed to
// do. Both are the kind of thing that is invisible in code review and only
// shows up in the Play listing, or in a review rejection.

const app = JSON.parse(fs.readFileSync("mobile-native/app.json", "utf8")).expo;
const blocked = new Set(app.android?.blockedPermissions || []);
const picker = (app.plugins || []).find((p) => Array.isArray(p) && p[0] === "expo-image-picker");

describe("Android permissions", () => {
  it("never asks for the microphone", () => {
    // expo-image-picker's plugin adds RECORD_AUDIO unless told not to, and the
    // app never records anything. Measured in a generated manifest before the
    // fix: RECORD_AUDIO was there, unqualified. A trip planner asking for the
    // microphone is a trust problem before it is a review problem.
    expect(blocked.has("android.permission.RECORD_AUDIO")).toBe(true);
    expect(picker?.[1]?.microphonePermission).toBe(false);
  });

  it("never asks to read or write external storage", () => {
    // The package's own manifest declares both for picking from the camera
    // roll. Every photo in this app comes from the camera and is written to the
    // app's own document directory, so neither is ever exercised.
    expect(blocked.has("android.permission.READ_EXTERNAL_STORAGE")).toBe(true);
    expect(blocked.has("android.permission.WRITE_EXTERNAL_STORAGE")).toBe(true);
  });

  it("never asks to draw over other apps", () => {
    // Expo's template adds SYSTEM_ALERT_WINDOW for the dev menu. In a shipped
    // build it is a permission the listing shows as "display over other apps",
    // which a trip planner has no business wanting. If a development build's
    // error overlay ever misbehaves, this one line is why.
    expect(blocked.has("android.permission.SYSTEM_ALERT_WINDOW")).toBe(true);
  });

  it("still asks for the two it genuinely needs", () => {
    const asked = app.android?.permissions || [];
    expect(asked).toContain("android.permission.CAMERA");
    expect(asked).toContain("android.permission.INTERNET");
    expect(blocked.has("android.permission.CAMERA")).toBe(false);
  });

  it("picks from the library without asking for a permission", () => {
    // The app does offer the gallery now, and still needs no permission for it.
    // Measured in expo-image-picker's Android source: launchImageLibraryAsync
    // checks nothing, and requestMediaLibraryPermissionsAsync resolves to an
    // empty set on Android 13+. Below that it would ask for the storage
    // permissions blocked above — a refusal for something not required.
    expect(picker?.[1]?.photosPermission).toBe(false);

    // A CALL, not a mention: the comment explaining why it is absent names it.
    const lib = fs.readFileSync("mobile-native/src/lib/gallery.js", "utf8");
    expect(lib).not.toMatch(/ImagePicker\.requestMediaLibraryPermissionsAsync\s*\(/);
    expect(lib).toMatch(/ImagePicker\.requestCameraPermissionsAsync\s*\(/);
  });

  it("lets the user choose where a photo comes from", () => {
    // Both entry points ask first, rather than assuming the camera.
    for (const f of ["mobile-native/src/screens/Gallery.js", "mobile-native/src/screens/Route.js"]) {
      const src = fs.readFileSync(f, "utf8");
      expect(src).toContain("choosePhotoSource");
      expect(src).toMatch(/pickPhoto\(source === "camera"\)/);
    }
  });
});

describe("the WebViews", () => {
  const files = [
    "mobile-native/src/components/MemoryMap.js",
    "mobile-native/src/components/ShortRenderer.js",
    "mobile-native/src/screens/Explore.js",
  ];

  it("refuse every navigation away from the page we built", () => {
    // All three load a string of HTML and have nowhere to navigate to. Without
    // this, a link added later — or a redirect from something the page loads —
    // turns a renderer into an uncontrolled browser inside the app.
    for (const f of files) {
      const src = fs.readFileSync(f, "utf8");
      expect(src).toContain("onShouldStartLoadWithRequest");
      expect(src).toMatch(/req\.url === "about:blank"/);
    }
  });

  it("keep the rest of their sandbox shut", () => {
    for (const f of files) {
      const src = fs.readFileSync(f, "utf8");
      expect(src).toContain("allowFileAccess={false}");
      expect(src).toContain("domStorageEnabled={false}");
    }
  });
});
