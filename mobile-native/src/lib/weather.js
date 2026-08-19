// Per-day weather forecast via Open-Meteo (free, no API key, CORS-enabled).
// Returns a map keyed by ISO date → { emoji, label, tmax, tmin }.
// Only days inside the ~16-day forecast window are returned; others are omitted
// and the UI simply shows no weather for them.

const codeInfo = (c) => {
  if (c === 0) return { emoji: "☀️", label: "senin" };
  if (c <= 3) return { emoji: "⛅", label: "parțial noros" };
  if (c === 45 || c === 48) return { emoji: "🌫", label: "ceață" };
  if (c >= 51 && c <= 67) return { emoji: "🌧", label: "ploaie" };
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return { emoji: "🌨", label: "ninsoare" };
  if (c >= 80 && c <= 82) return { emoji: "🌦", label: "averse" };
  if (c >= 95) return { emoji: "⛈", label: "furtună" };
  return { emoji: "🌡", label: "" };
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
