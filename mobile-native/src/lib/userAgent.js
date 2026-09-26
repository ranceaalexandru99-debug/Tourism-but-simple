// The User-Agent this app sends to Wikimedia.
//
// Why it has to exist: React Native's networking on Android identifies itself
// as okhttp, and Wikimedia refuses that. Measured against the three endpoints
// photos.js uses, plus the host the photos themselves come from:
//
//   ro.wikipedia.org       okhttp 403   browser 200
//   commons.wikimedia.org  okhttp 403   browser 200
//   thumb.wikimedia.org    okhttp 403   browser 200
//
// That last line is the one that is easy to miss. Fixing only the JSON requests
// leaves every <Image> still failing, because React Native loads images through
// its own client with its own user agent — so PoiImage passes these headers on
// the image source too.
//
// The web app never hit this: a browser sends its own user agent, and a browser
// also forbids overriding it, which is why this lives on the native side only.
//
// Wikimedia's policy asks for a descriptive agent, and prefers a contact URL.
// There is no public site for this app yet; when there is one, add it here —
// docs/play-store-readiness.md says so too. Deliberately no email address: a
// request header is not the place for one.

import Constants from "expo-constants";

const version = Constants.expoConfig?.version || "dev";

export const USER_AGENT = `TurismDarSimplu/${version} (Android; React Native)`;

// For fetch(), and for an <Image source> when the URI is remote. A file:// or
// data: source is loaded off the device and gets nothing.
export const WIKI_HEADERS = { "User-Agent": USER_AGENT };

export const isRemote = (uri) => typeof uri === "string" && /^https?:\/\//i.test(uri);
