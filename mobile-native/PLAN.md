# VoyageAI — Native Mobile Port (Expo)

A ground-up React Native rewrite of the VoyageAI web app, runnable in **Expo Go**
(no native build needed). Business logic and data are reused verbatim from the web
app; only the UI layer is rewritten from HTML/CSS to React Native primitives.

## Strategy: reuse logic, rewrite UI

The web app cleanly separates **pure logic/data** from **DOM UI**. An audit showed:

| Module | Browser APIs used | Port method |
|--------|-------------------|-------------|
| `mockEngine.js` (POI database + route assembly) | none | **copy verbatim** |
| `geo.js` (distance, optimize) | none | **copy verbatim** |
| `locale.js` (currency, phrases, country info) | none | **copy verbatim** |
| `utils.js` (dates, trip status, stats) | none | **copy verbatim** |
| `weather.js` (Open-Meteo fetch) | `fetch` (universal) | **copy verbatim** |
| `photos.js` (Wikipedia photos) | `localStorage` | copy + localStorage shim |
| `theme.js` (palette + context) | `localStorage` | copy + shim (no CSS inside) |
| `i18n.js` (10-language dictionary) | `localStorage`, `createElement` | copy + shim (RN-safe) |
| `mockCollab.js` (group planning) | `localStorage` | copy + shim |
| `aiEngine.js` (Claude API) | `import.meta.env`, SDK | adapt (env + fetch) — later |
| `exporters.js` (PDF/ICS) | `document`, `window`, Blob | rewrite (expo-print/sharing) — later |
| **All screens + components** | DOM (`div`, CSS) | **rewrite in RN** |

A tiny **`localStorage` polyfill** (in-memory, write-through to AsyncStorage) lets all
the `localStorage`-using modules run unchanged in React Native.

## Tech stack (Expo Go-compatible, JS-only where possible)

- **Expo SDK 54** (React 19, React Native 0.81) + `expo-status-bar`
- **expo-linear-gradient** — the gold/blue gradients everywhere
- **@expo-google-fonts/fraunces** + **plus-jakarta-sans** — the editorial + UI type
- **react-native-svg** — progress ring, QR
- **@react-native-async-storage/async-storage** — persistence
- Navigation: a lightweight **screen-state machine** in `App.js` mirroring the web
  app's existing `screen` state (splash → welcome → auth → home/tabs → input →
  preferences → loading → route). Keeps parity with the web architecture and avoids
  extra native deps. Can migrate to `@react-navigation` later for gesture transitions.

Deliberately **excluded from Expo Go MVP** (need native modules / later work):
- `react-native-maps` (map view) → show a styled fallback for now
- PDF/ICS export → hide those share options on native initially
- Real AI (Claude) → mock engine only until the API is proxied

## Screen inventory (12) — port order

1. **Splash** ✅ — logo, rings, spinner
2. **Welcome** ✅ — 3-slide onboarding carousel
3. **Auth** ✅ — social buttons + guest (guest is the real path)
4. **Home** — greeting, continue card (progress ring), search, recent, popular grid
5. **BottomNav** — Home / Trips / Me tabs
6. **Trips** — saved trips grouped by status
7. **Me** — profile + language/theme pickers
8. **Input** — free-text + autocomplete (Nominatim) + quick chips
9. **Preferences** — chat-style day/date/interests/pace
10. **Loading** — 4-step animated progress
11. **Route** — the big one: cover, budget, phrases, good-to-know, now-card,
    timeline, per-day maps, refine sheet, share sheet, stop detail, ratings, stats
12. **Collab** — group votes / costs / activity (up to 10 people)

## Folder layout

```
mobile-native/
├── PLAN.md                  (this file)
├── package.json             Expo deps
├── app.json                 Expo config (name, colors, bundle id)
├── babel.config.js
├── index.js                 entry — installs polyfill, registers App
├── App.js                   screen-state machine + providers
└── src/
    ├── polyfill.js          localStorage shim over AsyncStorage
    ├── theme.js             (copied) palette + ThemeProvider
    ├── i18n.js              (copied) dictionary + useI18n
    ├── lib/                 (copied verbatim) mockEngine, geo, locale, utils, weather, photos, mockCollab
    ├── components/          RN: Btn, Chip, Screen, StatusBar, ProgressRing, PoiImage, BottomNav
    └── screens/             RN screens (see inventory)
```

## Porting rules (HTML/CSS → RN)

- `<div>` → `<View>`, `<span>/<p>/<h1>` → `<Text>`, `<button>` → `<Pressable>`,
  `<input>/<textarea>` → `<TextInput>`, `<img>` → `<Image>`.
- Inline `style={{}}` objects → `StyleSheet.create` (or inline objects; RN accepts both).
- `linear-gradient(...)` backgrounds → `<LinearGradient>` from expo-linear-gradient.
- CSS `@keyframes` animations → `Animated` / `react-native-reanimated`.
- `onClick` → `onPress`; `:hover`/`:active` → `Pressable`'s `style={({pressed}) => ...}`.
- Flexbox works the same, but **`flexDirection` defaults to `column`** in RN (vs `row` on web).
- No `boxShadow` string; use `shadowColor/shadowOpacity/shadowRadius/elevation`.
- All text MUST be inside `<Text>` (RN throws otherwise).

## Run it

```
cd mobile-native
npm install
npx expo start        # scan the QR with Expo Go
```
