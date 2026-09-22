// Removing the user's own content from an error before it leaves the device.
//
// Copied VERBATIM to mobile-native/src/lib/errorScrub.js, like the other
// shared modules, and checked by a test that fails if the two differ.
//
// An error message is not neutral text. It is built by whatever threw, and
// what threw was often handed a photo caption, a destination someone typed, or
// a file path with their name in it. The privacy policy promises photos never
// leave the device; sending "Failed to decode data:image/jpeg;base64,/9j/4AAQ…"
// to a server would break that promise in the one place nobody thinks to look.
//
// This does not make a report anonymous, and it is not presented as doing so.
// It removes the categories that are both identifiable and predictable.

const MAX_MESSAGE = 500;
const MAX_STACK = 2000;

// Order matters: data URLs before the generic long-run rule, so a base64 blob
// is labelled rather than merely truncated.
const RULES = [
  // A photo, inline. The single worst thing that could be in here.
  [/data:[a-z-]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi, "data:[redactat]"],
  // Email addresses — accounts are local, but an error could still carry one.
  [/[^\s"'<>@]+@[^\s"'<>@]+\.[a-z]{2,}/gi, "[email]"],
  // Absolute paths on the device, which usually contain a user name.
  [/(file|content):\/\/\S+/gi, "[cale]"],
  // Bearer tokens and long hex or base64 runs: keys, ids, session strings.
  [/\bBearer\s+[\w.\-+/=]+/gi, "Bearer [redactat]"],
  [/\b[A-Fa-f0-9]{32,}\b/g, "[hex]"],
];

/** Strip identifiable content from a single string. */
export function scrubText(value) {
  let s = String(value ?? "");
  for (const [re, replacement] of RULES) s = s.replace(re, replacement);
  return s;
}

/**
 * Prepare an error report for sending. Scrubs the free-text fields and caps
 * their length — a stack can be enormous, and nothing past the first frames
 * helps anyone.
 */
export function scrubReport(entry) {
  if (!entry || typeof entry !== "object") return null;
  const out = { ...entry };
  if ("message" in out) out.message = scrubText(out.message).slice(0, MAX_MESSAGE);
  if ("stack" in out) out.stack = scrubText(out.stack).slice(0, MAX_STACK);
  return out;
}

export const LIMITS = { MAX_MESSAGE, MAX_STACK };
