// The 5000-city index, native edition.
//
// Same behaviour as the web module (src/destinations.js) with one deliberate
// difference: the JSON is a static require instead of a dynamic import, because
// Metro resolves requires at build time and has no lazy module loading. The
// file ships inside the bundle, which is what we want — searching for a city
// must work with no network.

import DATA from "../data/destinations.json";
import { selectCitiesInBounds } from "../shared/cityBounds.js";

const normalize = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Endonyms and common exonyms → the English names Wikidata uses. Without these
// "București", "Londra" or "Wien" match nothing and the user drops to a generic
// itinerary for a city we actually have full data for.
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

// Either the user is still typing the alias ("bucu" → "bucuresti"), or it
// appears as a whole word at the start ("roma 2 zile"). The trailing boundary
// matters: a bare prefix test made "românia" match "roma" and return Rome.
function queryHitsAlias(query, key) {
  if (key.startsWith(query)) return true;
  return query === key || query.startsWith(key + " ");
}
function aliasTargets(query) {
  const out = [];
  for (const key in ALIASES) if (queryHitsAlias(query, key)) out.push(normalize(ALIASES[key]));
  return out;
}

export function searchDestinations(q, n = 8) {
  const query = normalize(q);
  if (query.length < 2) return [];
  const queries = [query, ...aliasTargets(query)];
  const scored = new Map(); // id → { d, score }, best score wins
  for (const d of DATA) {
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

// Strict form used by the route tiers: exact name, whole-word name prefix, or
// an alias that maps to this city.
export function nameMatchesCity(query, city) {
  const q = normalize(query);
  const name = normalize(city.n);
  const startsWithWord = (w) => q === w || q.startsWith(w + " ");
  if (startsWithWord(name)) return true;
  for (const key in ALIASES) {
    if (normalize(ALIASES[key]) === name && startsWithWord(key)) return true;
  }
  return false;
}

// Rails for the Home screen. A fresh shuffle each call keeps the feed alive.
function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
export function getTrending(n = 6) {
  return shuffle(DATA.filter((d) => d.t === "mega" || d.t === "major")).slice(0, n);
}
export function getHiddenGems(n = 6) {
  return shuffle(DATA.filter((d) => d.t === "notable" && (d.p || 0) < 60000)).slice(0, n);
}
export function getEuropeWeekend(n = 6) {
  return shuffle(DATA.filter((d) => d.co === "EU" && (d.t === "mega" || d.t === "major"))).slice(0, n);
}

// ---- map exploration -------------------------------------------------------
// Cities inside the visible rectangle, most recognisable first.
//
// The web app asks Supabase for this. Here the whole index is already in
// memory, so it is a filter: no network, no latency, and — unlike the web —
// nothing that can be unreachable. The rules for what a viewport contains and
// what is worth drawing at a given zoom come from a module shared byte-for-byte
// with the web app, so the same pan shows the same cities on both.
//
// Async only for signature parity with the web module, so a screen written
// against one works against the other.
export async function getCitiesInBounds(bounds, opts) {
  return selectCitiesInBounds(DATA, bounds, opts);
}
