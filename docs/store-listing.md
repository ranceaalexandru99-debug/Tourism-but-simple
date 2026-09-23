# Store listing copy

For Google Play. Limits are Play's: app name 30 characters, short description
80, full description 4000. Counted, not estimated — see the bottom of this
file for how.

Two languages to start: Romanian (the primary market) and English (Play's
fallback for everyone else). The app itself speaks sixteen; the listing does
not have to, and a machine-translated listing reads worse than an English one.

**Nothing here claims anything the app does not do.** Play rejects listings
that oversell, and a description that promises more than the app delivers
earns one-star reviews from people who feel misled. Two claims depend on the
Supabase migration having run — they are marked, and must not ship before it.

---

## Romanian (ro-RO)

### Nume
```
Turism, dar simplu!
```

### Descriere scurtă
```
Traseul tău pe zile, cu ore, costuri și sfaturi. Apoi album și clip din poze.
```

### Descriere lungă
```
Spui unde vrei să mergi. Primești un traseu pe zile, cu ore, costuri estimate și sfaturi pentru fiecare oprire.

Fără conturi obligatorii, fără abonament pentru planificare.

PLANIFICARE
• Scrie liber: „Brașov 3 zile, gastronomie" — atât.
• Traseu pe zile, cu ore realiste și durata fiecărei opriri
• Buget estimat pe trei niveluri: econom, echilibrat, premium
• Obiective reale din OpenStreetMap: coordonate, program, categorii

ÎN TIMPUL CĂLĂTORIEI
• Hartă cu toate opririle și deschidere directă în Google Maps
• Program, preț și un sfat local pentru fiecare obiectiv
• Notițe personale la orice oprire — rezervări, mementouri
• Bifezi ce ai vizitat și dai stele
• Recapitulare la final: cât ai mers, ce ai văzut, ce ți-a plăcut

AMINTIRI
• Galerie de poze legate de excursie și de oprire

EXTRA (deblocare unică, opțională)
• Album foto ca PDF: fiecare poză așezată sub ziua și locul ei, pe o singură pagină, de tipărit sau trimis
• Clipuri verticale scurte din pozele excursiei, cu titlu și tranziții

Extra se deblochează printr-o singură plată. Nu e abonament: nu se reînnoiește și nu ai ce anula.

POZELE RĂMÂN LA TINE
Albumele și clipurile se creează pe telefonul tău. Fotografiile nu se încarcă nicăieri, nu ajung pe niciun server al nostru și nu le putem vedea.

16 LIMBI
Română, engleză, franceză, spaniolă, italiană, germană, poloneză, rusă, chineză, japoneză, portugheză, neerlandeză, turcă, greacă, ucraineană, coreeană.

FUNCȚIONEAZĂ ȘI FĂRĂ INTERNET
Traseele salvate se deschid și offline. Poți planifica fără cont și fără să dai nicio informație personală.
```

---

## English (en-US)

### App name
```
Turism, dar simplu!
```

### Short description
```
Your trip, day by day: times, costs, tips. Then an album and a clip from it.
```

### Full description
```
Say where you want to go. Get a day-by-day route with times, estimated costs and a tip for every stop.

No account required, and planning is free.

PLANNING
• Write it plainly: "Rome 3 days, food and a bit of history"
• A route per day, with realistic times and how long each stop takes
• Estimated budget at three levels: budget, balanced, premium
• Real places from OpenStreetMap: coordinates, opening hours, categories

WHILE YOU TRAVEL
• A map of every stop, and one tap into Google Maps
• Hours, price and a local tip for each place
• Your own notes on any stop — bookings, reminders
• Tick off what you have seen, and rate it
• A recap at the end: how far you walked, what you saw, what you liked

WHAT YOU BRING HOME
• A photo gallery tied to the trip and the stop

EXTRAS (one-off unlock, optional)
• A photo album as a PDF: every picture filed under the day and place you took it, laid out on a single page to print or send
• Short vertical clips made from your trip photos, with a title card and transitions

The extras unlock with a single payment. Not a subscription: nothing renews, and there is nothing to cancel.

YOUR PHOTOS STAY YOURS
Albums and clips are made on your phone. Your photos are never uploaded, never reach a server of ours, and we cannot see them.

16 LANGUAGES
English, Romanian, French, Spanish, Italian, German, Polish, Russian, Chinese, Japanese, Portuguese, Dutch, Turkish, Greek, Ukrainian, Korean.

WORKS WITHOUT A CONNECTION
Saved trips open offline. You can plan without an account and without giving us anything about yourself.
```

---

## Artwork

### Feature graphic — generated

```
node scripts/store-graphics.mjs
```

Writes `store/feature-graphic.png` at 1024×500, which Play requires. It is
branded artwork rather than a picture of the app, which is why it can be
generated at all. Nothing important sits near the edges: Play crops and
overlays this on some surfaces.

### Screenshots — only from the real app

Play requires between **2 and 8** phone screenshots, and requires them to show
the app as it actually runs. They cannot be generated here, and they must not
come from the web build: the two share a design, so the result would look
close — and close is what gets a listing rejected, besides being a promise
about software the buyer is not being sold.

**Expo Go shows the real native app**, so captures taken there are legitimate.

1. Open the app on the phone
2. Take the shots in the order below
3. Copy them into `store/raw/` as `01.png`, `02.png`, …
4. `node scripts/store-screenshots.mjs`

That writes `store/screenshots/` at 1080×1920, each shot scaled to fit with a
caption above it. The captions live in the script, in shot order:

| # | Shot | Caption |
|---|---|---|
| 1 | Home, with the search field | Spui unde. Primești traseul. |
| 2 | A route, list view, day 1 visible | Pe zile, cu ore și costuri |
| 3 | A stop sheet open, with a local tip | Fiecare oprire, cu sfatul ei |
| 4 | The route map with every pin | Tot traseul pe hartă |
| 5 | Gallery, a few photos, map view | Pozele tale, legate de locuri |
| 6 | The finished album | Album foto, gata de tipărit |
| 7 | The short editor, or a rendered clip | Un clip scurt din excursie |
| 8 | Me, with the language list open | În 16 limbi, și fără internet |

Two things to check before capturing: the phone is on a **saved trip with real
photos**, not an empty state, and the status bar is not showing something you
would rather not publish.

## The listing describes the ANDROID app, which is not the web app

This caught me out once and the first draft shipped four claims the Android
build cannot honour. The two apps share modules and a design; they do not share
a feature set. Anything written above must be true of `mobile-native/`.

| Feature | Web | Android |
|---|---|---|
| Trip planning, day by day | yes | yes |
| Budget tiers, currency switch | yes | yes |
| Stop sheet: hours, price, tip, notes | yes | yes |
| Route map, open in Google Maps | yes | yes |
| Visited ticks and ratings | yes | yes |
| End-of-trip recap | yes | yes |
| Photo gallery tied to trip and stop | yes | yes |
| Album PDF and short videos | yes | yes |
| **Group planning** (invite, vote, split) | yes | **no** — no Collab screen |
| **Weather for the trip dates** | yes | **no** — `weather.js` is never called |
| **Route optimisation** | yes | **no** — `optimizeItinerary` is never called |
| **Photos on a map** | yes | **no** — `MemoryMap` is web-only |
| **Explore map** (pan to discover cities) | yes | **no** |

How to check a claim before writing it: the feature has to be reachable from a
screen in `mobile-native/src/screens/`. A module existing in
`mobile-native/src/lib/` proves nothing — four of those are dead code on
Android, which is exactly how the first draft went wrong.

## Claims that depend on the Supabase migration

Two lines above describe coverage that is not live until
`scripts/migrate-cities-to-supabase.mjs` has run against a real project:

- "Real places from OpenStreetMap: coordinates, opening hours, categories"
- the implied breadth of "say where you want to go"

Until then `loadCityPois` returns null for every city and trips fall through to
a live Overpass fetch — real results, but 5–25 seconds. The claims are true of
the app as designed and false of the app as currently deployed, so the listing
must not go live before the migration does.

## What is deliberately NOT claimed

- No "AI-powered". The AI tier is one of four and is off without a key; most
  routes come from OpenStreetMap data and a local engine. Claiming AI would be
  selling the thinnest part.
- No number of cities. It would have to be updated as coverage grows, and a
  stale number in a store listing is the kind of small lie nobody forgives.
- No "free" in the short description. Planning is free and the extras are paid;
  leading with "free" next to an in-app purchase is what gets listings flagged.

## Checking the lengths

```
node scripts/check-listing.mjs
```
