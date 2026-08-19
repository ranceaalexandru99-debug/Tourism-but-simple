// Curated destinations index — ~4700 tourism-relevant cities extracted from
// Wikidata (sitelinks >= 40 across Wikipedia languages) with country ISO,
// coordinates, population and a recognition-tier bucket.
//
// The JSON blob (~130 KB gzipped) is loaded lazily on first use so it doesn't
// impact initial page paint. Callers `await` the helpers below.

let _cache = null;
async function load() {
  if (_cache) return _cache;
  const mod = await import("./destinations.json");
  _cache = mod.default;
  return _cache;
}

// Fresh shuffle every call so rails feel dynamic — the UI can rotate content
// on an interval to keep the "trending" feed alive between page visits.
function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Trending — a rotating mix of "major" and "mega" tier: recognisable names,
// good chance we have hero photos on Wikipedia. Not just the top-20 or the
// grid would look identical each session.
export async function getTrending(n = 12) {
  const all = await load();
  const pool = all.filter((d) => d.t === "mega" || d.t === "major");
  return shuffle(pool).slice(0, n);
}

// Hidden gems — decent rank (many wiki articles about them) but small
// population, so they feel like off-the-beaten-path picks.
export async function getHiddenGems(n = 10) {
  const all = await load();
  const pool = all.filter((d) => d.t === "notable" && (d.p || 0) < 60000);
  return shuffle(pool).slice(0, n);
}

// Europe weekend — top-tier European cities with airport-friendly recognition.
export async function getEuropeWeekend(n = 10) {
  const all = await load();
  const pool = all.filter((d) => d.co === "EU" && (d.t === "mega" || d.t === "major"));
  return shuffle(pool).slice(0, n);
}

// Continent slice — used for a "explore <region>" rail.
export async function getByContinent(code, n = 10) {
  const all = await load();
  const pool = all.filter((d) => d.co === code && d.t !== "hidden");
  return shuffle(pool).slice(0, n);
}

// Prefix search — powers the destination autocomplete. Case-insensitive,
// diacritics-insensitive. Returns top N by rank.
// Endonyms + common exonyms → the English names used in the dataset.
// Wikidata labels are English, so "București", "Londra" (RO), "Wien",
// "München" (local), "Londres" (FR/ES) found NOTHING and users fell to the
// generic fake route even though the city has real POIs. Keys are
// diacritics-stripped lowercase (same normalize() as queries).
const ALIASES = {
  // Romanian exonyms (primary audience)
  bucuresti: "Bucharest", londra: "London", viena: "Vienna", praga: "Prague",
  varsovia: "Warsaw", moscova: "Moscow", atena: "Athens", lisabona: "Lisbon",
  copenhaga: "Copenhagen", venetia: "Venice", florenta: "Florence",
  neapole: "Naples", cracovia: "Kraków", budapesta: "Budapest", belgrad: "Belgrade",
  kiev: "Kyiv", "sankt petersburg": "Saint Petersburg", ierusalim: "Jerusalem",
  tokio: "Tokyo", seul: "Seoul", marsilia: "Marseille", nisa: "Nice",
  colonia: "Cologne", geneva: "Geneva", haga: "The Hague", anvers: "Antwerp",
  damasc: "Damascus", bagdad: "Baghdad", teheran: "Tehran", alger: "Algiers",
  salonic: "Thessaloniki", sevilia: "Seville", torino: "Turin", milano: "Milan",
  genova: "Genoa", zurich: "Zurich", munchen: "Munich", edinburg: "Edinburgh",
  // Local endonyms
  wien: "Vienna", praha: "Prague", warszawa: "Warsaw", moskva: "Moscow",
  athina: "Athens", lisboa: "Lisbon", kobenhavn: "Copenhagen", venezia: "Venice",
  firenze: "Florence", napoli: "Naples", krakau: "Kraków", beograd: "Belgrade",
  muenchen: "Munich", koln: "Cologne", "den haag": "The Hague", antwerpen: "Antwerp",
  gent: "Ghent", sevilla: "Seville", roma: "Rome",
  // French / Spanish / German exonyms for big targets
  londres: "London", vienne: "Vienna", varsovie: "Warsaw", moscou: "Moscow",
  athenes: "Athens", lisbonne: "Lisbon", venise: "Venice", napoles: "Naples",
  edimburgo: "Edinburgh", mailand: "Milan", genf: "Geneva", ginevra: "Geneva",
};

// Does a typed query invoke this alias key? Either the user is still typing it
// ("bucu" → "bucuresti"), or the key appears as a whole word at the start
// ("roma 2 zile" → "roma"). The trailing word boundary matters: a bare prefix
// test made "românia" match the key "roma" and hand back Rome.
function queryHitsAlias(query, key) {
  if (key.startsWith(query)) return true;          // still typing the alias
  return query === key || query.startsWith(key + " ");
}

// Expand a normalized query into itself + any alias targets it points at.
function aliasTargets(query) {
  const out = [];
  for (const key in ALIASES) {
    if (queryHitsAlias(query, key)) out.push(normalize(ALIASES[key]));
  }
  return out;
}

export async function searchDestinations(q, n = 8) {
  const query = normalize(q);
  if (query.length < 2) return [];
  const all = await load();
  const queries = [query, ...aliasTargets(query)];
  const scored = new Map(); // id → { d, score }, best score wins
  for (const d of all) {
    const name = normalize(d.n);
    for (const qq of queries) {
      let score = 0;
      if (name.startsWith(qq)) score = d.r + 1000;
      else if (name.includes(qq)) score = d.r;
      if (score > 0 && score > (scored.get(d.id)?.score || 0)) scored.set(d.id, { d, score });
    }
  }
  return [...scored.values()].sort((a, b) => b.score - a.score).slice(0, n).map((s) => s.d);
}

// Does this typed name refer to this city? Strict form used by the route
// tiers: exact name, name-prefix, or an alias that maps to the city.
export function nameMatchesCity(query, city) {
  const q = normalize(query);
  const name = normalize(city.n);
  // Whole-word only, both for the city name and for aliases: "românia" must
  // not resolve to Rome, while "roma 2 zile" still must.
  const startsWithWord = (w) => q === w || q.startsWith(w + " ");
  if (startsWithWord(name)) return true;
  for (const key in ALIASES) {
    if (normalize(ALIASES[key]) === name && startsWithWord(key)) return true;
  }
  return false;
}

function normalize(s) {
  return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
