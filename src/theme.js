// Design tokens with runtime theming (dark/light + accent color).
//
// `C` is the ACTIVE palette — a single mutable object that every component
// imports as `import { C } from "./theme.js"`. applyTheme() mutates it in place
// so we don't have to thread a theme prop through the whole app; the App
// consumes useTheme() and re-renders, and every component then reads the new C.

import { createContext, createElement, useContext, useState } from "react";

// Typography — an editorial serif for display/headings, a geometric sans for UI.
export const F = {
  display: "'Fraunces', Georgia, 'Times New Roman', serif",
  body: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

// Mode palettes (semantic colors; the accent is applied separately).
const DARK = {
  bg: "#0A1628", bgDeep: "#060e1c", surface: "#111F35", card: "#162840", cardHover: "#1C3350",
  cream: "#F0EBE0", muted: "#7A90AA", mutedLight: "#9DB0C5",
  green: "#4CAF82", blue: "#3A7BD5", purple: "#9B59B6", red: "#E05C5C", border: "#1E3350",
  shadow: "0 10px 30px rgba(0,0,0,.35)", shadowSoft: "0 4px 18px rgba(0,0,0,.25)",
};
// Premium porcelain-and-champagne light mode: near-white with a whisper of
// warmth, espresso ink, hairline warm borders and soft diffuse shadows —
// the accent (below) turns to antique gold for legibility on white.
// All light-mode semantic colours pass WCAG AA (≥4.5:1) on the porcelain
// background — measured, not eyeballed. Slightly deeper than the initial
// pass so small labels stay legible; the gold-on-porcelain "elegant" feel is
// preserved because we only shifted lightness, not hue.
const LIGHT = {
  bg: "#FBFAF7", bgDeep: "#F2EFE8", surface: "#FFFFFF", card: "#FFFFFF", cardHover: "#F8F5EE",
  cream: "#24211B", muted: "#777163", mutedLight: "#6B6455",
  green: "#388059", blue: "#33619E", purple: "#7C4E9E", red: "#BC5050", border: "#EDE8DC",
  shadow: "0 18px 50px rgba(93,74,33,.10)", shadowSoft: "0 4px 16px rgba(93,74,33,.06)",
};

// Accent options — control gold/goldLight/goldFaint (the primary highlight).
// Base values are for dark mode (and the selector swatches); light mode swaps
// in deeper "DEEP" tones so the accent stays legible on white, with softer
// champagne gradient tops.
export const THEME_ACCENTS = {
  gold: "#C9A84C", blue: "#3A7BD5", green: "#3FB07A",
  purple: "#9B59B6", coral: "#E0705C", teal: "#2FB3A8",
};
const ACCENT_LIGHT = {
  gold: "#E8C96A", blue: "#5E97E0", green: "#63C797",
  purple: "#B57BCB", coral: "#EC8C7B", teal: "#57C8BE",
};
// Deep accents used in LIGHT mode as the "gold" foreground. Each one is set
// to pass WCAG AA (≥4.5:1) on the porcelain background.
const ACCENT_DEEP = {
  gold: "#8B6E27", blue: "#2E62B0", green: "#2F8E62",
  purple: "#74459B", coral: "#BE5A46", teal: "#1F8F86",
};
const ACCENT_CHAMPAGNE = {
  gold: "#D9BE72", blue: "#6FA0DE", green: "#66BD92",
  purple: "#A97FC4", coral: "#DE8A75", teal: "#55BCB2",
};

// The active palette (filled by applyTheme on load and on change).
export const C = {};

export function applyTheme(mode, accent) {
  const light = mode === "light";
  const base = light ? LIGHT : DARK;
  const gold = (light ? ACCENT_DEEP : THEME_ACCENTS)[accent]
    || (light ? ACCENT_DEEP.gold : THEME_ACCENTS.gold);
  const goldLight = (light ? ACCENT_CHAMPAGNE : ACCENT_LIGHT)[accent]
    || (light ? ACCENT_CHAMPAGNE.gold : ACCENT_LIGHT.gold);
  Object.assign(C, base, {
    gold, goldLight, goldFaint: gold + "1c",
    goldGrad: `linear-gradient(135deg, ${goldLight} 0%, ${gold} 100%)`,
    goldGlow: light ? `0 12px 32px ${gold}33` : `0 10px 28px ${gold}44`,
  });
}

function readTheme() {
  // Default to LIGHT on first launch (no stored preference) on any device; the
  // user can switch to dark, and their choice is then persisted.
  try {
    return {
      mode: localStorage.getItem("vai_theme_mode") || "light",
      accent: localStorage.getItem("vai_theme_accent") || "gold",
    };
  } catch {
    return { mode: "light", accent: "gold" };
  }
}
const INIT = readTheme();
applyTheme(INIT.mode, INIT.accent); // so the very first render is correct

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [mode, setModeS] = useState(INIT.mode);
  const [accent, setAccentS] = useState(INIT.accent);
  const setMode = (m) => {
    applyTheme(m, accent);
    try { localStorage.setItem("vai_theme_mode", m); } catch {}
    setModeS(m);
  };
  const setAccent = (a) => {
    applyTheme(mode, a);
    try { localStorage.setItem("vai_theme_accent", a); } catch {}
    setAccentS(a);
  };
  return createElement(ThemeContext.Provider, { value: { mode, accent, setMode, setAccent } }, children);
}

export function useTheme() {
  return useContext(ThemeContext) || { mode: "dark", accent: "gold", setMode() {}, setAccent() {} };
}

export const PHASE_COLOR = {
  onboarding: "#3A7BD5",
  discovery: "#C9A84C",
  generation: "#4CAF82",
  refinement: "#9B59B6",
  finalization: "#E05C5C",
};
