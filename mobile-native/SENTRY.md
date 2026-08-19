# Activarea Sentry (crash reporting în producție)

Aplicația are deja un monitor local ([src/lib/monitor.js](src/lib/monitor.js)):
orice crash e păstrat pe dispozitiv (ultimele 20) și există un seam
(`setErrorReporter`) în care Sentry se conectează cu o singură linie.

Monitorul local NU trimite nimic în afara telefonului. Ca să AFLI când
utilizatorii au crash-uri (email + stack trace + grupare pe frecvență),
activează Sentry — plan gratuit, ~10 minute:

## Pași

1. **Cont + proiect** — [sentry.io](https://sentry.io) → Create Project →
   platformă **React Native**. Copiază **DSN**-ul (arată ca
   `https://xxxx@oyyy.ingest.sentry.io/zzzz`).

2. **Instalează SDK-ul** (în `mobile-native/`):
   ```bash
   npx expo install @sentry/react-native
   ```

3. **Config plugin** — în `app.json`, la `expo.plugins`, adaugă:
   ```json
   ["@sentry/react-native/expo", { "organization": "org-ul-tau", "project": "proiectul-tau" }]
   ```

4. **Inițializare + conectare la monitor** — în `App.js`, imediat sub
   `installMonitor()`:
   ```js
   import * as Sentry from "@sentry/react-native";
   import { setErrorReporter } from "./src/lib/monitor.js";

   Sentry.init({ dsn: "DSN-UL-TAU", enableInExpoGo: false });
   setErrorReporter((entry) => Sentry.captureMessage(`[${entry.kind}] ${entry.message}`, {
     level: "error",
     extra: entry,
   }));
   ```

5. **Rebuild** — SDK-ul are cod nativ, deci după instalare e nevoie de
   `eas build` nou (nu doar update OTA).

## Note
- În **Expo Go** Sentry nu prinde crash-uri native (limitare Expo Go) —
  monitorul local acoperă JS-ul acolo. În build-ul de producție prinde tot.
- Pentru sourcemaps lizibile la build, setează `SENTRY_AUTH_TOKEN` ca
  secret EAS: `eas env:create --name SENTRY_AUTH_TOKEN`.
