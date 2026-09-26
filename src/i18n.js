// Lightweight i18n: a flat string dictionary per language + a t() helper with
// {var} interpolation, exposed through a tiny React context. The chosen language
// is persisted in localStorage and also read by aiEngine (for prompt language).
//
// The dictionaries themselves live in src/i18n/<lang>.js, one file each, and
// those files are the source of truth — edit the wording there. They were
// derived once from the combined table this file used to hold; that table is in
// the history if it is ever wanted.
//
// Why they are split at all, measured: all sixteen together were 102 KB
// gzipped, the second largest thing the browser downloaded, out of 377 KB for
// the entire app — and a reader uses one of them. English is still eager,
// because it is the fallback for any key a translation lacks and the app has to
// render something before a chosen language arrives. The rest are fetched when
// picked.
//
// The native app keeps its single combined dictionary: Metro bundles everything
// into one file regardless, so there is nothing to defer there and splitting it
// would only add a second code path to get wrong.

import { createContext, createElement, useContext, useState, useCallback, useEffect } from "react";
import en from "./i18n/en.js";

export const LANGS = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "ro", label: "Română", flag: "🇷🇴" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "pt", label: "Português", flag: "🇵🇹" },
  { code: "nl", label: "Nederlands", flag: "🇳🇱" },
  { code: "pl", label: "Polski", flag: "🇵🇱" },
  { code: "el", label: "Ελληνικά", flag: "🇬🇷" },
  { code: "tr", label: "Türkçe", flag: "🇹🇷" },
  { code: "uk", label: "Українська", flag: "🇺🇦" },
  { code: "ru", label: "Русский", flag: "🇷🇺" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "ko", label: "한국어", flag: "🇰🇷" },
];

// Language name (in English) used in the AI prompt so Claude writes content in
// the selected language. It lives in the shared route contract because the API
// server needs it too and must not import this (React-dependent) module.
export { LANG_NAME } from "./shared/routeSchema.js";
import { LANG_NAME } from "./shared/routeSchema.js";

const LS_KEY = "vai_lang";

export function getLang() {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved && LANG_NAME[saved]) return saved;
    const nav = (navigator.language || "en").slice(0, 2);
    if (LANG_NAME[nav]) return nav;
  } catch {}
  return "en";
}

// One static import() per language, so the bundler can see every one of them
// and emit a chunk. A computed path would defeat that and pull the lot back in.
const LOADERS = {
  en: () => Promise.resolve({ default: en }),
  ro: () => import("./i18n/ro.js"),
  fr: () => import("./i18n/fr.js"),
  es: () => import("./i18n/es.js"),
  it: () => import("./i18n/it.js"),
  de: () => import("./i18n/de.js"),
  pt: () => import("./i18n/pt.js"),
  nl: () => import("./i18n/nl.js"),
  pl: () => import("./i18n/pl.js"),
  el: () => import("./i18n/el.js"),
  tr: () => import("./i18n/tr.js"),
  uk: () => import("./i18n/uk.js"),
  ru: () => import("./i18n/ru.js"),
  zh: () => import("./i18n/zh.js"),
  ja: () => import("./i18n/ja.js"),
  ko: () => import("./i18n/ko.js"),
};

const loaded = { en };
const inflight = {};

/**
 * Make a language available to t(). Resolves once its dictionary is in memory.
 *
 * A failure — offline mid-session, a chunk that 404s after a redeploy — leaves
 * the language unloaded, and every lookup falls through to English. That is a
 * worse-looking app, not a broken one, which is the right way for this to fail.
 */
export function loadLanguage(code) {
  if (loaded[code]) return Promise.resolve(loaded[code]);
  const load = LOADERS[code];
  if (!load) return Promise.resolve(en);
  if (!inflight[code]) {
    inflight[code] = load()
      .then((m) => { loaded[code] = m.default; return m.default; })
      .catch(() => en)
      .finally(() => { delete inflight[code]; });
  }
  return inflight[code];
}

export function isLanguageLoaded(code) {
  return Boolean(loaded[code]);
}

const lookup = (lang, key) => {
  const dict = loaded[lang] || en;
  return dict[key] ?? en[key] ?? key;
};

// For callers outside React. A language still loading falls back to English
// rather than waiting: this is synchronous by contract.
export function tStatic(key) {
  return lookup(getLang(), key);
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(getLang);
  // Bumped when a dictionary arrives, purely to re-render with it. Without
  // this, switching language would change `lang` before its strings existed and
  // the screen would keep showing English until something else re-rendered.
  const [, setReady] = useState(0);

  useEffect(() => {
    if (isLanguageLoaded(lang)) return;
    let alive = true;
    loadLanguage(lang).then(() => { if (alive) setReady((n) => n + 1); });
    return () => { alive = false; };
  }, [lang]);

  const setLang = useCallback((code) => {
    // Fetch first, switch second, so the interface never flashes through
    // English on its way to the language someone just chose.
    loadLanguage(code).then(() => {
      setLangState(code);
      try { localStorage.setItem(LS_KEY, code); } catch {}
    });
  }, []);

  const t = useCallback((key, vars) => {
    let s = lookup(lang, key);
    if (vars) for (const k in vars) s = s.replaceAll(`{${k}}`, vars[k]);
    return s;
  }, [lang, loaded[lang]]);

  return createElement(I18nContext.Provider, { value: { lang, setLang, t } }, children);
}

export function useI18n() {
  return useContext(I18nContext) || { lang: "en", setLang: () => {}, t: (k) => k };
}

// Builds the localized trip title from structured route fields.
export function tripTitle(route, t) {
  if (!route) return "";
  const theme = t("theme" + (route.themeKey || "essential"));
  const dayWord = t(route.days === 1 ? "dayOne" : "dayMany");
  return `${route.destName} ${theme} · ${route.days} ${dayWord}`;
}
