# VoyageAI — „Turism, dar simplu!"

Planificator de călătorii cu AI: scrii un oraș (oriunde în lume), primești un itinerariu
pe zile cu atracții, orare, buget estimat, hartă, vreme, fraze utile și sfaturi locale.
Web app React (mockup în ramă de telefon) + port nativ Expo.

**Tot ce e personal stă pe dispozitiv** (localStorage/IndexedDB) — fără server, fără cont central.

---

## Pornire rapidă (web)

```bash
npm install
npm run dev          # http://localhost:5173 (sau 5174)
```

### Cheia AI (opțional)

Cheia nu mai decide dacă un oraș are obiective reale — vezi *De unde vin
obiectivele* mai jos. Fără cheie se sare peste nivelul AI; cu cheie, Claude
scrie un traseu pentru o destinație care nu e în indexul de 5000 de orașe:

```bash
cp .env.example .env # apoi completează VITE_ANTHROPIC_API_KEY
```

> ⚠️ **Doar pentru dezvoltare locală.** Cheia ajunge în bundle-ul de browser
> (`dangerouslyAllowBrowser`). Pentru producție e OBLIGATORIU un proxy
> server-side (funcție serverless) care ține cheia la el — nu lansa public fără el.

### Build & teste

```bash
npm run build        # build de producție (dist/) cu PWA + code-splitting
npm run build:share  # un singur index.html autonom (share/) — merge din file://
npm test             # vitest — teste unitare pe logica pură
npm run preview      # servește build-ul local
```

---

## Aplicația nativă (Expo SDK 54)

```bash
cd mobile-native
npm install
npx expo start --lan      # sau --tunnel
```

Pe Windows există scurtături: `start-mobile-lan.bat` (același Wi-Fi) și
`start-mobile.bat` (tunel public). Scanezi QR-ul cu **Expo Go**.

Logica (i18n, teme, motor mock, monedă) e partajată prin portarea modulelor din
`src/` în `mobile-native/src/lib/` peste un polyfill de `localStorage` pe AsyncStorage.

---

## Structura proiectului

```
src/
  App.jsx            # mașina de stări a ecranelor + persistență
  mockEngine.js      # 19 orașe cu obiective scrise de mână + asamblarea traseului
  aiEngine.js        # scara de niveluri: index → poiDb → osmLive → AI → mock
  destinations.js    # indexul de 5000 de orașe (Supabase, cu copie locală)
  poiDb.js           # obiectivele OSM din Supabase
  osmLive.js         # Overpass pe loc, pentru orașele fără obiective salvate
  shared/            # module identice bit cu bit cu portul nativ
  i18n.js            # 16 limbi, încărcate la cerere; EN inclus mereu
  theme.js           # teme light (porțelan+auriu) / dark + 6 accente
  icons.jsx          # stratul de iconuri SVG (lucide) + CategoryIcon/WeatherIcon
  shareCodec.js      # encode/decode trasee partajate în hash (#tripz=…)
  exporters.js       # export .ics (calendar) + PDF printabil
  locale.js          # valute, fraze de supraviețuire, info per țară
  screens/           # Splash → Welcome → Auth → Home/Trips/Gallery/Me → Route…
  components/        # carduri, sheets, hărți (leaflet), UI
  __tests__/         # vitest — 60 de fișiere, acoperă și portul nativ
mobile-native/       # portul Expo (React Native)
  src/shared/        # copiile sincronizate de scripts/sync-native-data.mjs
  src/data/pois/     # obiectivele împachetate în aplicație (60 de felii)
assets-src/          # sursele SVG pentru brand (icon, og) — rasterizate cu sharp
legal/               # Privacy + Terms (șabloane multi-regiune) + checklist lansare
public/              # favicon/icoane/og.png, _headers (CSP), noflash.js
```

## De unde vin obiectivele

Un traseu e făcut din locuri reale, iar cele două aplicații le găsesc pe căi
diferite. Fiecare încearcă nivelurile în ordine și se oprește la primul care
răspunde — cu o excepție, notată mai jos.

**Web** (`src/aiEngine.js`)

| | sursă | cost |
|---|---|---|
| 0 | 19 orașe scrise de mână în `mockEngine.js` | instant |
| 1 | `poiDb.js` — tabelul `city_pois` din Supabase | o interogare |
| 1.5 | `osmLive.js` — Overpass pe loc, cu buget de 12 s | 5–12 s, apoi din cache |
| 2 | `aiEngine.js` — Claude, dacă e configurată o cheie | câteva secunde |
| 3 | itinerariul generic din `FALLBACK` | instant |

Excepția e nivelul 0: un oraș curat manual are opriri bune, dar nu neapărat
suficiente pentru șapte zile, așa că `topUpCurated` le completează din
nivelurile OSM în loc să repete aceleași locuri. E singurul loc unde două
niveluri contribuie la același traseu.

Nivelul 1 **nu funcționează încă**: proiectul Supabase nu există, deci
`poiDb.js` întoarce `null` pentru orice oraș și totul cade pe 1.5.
`scripts/migrate-cities-to-supabase.mjs` așteaptă.

**Nativ** (`mobile-native/src/lib/mockEngine.js`)

| | sursă | cost |
|---|---|---|
| 1 | aceleași 19 orașe scrise de mână | instant |
| 2 | `poiPack.js` — 265.740 obiective pentru 4.769 orașe, în bundle | instant, offline |
| 3 | `osmLive.js` — Overpass pe loc, același buget | 5–12 s, apoi din cache |
| 4 | itinerariul generic | instant |

Nativul nu are nivel AI și nu atinge Supabase: e offline-first, iar un traseu
care are nevoie de rețea ca să numească un muzeu e mai rău decât niciun traseu.
Obiectivele sunt împachetate de `scripts/pack-native-pois.mjs` din `data/pois/`,
ieșirea crawler-ului OpenStreetMap (`scripts/batch-pois.mjs`), și costă ~11 MB
la descărcare — `--cities N` împachetează doar primele N dacă e prea mult.

Logica pe care ambele platforme o împart stă în `src/shared/` și e copiată bit
cu bit de `scripts/sync-native-data.mjs`. Fiecare parte păstrează doar un
înveliș subțire pentru ce răspunde diferit: un browser nu-și poate suprascrie
User-Agent-ul, un telefon nu are origine pentru URL-uri relative.

## Note de arhitectură

- **Fără CSS framework** — stiluri inline + tokens din `theme.js` (`C` = paleta activă,
  mutată in-place de `applyTheme`; light e implicit).
- **Iconuri**: exclusiv SVG (lucide-react) prin `src/icons.jsx`; emoji rămân doar în
  conținut (steaguri, liste de mâncare) — nu în chrome-ul UI.
- **Code-splitting**: `Route` și `Gallery` sunt lazy (leaflet ~146KB se încarcă la cerere).
- **Partajare fără server**: traseul întreg e comprimat LZ în URL (`#tripz=`), plus QR.
- **PWA**: service worker (autoUpdate), manifest, funcționează offline pe traseele salvate.
- **Securitate**: CSP strict prin `public/_headers` (Netlify/Cloudflare) și `vercel.json`
  (Vercel) — activ doar după deploy; validare formă pentru traseele primite prin link.
- **Monitorizare erori**: `src/monitor.js`, oprit implicit; se activează setând
  `VITE_ERROR_ENDPOINT` (primește POST JSON cu erorile din producție).

## Înainte de lansare (pe scurt)

1. **Proxy pentru cheia API** — vezi avertismentul de mai sus. Blocker.
2. **Deploy** — configurile există (`vercel.json`, `_headers`); publică `dist/`.
3. **Legal** — completează placeholder-ele de identitate din `legal/` și treci
   documentele printr-un avocat (checklist în `legal/README.md`).

## Licență

Proiect personal — toate drepturile rezervate autorului.
