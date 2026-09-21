# Releasing an update

Written so the second release is not improvised. Everything below was read out
of `mobile-native/eas.json`, `mobile-native/app.json` and `package.json` — not
recalled from how Expo usually works.

## Before you build

```
npm test                    # 341 tests, both apps and the server
npm run build               # the web app must still compile
cd mobile-native && npx expo export --platform android
```

The Android export is the one people forget. The web build passing says nothing
about whether the phone bundle does: they share modules but not their
toolchains, and a native-only import breaks only there.

The four shared modules — `album.js`, `albumHtml.js`, `shortEdit.js`,
`shortDraw.js` — are checked by `npm test`, which fails if any of them differs
by a byte between the two projects. A fix landing in one copy and not the other
is this project's most repeated mistake, so it is not left to a manual diff.

## Version numbers: what you change and what changes itself

There are two, and they are not the same thing.

| Field | Where | Who changes it |
|---|---|---|
| `expo.version` — "0.1.0" | `app.json` | **You.** Nothing increments it. |
| `expo.android.versionCode` — 1, 2, 3… | `app.json` | **EAS**, automatically |

`eas.json` sets `"autoIncrement": true` on the production profile and
`"appVersionSource": "local"`, so every production build raises `versionCode`
in `app.json` and commits the new value to your working tree. Commit it.

Play refuses an upload whose `versionCode` it has seen before, which is why
this is automated — it is the single most common way a release stalls.

### The trap in `version`

`app.json` sets `runtimeVersion: { policy: "appVersion" }`. The runtime version
IS the `version` string, and an over-the-air update only reaches builds with a
matching runtime version.

So bumping `version` from 0.1.0 to 0.2.0 **cuts off every existing install from
OTA updates**. They keep working, but they will not receive another JS update
until they install the new build from Play.

That is correct behaviour — a JS bundle must not run against native code it was
not built for — but it means you decide, deliberately, which kind of release
you are making.

## Two kinds of release

### JS only — no store review

If the change touches only JavaScript (a screen, a string, a fix in shared
logic) and no native module, dependency or permission:

```
cd mobile-native
eas update --branch production --message "what changed"
```

Existing installs pick it up on their next launch — `checkAutomatically` is
`ON_LOAD`. No review, no wait, no `version` bump. **Do not bump `version`**, or
the update reaches nobody.

Play permits this. What it does not permit is using it to change what the app
fundamentally is, or to slip past a policy review.

### Anything native — a new build

A new or updated native module, a permission, an app.json change, an Expo SDK
upgrade, or a user-facing release worth a version number:

```
cd mobile-native
eas build --profile production --platform android
eas submit --profile production --platform android
```

`submit.production` is already configured in `eas.json`. The first submit will
ask for a Play service-account key; after that it is unattended.

## Rolling out

Do not release to everyone at once. In Play Console, start the production
release at **20%** and leave it a day.

With no crash reporting configured — `ERROR_ENDPOINT` in
`mobile-native/src/lib/monitor.js` is the empty string — your only signal is
Play Console itself: Android vitals for crash and ANR rates, and the reviews.
Both lag by hours, which is the real argument for a staged rollout: at 20%, a
crash costs you a fifth of the audience instead of all of it.

Raise to 50%, then 100%, a day apart, if vitals stay flat.

## When something is wrong

You cannot unpublish a version or pull it back from people who installed it.
What you can do:

1. **Halt the rollout** in Play Console — stops it reaching anyone new
2. If the fault is JavaScript, `eas update` fixes everyone on that runtime
   version within a launch, without a review
3. If it is native, build, submit, and roll out the fix — halting the bad one
   first so the two do not race

This is why the JS/native split above matters: a JS bug is minutes away from
fixed, a native one is a day or more.

## The web app is a separate release

Nothing above touches it. The web build deploys to Netlify from `dist/`, and
its environment variables — `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY` — are baked in at build time, so changing one
in Netlify does nothing until you redeploy.

The two can drift in version and usually will. That is fine: they share modules,
not a release cycle.

## Checklist

- [ ] `npm test` green — this also proves the shared modules have not drifted
- [ ] both builds produced, the Android export included
- [ ] decided: JS-only update, or a build?
- [ ] if a build: `version` bumped, and you accept cutting existing installs
      off from OTA
- [ ] `versionCode` change committed after the build
- [ ] rolled out at 20%
- [ ] vitals checked the next day before widening
