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

Fără cheie, aplicația folosește motorul local (19 orașe curate manual, inclusiv
Timișoara și Arad). Cu cheie, Claude generează trasee pentru **orice** oraș:

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
  mockEngine.js      # motorul local: 19 orașe cu POI-uri curate + generare traseu
  aiEngine.js        # generare via Claude API (fallback transparent pe mock)
  i18n.js            # 10 limbi (EN/RO/FR/ES/IT/DE/PL/RU/ZH/JA), fallback EN
  theme.js           # teme light (porțelan+auriu) / dark + 6 accente
  icons.jsx          # stratul de iconuri SVG (lucide) + CategoryIcon/WeatherIcon
  shareCodec.js      # encode/decode trasee partajate în hash (#tripz=…)
  exporters.js       # export .ics (calendar) + PDF printabil
  locale.js          # valute, fraze de supraviețuire, info per țară
  screens/           # Splash → Welcome → Auth → Home/Trips/Gallery/Me → Route…
  components/        # carduri, sheets, hărți (leaflet), UI
  __tests__/         # vitest (locale, shareCodec, routeTime, exporters)
mobile-native/       # portul Expo (React Native)
assets-src/          # sursele SVG pentru brand (icon, og) — rasterizate cu sharp
legal/               # Privacy + Terms (șabloane multi-regiune) + checklist lansare
public/              # favicon/icoane/og.png, _headers (CSP), noflash.js
```

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
