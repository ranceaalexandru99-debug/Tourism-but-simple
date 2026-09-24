// Matching a typed name to a city.
//
// Shared byte-for-byte with mobile-native/src/shared/citySearch.js. The alias
// table existed twice before this — once per platform — and a table of
// exonyms that two copies disagree about is a table where "Viena" finds Vienna
// on one and nothing on the other.
//
// normalize() must also match migrate-cities-to-supabase.mjs, which writes
// cities.name_norm with this exact transform. If those drift, every search
// against the database stops matching.

export const normalize = (s) =>
  String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Endonyms and common exonyms → the English names Wikidata uses. Without these
// "București", "Londra" or "Wien" match nothing and the user drops to a generic
// itinerary for a city we actually have full data for.
export const ALIASES = {
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
export function queryHitsAlias(query, key) {
  if (key.startsWith(query)) return true;
  return query === key || query.startsWith(key + " ");
}

// Every English name the query could be reaching for, normalized.
export function aliasTargets(query) {
  const out = [];
  for (const key in ALIASES) if (queryHitsAlias(query, key)) out.push(normalize(ALIASES[key]));
  return out;
}

/**
 * Search a list of cities already in memory.
 *
 * A prefix match always beats a mere substring, and rank breaks the tie — "par"
 * should surface Paris, not Paramaribo. The database path re-ranks its results
 * with the same rule, because SQL can order by rank but not by how well a name
 * matched.
 *
 * @param cities the index to search
 * @param q      what the user typed
 * @param n      how many to return
 */
export function searchLocal(cities, q, n = 8) {
  const query = normalize(q).trim();
  if (query.length < 2) return [];
  const queries = [query, ...aliasTargets(query)];

  const scored = new Map(); // id → { d, score }, best score wins
  for (const d of cities || []) {
    // A row without a name cannot match anything, and reading through it throws
    // — which on the web now matters, because this also serves a lazily loaded
    // fallback file rather than only the index compiled into the bundle.
    if (!d || typeof d.n !== "string") continue;
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

// Does this typed name refer to this city? Strict, synchronous, and pure — the
// route tiers call it to decide whether a search hit is really what the user
// asked for. Exact name, whole-word name prefix, or an alias mapping to it.
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
