// The contract for AI route generation, shared verbatim by the browser client
// (src/aiEngine.js) and the API server (server/index.js).
//
// Everything here must stay dependency-free and environment-neutral: no DOM, no
// React, no `import.meta.env`, no Node built-ins. The server imports this file
// directly, so anything browser-only would crash it on boot.
//
// The client sends preferences; the server turns them into the prompt below and
// calls Claude. Keeping the schema and the prompt in one place means the two
// sides can never disagree about the shape of a destination.

// Model + limits, kept here so client and server describe the same request.
// max_tokens is generous because the schema asks for up to 32 POIs, each with
// name/tags/hours/tip/coords — 4000 truncated the JSON on richer cities, and a
// truncated payload only surfaced later as a parse error.
export const MODEL = "claude-opus-4-8";
export const MAX_TOKENS = 8000;

export const SYSTEM_PROMPT =
  "Ești un expert în turism care creează itinerarii personalizate. " +
  "Răspunzi DOAR cu datele structurate cerute, cu informații reale și precise.";

// Language name (in English) injected into the prompt so Claude writes the
// user-visible fields in the language they picked. i18n.js re-exports this so
// the app keeps a single source for it.
export const LANG_NAME = {
  en: "English", ro: "Romanian", fr: "French", es: "Spanish", it: "Italian",
  de: "German", pt: "Portuguese", nl: "Dutch", pl: "Polish", el: "Greek",
  tr: "Turkish", uk: "Ukrainian", ru: "Russian", zh: "Simplified Chinese",
  ja: "Japanese", ko: "Korean",
};

// JSON schema for the destination Claude must return — mirrors a DESTINATIONS
// entry in mockEngine.js. Structured outputs guarantee it parses cleanly.
export const DEST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    country: { type: "string" },
    emoji: { type: "string" },
    blurb: { type: "string" },
    center: { type: "array", items: { type: "number" } },
    pois: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          emoji: { type: "string" },
          tags: { type: "array", items: { type: "string", enum: ["culture", "food", "nature", "nightlife", "shopping", "family"] } },
          dur: { type: "number" },
          hours: { type: "string" },
          cost: { type: "number" },
          tip: { type: "string" },
          ll: { type: "array", items: { type: "number" } },
        },
        required: ["name", "emoji", "tags", "dur", "hours", "cost", "tip", "ll"],
      },
    },
    food: { type: "array", items: { type: "string" } },
    transport: { type: "string" },
  },
  required: ["name", "country", "emoji", "blurb", "center", "pois", "food", "transport"],
};

export const INTEREST_LABELS = {
  culture: "cultură/istorie", food: "gastronomie", nature: "natură",
  nightlife: "viață de noapte", shopping: "shopping", family: "activități de familie",
};

// Build the user prompt from the caller's preferences.
// `lang` is a language CODE ("ro", "ja", …); anything unknown falls back to
// English, so a malformed value can't inject an arbitrary string into the
// prompt — only a name from LANG_NAME ever reaches Claude.
export function buildPrompt(prefs, lang = "en") {
  const interests = (prefs.interests || []).map((i) => INTEREST_LABELS[i] || i).join(", ") || "variat";
  const flex = prefs.days === "flex";
  const days = flex ? 4 : Math.max(1, Math.min(7, Number(prefs.days) || 2));
  const nPois = flex ? 16 : Math.min(32, Math.max(8, days * 4));
  const lines = [
    `Destinație cerută de utilizator: "${prefs.destination}".`,
    `Număr de zile: ${flex ? "flexibil" : days}.`,
    `Interese principale: ${interests}.`,
    `Ritm preferat: ${prefs.pace || "balanced"}.`,
  ];
  if (prefs.instruction) lines.push(`Cerere suplimentară de la utilizator: "${prefs.instruction}".`);
  const langName = LANG_NAME[lang] || "English";
  lines.push(
    "",
    `Generează datele pentru această destinație: ${nPois} obiective turistice reale,`,
    "cu coordonate GPS corecte [lat, lng], durată recomandată în minute,",
    "program de vizitare, cost bilet în EUR (0 dacă e gratuit) și un sfat local util.",
    "Pune accent pe obiectivele care se potrivesc cu interesele de mai sus.",
    "Include 4 recomandări de mâncare locală și o notă scurtă despre transport.",
    `Write ALL text fields (name, blurb, tip, hours, food, transport, country) in ${langName}. Tips should sound like advice from a local.`,
  );
  return lines.join("\n");
}

// Reject junk before it reaches Claude. Returns an error string, or null when
// the payload is usable. The server is the trust boundary — the browser can
// send anything.
export function validatePrefs(prefs) {
  if (!prefs || typeof prefs !== "object") return "prefs must be an object";
  const dest = typeof prefs.destination === "string" ? prefs.destination.trim() : "";
  if (dest.length < 2) return "destination is required";
  if (dest.length > 120) return "destination is too long";
  if (prefs.instruction != null && String(prefs.instruction).length > 500) return "instruction is too long";
  if (prefs.interests != null && !Array.isArray(prefs.interests)) return "interests must be an array";
  if (Array.isArray(prefs.interests) && prefs.interests.length > 6) return "too many interests";
  return null;
}
