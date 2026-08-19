// Generate the public legal pages from src/legal.js — the same text the app
// shows, so the hosted documents can never drift from the in-app ones.
//
//   node scripts/build-legal-pages.mjs
//
// Writes public/privacy.html, public/terms.html, public/delete-account.html.
// Each page carries both languages (EN + RO) so a single URL satisfies store
// reviewers and Romanian users alike. Both stores require a reachable privacy
// URL; Google Play additionally requires an account-deletion URL.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { LEGAL, ACCOUNT_DELETION, LEGAL_CONTACT_EMAIL } from "../src/legal.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, "public");
const APP = "Turism, dar simplu!";

const esc = (s) => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Porcelain + antique-gold, matching the app. Self-contained, no requests.
const CSS = `
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 0 20px 72px;
    font: 16px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #FBFAF7; color: #2A2C31;
  }
  .wrap { max-width: 720px; margin: 0 auto; }
  header { padding: 44px 0 8px; }
  .brand { font: italic 700 15px/1 Georgia, serif; color: #8B6E27; letter-spacing: .3px; }
  h1 { font: 700 32px/1.2 Georgia, serif; margin: 14px 0 6px; letter-spacing: -.4px; }
  .updated { color: #777163; font-size: 13px; }
  h2 { font: 700 21px/1.3 Georgia, serif; margin: 40px 0 4px; letter-spacing: -.2px; }
  h3 { font-size: 15px; font-weight: 700; color: #8B6E27; margin: 22px 0 4px; }
  p { margin: 0 0 10px; }
  .lang { border-top: 1px solid #E7E2D6; margin-top: 52px; padding-top: 8px; }
  footer {
    margin-top: 44px; padding-top: 16px; border-top: 1px solid #E7E2D6;
    color: #777163; font-size: 13px;
  }
  a { color: #8B6E27; }
  @media (prefers-color-scheme: dark) {
    body { background: #101114; color: #E6E4DE; }
    h3 { color: #B8983F; } a { color: #B8983F; }
    .brand { color: #B8983F; }
    .updated, footer { color: #98917F; }
    .lang, footer { border-color: #26282D; }
  }
`;

const page = (title, bodyHtml) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — ${esc(APP)}</title>
<meta name="robots" content="index,follow">
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
${bodyHtml}
<footer>
  ${esc(APP)} · <a href="mailto:${LEGAL_CONTACT_EMAIL}">${LEGAL_CONTACT_EMAIL}</a><br>
  <a href="/privacy.html">Privacy</a> · <a href="/terms.html">Terms</a> ·
  <a href="/delete-account.html">Delete account</a> · <a href="/">App</a>
</footer>
</div>
</body>
</html>
`;

const sections = (items) =>
  items.map(([h, body]) => `<h3>${esc(h)}</h3>\n<p>${esc(body)}</p>`).join("\n");

// --- privacy + terms: one page each, EN then RO --------------------------
function docPage(kind) {
  const titleKey = kind === "privacy" ? "privacyTitle" : "termsTitle";
  const html = ["en", "ro"].map((lang, i) => {
    const L = LEGAL[lang];
    return `
<section class="${i ? "lang" : ""}">
  ${i ? "" : `<header><div class="brand">${esc(APP)}</div>`}
  ${i ? `<h2>${esc(L[titleKey])} (română)</h2>` : `<h1>${esc(L[titleKey])}</h1>`}
  <p class="updated">${esc(L.updated)}</p>
  ${i ? "" : "</header>"}
  ${sections(L[kind])}
</section>`;
  }).join("\n");
  return page(LEGAL.en[titleKey], html);
}

// --- account deletion ----------------------------------------------------
function deletionPage() {
  const html = ["en", "ro"].map((lang, i) => {
    const D = ACCOUNT_DELETION[lang];
    return `
<section class="${i ? "lang" : ""}">
  ${i ? "" : `<header><div class="brand">${esc(APP)}</div>`}
  ${i ? `<h2>${esc(D.title)} (română)</h2>` : `<h1>${esc(D.title)}</h1>`}
  ${i ? "" : "</header>"}
  <p>${esc(D.intro)}</p>
  ${sections(D.steps)}
  <p>${esc(D.retention)}</p>
  <p>${esc(D.help)}</p>
</section>`;
  }).join("\n");
  return page(ACCOUNT_DELETION.en.title, html);
}

fs.mkdirSync(OUT, { recursive: true });
const files = {
  "privacy.html": docPage("privacy"),
  "terms.html": docPage("terms"),
  "delete-account.html": deletionPage(),
};
for (const [name, html] of Object.entries(files)) {
  fs.writeFileSync(path.join(OUT, name), html);
  console.log(`  ✓ public/${name}  (${(html.length / 1024).toFixed(1)} KB)`);
}
console.log("\nPagini legale generate din src/legal.js");
