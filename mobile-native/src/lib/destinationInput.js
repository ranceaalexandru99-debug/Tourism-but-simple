// The text handling behind the destination field.
//
// The field holds one free-text sentence — "Rome, 3 days, food and a bit of
// history" — of which only the part before the first comma is a place. Getting
// that split wrong means autocomplete searches for "3 days" and replacing a
// picked city wipes everything the user wrote about their trip.

/**
 * The destination phrase: everything before the first comma.
 * After it come the details, which are not part of a city name.
 */
export function headOf(text) {
  return (String(text ?? "").split(",")[0] || "").trim();
}

/**
 * Replace only the destination, leaving the details untouched.
 * "Rom, 3 days" + "Rome" → "Rome, 3 days"
 */
export function replaceHead(text, name) {
  const s = String(text ?? "");
  const rest = s.includes(",") ? "," + s.split(",").slice(1).join(",") : "";
  return `${name}${rest}`;
}

/**
 * Whether to look anything up at all.
 *
 * Two cases where the answer is no: too little typed to mean anything, and a
 * head that already equals the destination the user picked — otherwise the list
 * reopens over what they are writing, every time they add a detail.
 */
export function shouldSuggest(text, picked, min = 2) {
  const head = headOf(text);
  if (head.length < min) return false;
  if (picked && head.toLowerCase() === String(picked).toLowerCase()) return false;
  return true;
}
