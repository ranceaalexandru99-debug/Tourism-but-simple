// SYNCED from ../../../src/ by scripts/sync-native-data.mjs — do not edit here.
// Per-day weather forecast via Open-Meteo (free, no API key, CORS-enabled).
// Returns a map keyed by ISO date → { emoji, code, tmax, tmin }.
// Only days inside the ~16-day forecast window are returned; others are omitted
// and the UI simply shows no weather for them.
//
// Shared byte-for-byte with mobile-native/src/shared/weather.js, and it is here
// because of what happened while it was not. There were two hand-maintained
// copies; the web one was changed to return a `code` the UI localizes, and the
// native one was left returning a Romanian `label`. Every piece around it was
// correct — icons.js maps the codes to sun and lightning glyphs, Route.js reads
// `w.code`, the dictionary carries wx_clear and the rest in all sixteen
// languages — so the result was that `w.code` came back undefined and every day
// of every trip on a phone showed WeatherIcon's Thermometer fallback, while the
// Romanian labels it did compute were displayed nowhere at all.
//
// Open-Meteo needs no key and sets CORS headers, so there is nothing
// platform-specific left in this file.

// Returns an emoji plus a `code` the UI localizes via t("wx_" + code); the
// label itself lives in the i18n dictionary, not here.
export const codeInfo = (c) => {
  if (c === 0) return { emoji: "☀️", code: "clear" };
  if (c <= 3) return { emoji: "⛅", code: "partly" };
  if (c === 45 || c === 48) return { emoji: "🌫", code: "fog" };
  if (c >= 51 && c <= 67) return { emoji: "🌧", code: "rain" };
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return { emoji: "🌨", code: "snow" };
  if (c >= 80 && c <= 82) return { emoji: "🌦", code: "showers" };
  if (c >= 95) return { emoji: "⛈", code: "storm" };
  return { emoji: "🌡", code: "" };
};

export async function fetchWeather(center, startDate, days) {
  if (!Array.isArray(center) || center.length < 2 || !startDate) return {};
  const [lat, lng] = center;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(startDate + "T00:00:00");
  if (isNaN(start)) return {};
  const maxAhead = new Date(today); maxAhead.setDate(maxAhead.getDate() + 15);
  const end = new Date(start); end.setDate(end.getDate() + Math.max(0, (days || 1) - 1));
  if (start > maxAhead || end < today) return {}; // trip outside the forecast window

  const clamp = (d) => (d < today ? today : d > maxAhead ? maxAhead : d);
  const localISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const sISO = localISO(clamp(start));
  const eISO = localISO(clamp(end));

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto` +
    `&start_date=${sISO}&end_date=${eISO}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return {};
    const data = await res.json();
    const d = data.daily;
    if (!d?.time) return {};
    const out = {};
    d.time.forEach((date, i) => {
      out[date] = {
        ...codeInfo(d.weather_code[i]),
        tmax: Math.round(d.temperature_2m_max[i]),
        tmin: Math.round(d.temperature_2m_min[i]),
      };
    });
    return out;
  } catch {
    return {};
  }
}
