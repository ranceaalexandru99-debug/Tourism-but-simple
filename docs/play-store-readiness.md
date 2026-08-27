# Play Store readiness

Everything here was read out of the code, not assumed. Where an answer would
change if the code changed, the file that decides it is named.

## Data Safety form

The Android app talks to five hosts and sends none of the user's own data to
any of them. The answers below follow from that.

**Does your app collect or share any of the required user data types?**
→ **No.**

Justification, per data type Google asks about:

| Data type | Collected? | Why |
|---|---|---|
| Name, email address | No | Accounts are **local only**. `signUp()` in `mobile-native/src/lib/auth.js` salts and hashes the password with `expo-crypto` and stores it on the device. Nothing is transmitted, and there is no server that could receive it. |
| Photos | No | Stored in the app's document directory (`mobile-native/src/lib/gallery.js`). Albums and shorts are rendered **on the device** — `expo-print` for the PDF, a WebView + MediaRecorder for the video. This is why server-side rendering was rejected: the privacy policy promises it three times. |
| Location | No | No `expo-location`, no permission requested. The weather call sends the **destination's** coordinates (`weather.js`), which the user typed — not the device's position. |
| Crash logs / diagnostics | No | `ERROR_ENDPOINT` in `mobile-native/src/lib/monitor.js` is the empty string, so nothing is POSTed. Setting it would change this answer to Yes. |
| Purchase history | Shared by the store | RevenueCat/Google Play handle the receipt. Declare per RevenueCat's own guidance once billing is enabled. |

**Hosts contacted** (all read-only public APIs, no user data in the request):

- `overpass-api.de`, `maps.mail.ru`, `overpass.kumi.systems` — OpenStreetMap POIs for a city the user asked about
- `commons.wikimedia.org` — public photos of attractions
- `api.open-meteo.com` — forecast for the destination's coordinates
- `turism-dar-simplu.netlify.app` — the app's own pre-generated POI files
- `www.google.com` — only when the user taps "open in Maps"; this is an outbound link, not a request the app makes

## Permissions

`CAMERA` is the only one declared (`app.json`). The rationale strings are in the
`expo-image-picker` plugin config and are what the OS shows in the prompt.

Note: picking from the photo library on Android 13+ uses the Photo Picker, which
needs no permission. If a future change adds `READ_MEDIA_IMAGES`, Play will ask
for a declaration form — worth avoiding.

## Before the first upload

- [ ] Privacy policy at a **public URL** — required by the Data Safety form.
      `npm run legal` generates `privacy.html`, `terms.html` and
      `delete-account.html`; they need to be reachable on the deployed site.
- [ ] Account deletion URL — Play requires it for any app with accounts.
      `delete-account.html` exists; it must be publicly linked.
- [ ] `versionCode` is `1` and `version` is `0.1.0` — fine for the first upload,
      but `versionCode` must increase on **every** subsequent one.
- [ ] RevenueCat entitlement named exactly `premium`, and its Android key in
      `app.json` → `extra.revenueCatAndroidKey`. Until then `billingConfigured`
      is false and the paywall honestly says billing is unavailable.
- [ ] Build: `eas build --profile production --platform android`.

## Known gaps, deliberately

- **Accounts do not survive the device.** They are local, so there is no
  password reset and no sync between phones. This is a consequence of having no
  backend on native, not an oversight — but users will expect otherwise, so the
  sign-in screen should not imply a cloud account.
- **The web app has no way to subscribe.** Clicking a paid feature there shows
  "part of the subscription" and stops. Billing exists only through Play.
