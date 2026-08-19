// Currency conversion (rates fixed against EUR — good enough for a rough
// budget hint; not intended as live FX).
// `after` puts the symbol after the number (RON convention: "11.630 lei").
// `locale` controls the thousands separator (ro-RO → "11.630", en-US → "11,630").
export const CURRENCIES = {
  EUR: { symbol: "€",   rate: 1,    flag: "🇪🇺", locale: "en-US" },
  USD: { symbol: "$",   rate: 1.08, flag: "🇺🇸", locale: "en-US" },
  GBP: { symbol: "£",   rate: 0.85, flag: "🇬🇧", locale: "en-US" },
  RON: { symbol: "lei", rate: 4.97, flag: "🇷🇴", locale: "ro-RO", after: true },
  JPY: { symbol: "¥",   rate: 170,  flag: "🇯🇵", locale: "ja-JP" },
};

export function convert(eur, code) {
  const c = CURRENCIES[code] || CURRENCIES.EUR;
  const num = Math.round(eur * c.rate).toLocaleString(c.locale || "en-US");
  // Symbol after (with a space) for RON; before for the rest.
  return c.after ? `${num} ${c.symbol}` : `${c.symbol}${num}`;
}

// A tiny 5-phrase survival kit per country. Only the languages a traveler is
// most likely to need at the counter — hello, thanks, "how much", toilets, help.
// Keys map to the localized country name AS IT APPEARS in the route (mockEngine
// uses Romanian names) plus the English name.
const PHRASE_SETS = {
  es: { name: "Español", flag: "🇪🇸", phrases: { hello: "Hola", thanks: "Gracias", howmuch: "¿Cuánto cuesta?", toilet: "Baño", help: "Ayuda" } },
  it: { name: "Italiano", flag: "🇮🇹", phrases: { hello: "Ciao", thanks: "Grazie", howmuch: "Quanto costa?", toilet: "Bagno", help: "Aiuto" } },
  fr: { name: "Français", flag: "🇫🇷", phrases: { hello: "Bonjour", thanks: "Merci", howmuch: "Combien ?", toilet: "Toilettes", help: "Aide" } },
  de: { name: "Deutsch", flag: "🇩🇪", phrases: { hello: "Hallo", thanks: "Danke", howmuch: "Wie viel?", toilet: "Toilette", help: "Hilfe" } },
  pt: { name: "Português", flag: "🇵🇹", phrases: { hello: "Olá", thanks: "Obrigado", howmuch: "Quanto custa?", toilet: "Banheiro", help: "Ajuda" } },
  nl: { name: "Nederlands", flag: "🇳🇱", phrases: { hello: "Hallo", thanks: "Dank je", howmuch: "Hoeveel?", toilet: "Toilet", help: "Help" } },
  ja: { name: "日本語", flag: "🇯🇵", phrases: { hello: "Konnichiwa", thanks: "Arigatō", howmuch: "Ikura desu ka?", toilet: "Toire", help: "Tasukete" } },
  zh: { name: "中文", flag: "🇨🇳", phrases: { hello: "Nǐ hǎo", thanks: "Xièxie", howmuch: "Duōshǎo qián?", toilet: "Cèsuǒ", help: "Bāngzhù" } },
  th: { name: "ไทย", flag: "🇹🇭", phrases: { hello: "Sawadee", thanks: "Khob khun", howmuch: "Tao rai?", toilet: "Hong nam", help: "Chuay duay" } },
  ar: { name: "العربية", flag: "🇲🇦", phrases: { hello: "Marhaban", thanks: "Shukran", howmuch: "Bikam?", toilet: "Hammam", help: "Musa'ada" } },
  tr: { name: "Türkçe", flag: "🇹🇷", phrases: { hello: "Merhaba", thanks: "Teşekkürler", howmuch: "Ne kadar?", toilet: "Tuvalet", help: "Yardım" } },
  el: { name: "Ελληνικά", flag: "🇬🇷", phrases: { hello: "Γεια", thanks: "Ευχαριστώ", howmuch: "Πόσο κοστίζει;", toilet: "Τουαλέτα", help: "Βοήθεια" } },
  ru: { name: "Русский", flag: "🇷🇺", phrases: { hello: "Privet", thanks: "Spasibo", howmuch: "Skol'ko?", toilet: "Tualet", help: "Pomogite" } },
  pl: { name: "Polski", flag: "🇵🇱", phrases: { hello: "Dzień dobry", thanks: "Dziękuję", howmuch: "Ile kosztuje?", toilet: "Toaleta", help: "Pomocy" } },
  he: { name: "עברית", flag: "🇮🇱", phrases: { hello: "Shalom", thanks: "Toda", howmuch: "Kama ze ole?", toilet: "Sherutim", help: "Ezra" } },
  hi: { name: "हिन्दी", flag: "🇮🇳", phrases: { hello: "Namaste", thanks: "Dhanyavaad", howmuch: "Kitne ka hai?", toilet: "Shauchalay", help: "Madad" } },
};

// Loose country → language mapping. Both Romanian (mockEngine default) and
// English variants included so it matches whatever the AI or mock produces.
const COUNTRY_TO_LANG = {
  "Spania": "es", "Spain": "es", "España": "es",
  "Italia": "it", "Italy": "it",
  "Franța": "fr", "France": "fr",
  "Germania": "de", "Germany": "de", "Austria": "de", "Elveția": "de", "Switzerland": "de",
  "Portugalia": "pt", "Portugal": "pt", "Brazilia": "pt", "Brazil": "pt",
  "Olanda": "nl", "Netherlands": "nl",
  "Japonia": "ja", "Japan": "ja",
  "China": "zh",
  "Thailanda": "th", "Thailand": "th",
  "Maroc": "ar", "Morocco": "ar", "Emiratele Arabe": "ar", "UAE": "ar", "Egipt": "ar", "Egypt": "ar",
  "Turcia": "tr", "Turkey": "tr",
  "Grecia": "el", "Greece": "el",
  "Rusia": "ru", "Russia": "ru",
  "Polonia": "pl", "Poland": "pl",
  "Israel": "he",
  "India": "hi",
};

export function phrasesFor(country) {
  const lang = COUNTRY_TO_LANG[country];
  return lang ? PHRASE_SETS[lang] : null;
}

// Practical arrival-day info: emergency number, plug type, primary IANA time
// zone. Kept in one table so `goodToKnow(country)` returns a ready-to-render
// object with `hoursFromUser` computed live against the user's own zone.
const COUNTRY_INFO = {
  "Spania":   { emergency: "112", plug: "C / F", tz: "Europe/Madrid", flag: "🇪🇸" },
  "Italia":   { emergency: "112", plug: "C / F / L", tz: "Europe/Rome", flag: "🇮🇹" },
  "Franța":   { emergency: "112", plug: "C / E", tz: "Europe/Paris", flag: "🇫🇷" },
  "Germania": { emergency: "112", plug: "C / F", tz: "Europe/Berlin", flag: "🇩🇪" },
  "Portugalia": { emergency: "112", plug: "C / F", tz: "Europe/Lisbon", flag: "🇵🇹" },
  "Olanda":   { emergency: "112", plug: "C / F", tz: "Europe/Amsterdam", flag: "🇳🇱" },
  "Grecia":   { emergency: "112", plug: "C / F", tz: "Europe/Athens", flag: "🇬🇷" },
  "Polonia":  { emergency: "112", plug: "C / E", tz: "Europe/Warsaw", flag: "🇵🇱" },
  "Austria":  { emergency: "112", plug: "C / F", tz: "Europe/Vienna", flag: "🇦🇹" },
  "Elveția":  { emergency: "112", plug: "C / J", tz: "Europe/Zurich", flag: "🇨🇭" },
  "România":  { emergency: "112", plug: "C / F", tz: "Europe/Bucharest", flag: "🇷🇴" },
  "Marea Britanie": { emergency: "999 / 112", plug: "G", tz: "Europe/London", flag: "🇬🇧" },
  "Turcia":   { emergency: "112", plug: "C / F", tz: "Europe/Istanbul", flag: "🇹🇷" },
  "Rusia":    { emergency: "112", plug: "C / F", tz: "Europe/Moscow", flag: "🇷🇺" },
  "Japonia":  { emergency: "110 / 119", plug: "A / B", tz: "Asia/Tokyo", flag: "🇯🇵" },
  "China":    { emergency: "110 / 120", plug: "A / I / C", tz: "Asia/Shanghai", flag: "🇨🇳" },
  "Thailanda":{ emergency: "191 / 1669", plug: "A / B / C", tz: "Asia/Bangkok", flag: "🇹🇭" },
  "India":    { emergency: "112", plug: "C / D / M", tz: "Asia/Kolkata", flag: "🇮🇳" },
  "Israel":   { emergency: "100 / 101", plug: "C / H", tz: "Asia/Jerusalem", flag: "🇮🇱" },
  "Emiratele Arabe": { emergency: "999 / 998", plug: "G", tz: "Asia/Dubai", flag: "🇦🇪" },
  "SUA":      { emergency: "911", plug: "A / B", tz: "America/New_York", flag: "🇺🇸" },
  "Brazilia": { emergency: "190 / 192", plug: "N / C", tz: "America/Sao_Paulo", flag: "🇧🇷" },
  "Maroc":    { emergency: "19 / 15", plug: "C / E", tz: "Africa/Casablanca", flag: "🇲🇦" },
  "Egipt":    { emergency: "122 / 123", plug: "C / F", tz: "Africa/Cairo", flag: "🇪🇬" },
  "Australia":{ emergency: "000", plug: "I", tz: "Australia/Sydney", flag: "🇦🇺" },
};

// Just the flag, or an empty string if the country isn't in the table. Useful
// for prefixing trip titles without pulling the whole `goodToKnow` record.
export function countryFlag(country) {
  return COUNTRY_INFO[country]?.flag || "";
}

// Hour offset between the destination TZ and the user's own TZ. Positive means
// destination is ahead. Sampled with a fixed reference date; DST-aware.
function hoursFromUserTz(tz) {
  if (!tz) return null;
  try {
    const ref = new Date();
    const local = new Date(ref.toLocaleString("en-US"));
    const there = new Date(ref.toLocaleString("en-US", { timeZone: tz }));
    return Math.round((there - local) / 3600000);
  } catch { return null; }
}

export function goodToKnow(country) {
  const info = COUNTRY_INFO[country];
  if (!info) return null;
  return { ...info, hoursFromUser: hoursFromUserTz(info.tz) };
}

