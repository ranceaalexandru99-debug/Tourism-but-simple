// The short's recipe: which photos go in, in what order, and for how long.
//
// Pure — no DOM, no React, no React Native. Copied VERBATIM to
// mobile-native/src/lib/shortEdit.js, like album.js and albumHtml.js before it,
// because every single time this app has kept "the same" logic in two places
// the two have drifted and a fix has landed in only one of them.
//
// The renderers stay dumb: they are handed a finished scene list and a timeline
// and draw it. All the deciding happens here, where it can be tested.

// Seconds a photo is held. The default is what the short used before any of
// this existed, so an untouched recipe renders exactly the old video.
export const DEFAULT_SEC = 1.7;
export const MIN_SEC = 0.8;
export const MAX_SEC = 5;

// Rounded to a tenth: the UI steps in 0.1s, and float drift would otherwise
// show up as 1.7000000000000002 in a label.
const round1 = (n) => Math.round(n * 10) / 10;
export const clampSec = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return DEFAULT_SEC;
  return round1(Math.min(MAX_SEC, Math.max(MIN_SEC, v)));
};

/**
 * Build an editable recipe from the scenes the album produced.
 * Every photo starts included, in album order, at the default duration.
 */
export function makeRecipe(scenes) {
  return (scenes || []).map((scene, i) => ({
    // The photo id is the stable identity; the index is only a fallback for
    // data old enough to predate ids, and is never used for equality.
    key: scene?.photo?.id ?? `i${i}`,
    include: true,
    sec: DEFAULT_SEC,
  }));
}

// Move an item, returning a new array. Out-of-range indices are a no-op rather
// than a crash: drag handlers overshoot at the ends constantly.
export function moveItem(list, from, to) {
  if (!Array.isArray(list)) return list;
  if (from === to) return list;
  if (from < 0 || from >= list.length || to < 0 || to >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export const toggleAt = (list, i) =>
  list.map((item, j) => (j === i ? { ...item, include: !item.include } : item));

export const setSecAt = (list, i, sec) =>
  list.map((item, j) => (j === i ? { ...item, sec: clampSec(sec) } : item));

/**
 * Apply a recipe to the scenes, yielding what the renderer should draw:
 * included photos only, in the recipe's order, each carrying its own `sec`.
 *
 * Scenes are matched by key, so a recipe survives the album being rebuilt —
 * which happens on every open, because photos are read fresh from storage.
 */
export function applyRecipe(scenes, recipe) {
  if (!recipe?.length) return (scenes || []).map((s) => ({ ...s, sec: DEFAULT_SEC }));
  const byKey = new Map();
  (scenes || []).forEach((scene, i) => byKey.set(scene?.photo?.id ?? `i${i}`, scene));

  const out = [];
  for (const item of recipe) {
    if (!item.include) continue;
    const scene = byKey.get(item.key);
    // A photo deleted from the gallery since the recipe was made simply drops
    // out, rather than rendering a hole or throwing.
    if (scene) out.push({ ...scene, sec: clampSec(item.sec) });
  }
  return out;
}

/**
 * Cumulative start time of each scene, plus the total photo time.
 * `starts[i]` is when scene i begins, measured from the end of the intro.
 */
export function timeline(scenes) {
  const starts = [];
  let acc = 0;
  for (const scene of scenes || []) {
    starts.push(acc);
    acc += clampSec(scene?.sec ?? DEFAULT_SEC);
  }
  return { starts, photoTime: round1(acc) };
}

/**
 * Which scene is on screen at `t` seconds after the intro, and how far through
 * it we are (0..1). Returns null once the photos are over, which is the
 * renderer's signal to draw the outro.
 */
export function sceneAt(scenes, starts, t) {
  if (!scenes?.length) return null;
  // Linear: at most MAX_PHOTOS entries, so a search would cost more in
  // complexity than it saves in time.
  let idx = -1;
  for (let i = 0; i < scenes.length; i++) {
    const dur = clampSec(scenes[i]?.sec ?? DEFAULT_SEC);
    if (t < starts[i] + dur) { idx = i; break; }
  }
  if (idx === -1) return null;
  const dur = clampSec(scenes[idx]?.sec ?? DEFAULT_SEC);
  return { idx, t: Math.min(1, Math.max(0, (t - starts[idx]) / dur)) };
}

// What the user is told the video will last, before committing to a render
// that runs in real time.
export const totalSeconds = (scenes, intro, outro) =>
  round1(intro + timeline(scenes).photoTime + outro);
