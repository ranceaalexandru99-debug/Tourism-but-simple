# Privacy Policy — VoyageAI

**Effective date:** 4 July 2026
**Last updated:** 4 July 2026

> ⚠️ **Template notice.** This document is a detailed starting point tailored to
> how VoyageAI actually works. It is **not legal advice** and must be reviewed by
> a qualified lawyer before you publish or launch, especially for EU/GDPR, UK,
> and US (CCPA/CPRA) compliance and for Apple App Store / Google Play review.
> Replace every `[BRACKETED]` placeholder.

---

## 1. Who we are

VoyageAI ("**VoyageAI**", "**the app**", "**we**", "**us**", "**our**") is an
AI-assisted travel-itinerary application operated by **[YOUR FULL NAME or
REGISTERED BUSINESS NAME]**, established in **Romania**, registered address
**[YOUR ADDRESS]** (registration no. **[CUI / COMPANY / VAT NO. — if you are a
PFA or SRL; omit this line if you operate as a private individual]**).

For any privacy question or to exercise your rights, contact us at:
**rancea.alexandru99@gmail.com**.

We are the **data controller** for the limited personal data described below.
[If you appoint a Data Protection Officer, add their contact here; a DPO is
generally not mandatory for a small app but state it if you have one.]

## 2. Summary (the short version)

- The app runs **on your device**. Your saved trips, searches, preferences,
  account credentials and photos are stored **locally in your browser/device**,
  not on our servers. We do **not** operate user-account databases.
- To generate itineraries, we send the **destination and preferences you type**
  to **Anthropic's Claude AI**. We do **not** send your name, email, photos, or
  precise location for this.
- **Location** is used only if you tap "From here", once, to build directions.
  It is **not stored** by us and **not sent** to our servers.
- We use a few **third-party services** to enrich trips (maps, weather, photos).
- We do **not** sell your data, show ads, or run cross-site tracking.

## 3. What data we process, why, and the legal basis (GDPR Art. 6)

| Data | Where it lives | Purpose | Legal basis |
|------|----------------|---------|-------------|
| Account email + salted password hash (if you create an account) | Your device (localStorage) | Let you sign in on this device | Contract (Art. 6(1)(b)) |
| Display name | Your device | Personalise greetings | Contract |
| Saved trips, recent searches, theme & language | Your device | Core app functionality | Contract / Legitimate interest |
| Trip photos you add | Your device (IndexedDB / device storage) | Your personal travel gallery | Consent / Contract |
| Destination text + trip preferences | Sent transiently to Anthropic Claude API | Generate the itinerary | Consent + Legitimate interest |
| Approximate/precise geolocation | Device only, in the moment | Build "from here" directions | Consent (Art. 6(1)(a)) |
| Technical data (IP, device/browser type) processed by our hosting/CDN | Hosting provider logs | Serve the app, security | Legitimate interest |

We do **not** knowingly process special-category data (health, religion,
biometrics, etc.). Please don't put such data into captions or free-text fields.

## 4. Third-party services (processors and independent controllers)

To provide features we transmit the minimum necessary data to:

- **Anthropic (Claude API)** — receives the destination and preferences you
  enter, to generate itineraries. Processed on Anthropic's infrastructure
  (which may be in the **United States**). See Anthropic's privacy terms.
- **OpenStreetMap / Nominatim** — destination autocomplete (your typed query).
- **Open-Meteo** — weather for the trip location (coordinates + dates).
- **Wikipedia / Wikimedia** — representative photos for places (place names).
- **Google Maps** — when you tap "Open in Maps"/"Directions", the app opens
  Google Maps in your browser/app; Google then acts as an independent
  controller under its own policies.
- **[HOSTING/CDN PROVIDER — e.g. Vercel / Netlify / Cloudflare]** — serves the
  app and processes technical connection data (including IP address) in logs.

Each provider processes only the minimal query needed and operates under its own
privacy policy. Where these involve transfers outside the EEA/UK, they rely on
their own safeguards (e.g. Standard Contractual Clauses). **[Confirm the transfer
mechanism for each provider with your lawyer.]**

We do not use third-party advertising or analytics SDKs. **[If you later add
analytics such as Plausible/Umami/GA, disclose it here and update the cookie
section.]**

**[Optional — delete if unused:** the app ships with a built-in error reporter
that is **disabled by default**, on the website (build-time
`VITE_ERROR_ENDPOINT`) and in the Android app (`extra.errorEndpoint`). While it
is disabled, errors are kept only on your own device, in a buffer of the last
twenty, and are sent nowhere.

If the operator enables it, uncaught technical errors are sent to that endpoint
as small JSON payloads: error message, stack trace, page path (never the trip
data in the URL hash), platform or browser, app version and timestamp. No
identifiers and no cookies.

Before anything leaves your device it is passed through a filter that removes
the categories we can predict: inline photo data, email addresses, file paths,
access tokens and long identifiers. We do this because an error message is
assembled by whatever failed, and that may have been holding something you
typed. **This reduces what is exposed; it does not make a report anonymous,
and we do not claim that it does.** A stack trace may still contain fragments
of text from the screen you were on.

At most ten reports are sent per session, so a repeating fault cannot turn into
a stream of data.

Name the endpoint provider here and its retention period.**]**

## 5. International data transfers

VoyageAI is usable worldwide, and some processors may handle data outside your
own country or region:

- **Anthropic (Claude API)** may process the destination and preferences you
  enter in the **United States** or other countries.
- Map, weather, photo and hosting providers may process data in the EU, the US
  or elsewhere, depending on the provider.

Where transfers leave the **EEA/UK**, they rely on appropriate safeguards under
GDPR Chapter V (e.g. **Standard Contractual Clauses** or adequacy decisions
where applicable). Where the law of your country (for example Brazil's LGPD,
South Africa's POPIA, China's PIPL, or India's DPDP Act) requires a lawful basis
or your consent for a cross-border transfer, then by using AI itinerary
generation you consent to the transfer described above. **[Confirm the transfer
mechanism for each provider and region with your lawyer.]** Contact us for
details.

## 6. Storage, retention and deletion

- Data stored **on your device** remains until you delete it (delete a trip or
  photo in-app, sign out, or clear your browser/app storage). Uninstalling or
  clearing site data removes everything.
- Data sent to **Anthropic** for generation is subject to Anthropic's retention
  policy; we do not keep a copy on our servers.
- Hosting/CDN **server logs** are retained by the provider for a short period
  for security and troubleshooting (**[state the provider's log retention, e.g.
  ~30 days]**).

## 7. Cookies and local storage

VoyageAI does **not** use tracking or advertising cookies. It uses the browser's
**localStorage** and **IndexedDB** strictly to store your trips, preferences,
account and photos **on your device** for the app to function. These are
essential to the service. **[If you add non-essential analytics/cookies, you
must add a compliant cookie-consent mechanism.]**

## 8. Sharing a trip

When you share a trip, the app encodes the trip into a **link (and QR code)**.
**Anyone who has that link can view that trip.** Do not include private
information in trip content you intend to share.

## 9. Your rights by region

Your rights over your personal data depend on where you live. Because most data
lives **on your device**, you can exercise many of them directly (edit or delete
in-app, clear your browser/app storage). For anything else, email
**rancea.alexandru99@gmail.com** and we will respond within the timeframe
required by applicable law (generally **one month** under the GDPR). Wherever you
are, we apply the same core practices: data stored on your device, minimal data
sent to processors, **no sale of data, no ads, no cross-site tracking**.

### 9.1 European Union / EEA, United Kingdom & Romania

Under the **GDPR** (and the **UK GDPR**) you have rights to **access**,
**rectify**, **erase**, **restrict**, **object to** processing, **data
portability**, and to **withdraw consent** at any time. You may lodge a complaint
with your local supervisory authority — in **Romania**, the **ANSPDCP**
(dataprotection.ro); in the **UK**, the **ICO** (ico.org.uk).

### 9.2 United States

- **California (CCPA/CPRA):** rights to know, access, delete, correct, and to opt
  out of the "sale"/"sharing" of personal information, plus the right not to be
  discriminated against for exercising them. We do **not** sell or share personal
  information as defined by the CCPA and do not use sensitive personal
  information for purposes that require an opt-out.
- **Other US states** (e.g. Virginia **VCDPA**, Colorado **CPA**, Connecticut
  **CTDPA**, Utah **UCPA**, Texas **TDPSA**): comparable rights to access,
  correct, delete, obtain a copy of your data, and opt out of targeted
  advertising, sale, and certain profiling — none of which we carry out.
- We do not knowingly collect data from US children under **13** (**COPPA**).

### 9.3 Asia-Pacific

Where applicable, you have local data-protection rights — including under
**Japan (APPI)**, **South Korea (PIPA)**, **Singapore & Thailand (PDPA)**,
**India (DPDP Act 2023)**, **China (PIPL)** and **Australia (Privacy Act /
Australian Privacy Principles)**. These generally include rights to access,
correct and request deletion of your data and to withdraw consent. Contact us to
exercise them; you may also complain to your national data-protection authority.

### 9.4 Latin & South America

Where applicable, you have rights under laws such as **Brazil's LGPD** — access,
correction, deletion, portability, information about sharing, and the right to
complain to the **ANPD** — and comparable regimes in **Argentina, Chile,
Colombia, Peru and Mexico**.

### 9.5 Africa

Where applicable, you have rights under laws such as **South Africa's POPIA** —
access, correction and deletion, with complaints to the **Information
Regulator** — **Nigeria's NDPA**, and comparable regimes in **Kenya, Egypt,
Morocco and Ghana**.

## 10. Children

VoyageAI is **not directed to children under 16** (the age of digital consent in
Romania and much of the EU under the GDPR). We do not knowingly collect data from
children under this age. If you believe a child has provided personal data,
contact us and we will delete it.

## 11. Security

Passwords (if you create an account) are stored **salted and hashed**, never in
plaintext. However, because account data lives in your browser/device storage,
**anyone with access to your unlocked device could read local data**. Use device
locks and don't share devices. No method of storage or transmission is 100%
secure.

> **Disclosure:** the current build is an early-stage product; on-device auth is
> not a substitute for server-side security. **[Update this section once you move
> auth to a real backend provider.]**

## 12. Changes to this policy

We may update this policy. Material changes will be indicated by updating the
"Last updated" date and, where appropriate, an in-app notice. Continued use
after changes means you accept the updated policy.

## 13. Contact

**[YOUR FULL NAME or REGISTERED BUSINESS NAME]** — **rancea.alexandru99@gmail.com** — **[YOUR ADDRESS]**
