# Legal — launch checklist

This folder contains the launch-grade legal documents for VoyageAI:

- [`PRIVACY.md`](./PRIVACY.md) — Privacy Policy (GDPR / CCPA aware)
- [`TERMS.md`](./TERMS.md) — Terms & Conditions

They are **tailored to how the app actually works** (client-side storage, Claude
AI, optional geolocation, local photos, shared-link trips, third-party map/
weather/photo services). They are **templates, not legal advice**.

**Regional coverage.** Both documents now include region-specific sections for a
worldwide launch: **EU/EEA + Romania, UK, USA, Asia-Pacific, Latin/South America
and Africa** (Privacy §5 and §9; Terms §13). Governing law stays **Romania**,
with a carve-out that each user's non-excludable local consumer/data-protection
rights prevail. This is the standard structure for a global consumer app — but
each named regime (LGPD, CCPA/CPRA, POPIA, PIPL, DPDP, APPI, etc.) should still
be validated by a lawyer for your specific markets before launch.

## Before you launch — do all of this

1. **Have a lawyer review both documents.** This is the single most important
   step. Consumer-protection, liability caps, arbitration, and age limits differ
   by country and must be localised. Do not skip this.

2. **Fill in the remaining `[BRACKETED]` placeholders.** As of 4 July 2026 the
   following defaults are already applied for the Romanian/EU market and can be
   changed if your lawyer advises otherwise:
   - Effective / Last updated date → **4 July 2026**
   - Governing law → **Romania**; EU ODR link included
   - Minimum age → **16** (EU digital-consent age)
   - Liability cap → **EUR 50**

   Still to complete (only you know these):
   - `[YOUR FULL NAME or REGISTERED BUSINESS NAME]` — in both docs
   - `[YOUR ADDRESS]` — in both docs
   - `[CUI / COMPANY / VAT NO.]` in `PRIVACY.md` §1 — **only** if you register as
     a PFA or SRL; delete that clause if you operate as a private individual
   - `[YOUR CITY]` for jurisdiction — `TERMS.md` §13
   - `[HOSTING/CDN PROVIDER]` and its log-retention period — `PRIVACY.md` §4 & §6,
     once you choose a host (Vercel recommended; logs ~30 days)

3. **Confirm the AI data flow.** The Privacy Policy states destination +
   preferences are sent to Anthropic (US). If you launch with the API key
   proxied server-side, keep this accurate; if AI is disabled, adjust it.

4. **Host both documents at public URLs.** App Store and Google Play **require**
   a publicly reachable Privacy Policy URL. Recommended:
   - `https://[your-domain]/privacy`
   - `https://[your-domain]/terms`
   Rendering these Markdown files as simple pages is enough.

5. **Put the URLs in the right places:**
   - App Store Connect → App Privacy → Privacy Policy URL
   - Google Play Console → Store listing / Data safety → Privacy Policy URL
   - In-app: the "Privacy & Terms" sheet (see `src/components/LegalSheet.jsx`)
     currently shows a short summary; add a "Read the full policy" link to the
     hosted URLs.

6. **Complete the store data-safety questionnaires** to match this policy:
   - Apple "App Privacy" nutrition labels
   - Google Play "Data safety" form
   Declare: data stored on device; destination/preferences sent to an AI
   provider; optional location; no ads/tracking; no data sold.

7. **If you add analytics or any non-essential cookies later**, add a compliant
   consent banner and update the Privacy Policy's cookies section.

8. **Keep records.** Note the date each version goes live; keep old versions.

## Keeping the in-app text in sync

The in-app summary lives in `src/components/LegalSheet.jsx` (EN + RO). When you
finalise these documents, update that summary's wording and its "Last updated"
date so the short in-app version and the full hosted version agree.
