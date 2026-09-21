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
- [ ] One in-app product, **non-consumable**, priced at **50 RON** in Romania
      and about €9.99 as the base elsewhere. Not a subscription — see below.
- [ ] RevenueCat entitlement named exactly `premium`, and its Android key in
      `app.json` → `extra.revenueCatAndroidKey`. Until then `billingConfigured`
      is false and the paywall honestly says billing is unavailable.
- [ ] Build: `eas build --profile production --platform android`.

## Selling the unlock

Nothing is left to build. `premium.js` talks to RevenueCat, `Paywall.js` shows
the store's own localised price and offers "Restore purchases", and with no key
configured the app says billing is unavailable rather than showing a button
that takes no money. What remains is account setup, and it has to happen in
this order — each step needs the one before it.

### 1. Google Play Console — €25, once

Create the developer account, then the app, with the package name already in
`app.json`: `com.turismdarsimplu.app`. It cannot be changed after the first
upload, so it is worth being sure of now.

Identity verification takes days, sometimes weeks. Start it before anything
else, because nothing below can be finished without it.

### 2. A payments profile

Taking money needs a merchant account linked to the Play Console: bank details,
tax information, the address payouts go to. Google withholds payouts until it
is complete.

### 3. The product — a one-off unlock, not a subscription

In Play Console → Monetise → **In-app products**, as a single
**non-consumable** item. Not Subscriptions.

The reasoning, so it is not undone by accident later: what is sold is photo
albums and shorts, and both are used AFTER a trip. Most people take one to
three trips a year. A monthly subscription asks for a recurring payment for
something used a handful of times — someone subscribes in August, makes their
album, and cancels in September. A single unlock matches how the thing is
actually used, converts better at a small price, and removes churn, failed
renewals and cancellation support entirely.

**Price: 50 RON in Romania.** Decided; entered in Play Console, not in code.
For other markets set a base of about €9.99 and let Play derive local prices —
a German buyer should pay what is normal in Germany, not the conversion of a
Romanian price. Play suggests those; they are worth accepting rather than
hand-tuning.

There is no price anywhere in this repository, and there must not be.
`Paywall.js` renders `product.priceString` exactly as the store reports it,
already formatted in the buyer's own currency. That is both the only correct
way — prices differ by country, tax and time — and a store requirement.

Google takes 15% below $1M of annual revenue, so 50 RON returns roughly 42.5
RON before tax.

Starting higher is safer than starting low: discounting later is easy, raising
a price is not.

Nothing in the code assumes a subscription. RevenueCat maps a non-consumable to
an entitlement exactly as it maps a subscription, so `premium.js` and
`Paywall.js` work unchanged — only the wording differs, and that is already
written for a one-off purchase in all 16 languages.

### 4. RevenueCat

Free below roughly $2.5k of monthly tracked revenue, which is where this will
be for a long time.

- Create a project, add the Android app with the same package name
- Upload the Play service-account credentials so receipts can be validated
  server-side — this is the whole reason for using it: without it, "has this
  person paid?" is a question the phone answers to itself, and the answer is
  trivially forged
- Create an entitlement named **exactly** `premium`. `ENTITLEMENT` in
  `premium.js` is that string; a typo is a silent "nobody is ever entitled",
  which is why a test pins it
- Attach the Play products to that entitlement, in an offering marked current —
  `getOffering()` reads `offerings.current`

### 5. The key

Copy the RevenueCat **public** Android SDK key into `app.json` →
`extra.revenueCatAndroidKey`. It is designed to ship inside the app; the
secret key stays in RevenueCat and never appears here.

`billingConfigured` is `key && sdk`, so it stays false until this is done AND
the app is a real build — see the next point.

### 6. Build and test without spending money

`react-native-purchases` is a native module, so it does not exist in Expo Go
and billing reports itself unavailable there. Testing purchases needs a real
build:

```
eas build --profile production --platform android
```

Upload it to **internal testing**, then add your own Google account under
Play Console → Setup → License testing. Testers see the real purchase flow,
are charged nothing.

Test, at minimum: buying; that the album and short screens unlock immediately;
"Restore purchases" on a second device signed into the same Google account;
and a refund from the Play order history, after which access must go away.
RevenueCat revokes the entitlement on a refund, so this is worth seeing once.

### What Play requires of the paywall

Most of this is already true; it is listed so a future change does not quietly
break compliance.

- The price must be visible **before** the purchase — the store's own price
  string satisfies this, and it is why the app never hard-codes one
- A way to restore purchases — the button exists, and it is not optional
- No link out to another payment method for digital goods; Play billing or
  nothing
- Refunds are handled by Play, not by the app. Do not build a refund flow
- The privacy policy and the account-deletion URL from the list above must be
  live before review

### The web app cannot sell this

Selling the same unlock on the web would need a second payment provider, a real
account system to attach an entitlement to, and a way to reconcile the two —
and the app's accounts are local to the device. The web build says the unlock
is bought in the Android app and stops there, which is honest and costs nothing
to maintain.

If web selling ever matters, the order is: real accounts with a backend first,
then Stripe, then teach RevenueCat about it. Not before.

## Known gaps, deliberately

- **Accounts do not survive the device.** They are local, so there is no
  password reset and no sync between phones. This is a consequence of having no
  backend on native, not an oversight — but users will expect otherwise, so the
  sign-in screen should not imply a cloud account.
- **The web app has no way to buy.** Clicking a paid feature there says the
  unlock is bought in the Android app and stops. Billing exists only through
  Play.
