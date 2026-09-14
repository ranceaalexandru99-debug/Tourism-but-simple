import { useEffect, useState } from "react";
import { C } from "../theme.js";
import { fetchPhoto } from "../photos.js";
import { CategoryIcon } from "../icons.jsx";

// Shows a real photo for a POI once loaded; falls back to a category SVG icon
// on a gradient (`tags` picks the icon; `emoji` is legacy/unused visually).
// `wiki` is an optional explicit Wikipedia title for POIs whose display name
// doesn't match an article; `context` (city name) sharpens the search-based
// fallbacks. `credit` turns on the tiny "via Wikipedia" attribution overlay —
// use it for hero-sized photos (Creative Commons licenses require attribution;
// small tiles use a broader disclosure in the Legal sheet instead).
// A Commons filename stored on the data (POI `img`) becomes a thumbnail URL.
// `width` keeps the transfer small — these render at ~170px tall at most.
export const commonsUrl = (file, width = 640) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${width}`;

// Venue categories that provably have no encyclopaedia presence. Measured on
// 324 bars, pubs, restaurants, cafés and clubs in one city: ZERO carried a
// wikipedia, wikidata, wikimedia_commons or image tag. So for these the lookup
// chain below cannot succeed — it can only miss, or match something else.
//
// And matching something else is the real danger, not the wasted request:
// stage 1 queries the bare name with no city, so a Timișoara bar called
// "Barcelona" resolves to the Spanish city's article and shows its photo. The
// data holds bars named Barcelona, Copacabana, Byblos, Piramida and Royal.
// A category icon is right; a confident photo of the wrong place is not.
const NO_ARTICLE_EXISTS = new Set(["bar", "nightclub", "livemusic", "restaurant", "cafe", "shopping"]);

// `fit` decides what happens when the photo's shape does not match the box.
//   "cover"   — fill the box, crop the overflow. Right for a backdrop behind
//               text, or a hero that must reach every edge.
//   "contain" — show the whole photo over a blurred copy of itself filling the
//               rest. Right wherever the picture IS the content and cropping it
//               would throw away what someone is looking at.
// It is a prop rather than a global change because the trip cover genuinely has
// to fill its frame: letterboxing it would be worse than the crop.
export default function PoiImage({ name, emoji, tags, wiki, context, category, credit = false, img, fallbackImg, width = "100%", height = 150, radius = 18, fontSize = 64, fit = "cover", style }) {
  // An explicit wiki title is evidence this particular place DOES have an
  // article, so it overrides the category rule.
  const hopeless = !img && !wiki && NO_ARTICLE_EXISTS.has(category);
  // Tracks the async lookup: "loading" until the Promise resolves, then the URL
  // string (or null if none was found). We differentiate to know whether to
  // show the shimmer (loading) or the emoji fallback (done, no image).
  // When the POI already carries a resolved photo (`img`, baked in by
  // scripts/enrich-poi-photos.mjs), we start with it and skip the network
  // lookup entirely — instant, and it can't be rate-limited away.
  const [state, setState] = useState(() =>
    img ? { status: "done", src: commonsUrl(img) }
      : hopeless ? { status: "done", src: null }   // straight to the icon, no shimmer
        : { status: "loading", src: null });

  useEffect(() => {
    if (img) { setState({ status: "done", src: commonsUrl(img) }); return; }
    if (hopeless) { setState({ status: "done", src: null }); return; }
    let on = true;
    setState({ status: "loading", src: null });
    fetchPhoto(name, wiki, context).then((s) => { if (on) setState({ status: "done", src: s }); });
    return () => { on = false; };
  }, [name, wiki, context, img, hopeless]);

  const base = {
    width, height, borderRadius: radius, overflow: "hidden", flexShrink: 0,
    background: `linear-gradient(135deg, ${C.card}, ${C.cardHover})`,
    display: "flex", alignItems: "center", justifyContent: "center",
    position: "relative", ...style,
  };

  if (state.status === "done" && state.src) {
    // Credit line: every photo we resolve comes from Wikipedia or Wikimedia
    // Commons via photos.js, so the attribution is generic and correct. A
    // click opens the Wikipedia article for that stop, respecting CC-BY-SA.
    const wikiUrl = state.src.includes("wikimedia.org")
      ? `https://en.wikipedia.org/wiki/${encodeURIComponent(wiki || name)}`
      : null;
    // A baked-in filename can go stale (file renamed or deleted on Commons).
    // Rather than dropping straight to the category icon, retry through the
    // normal lookup chain — it may still find a picture.
    const onImgError = () => {
      if (!img) { setState({ status: "done", src: null }); return; }
      setState({ status: "loading", src: null });
      fetchPhoto(name, wiki, context).then((s) => setState({ status: "done", src: s }));
    };
    return (
      <div style={base}>
        {fit === "contain" && (
          <div aria-hidden="true" style={{
            position: "absolute", inset: 0,
            backgroundImage: `url(${state.src})`, backgroundSize: "cover", backgroundPosition: "center",
            filter: "blur(10px) saturate(1.15)", transform: "scale(1.3)",
          }} />
        )}
        <img
          src={state.src}
          alt={name}
          // Hero photos (the ones carrying a credit) are always above the fold,
          // so deferring them only delays the first thing the user looks at.
          // Thumbnails stay lazy — a route can hold dozens.
          loading={credit ? "eager" : "lazy"}
          // React 18 does not recognise the camelCase form and warns on every photo;
          // the lowercase attribute passes straight through to the DOM.
          fetchpriority={credit ? "high" : "auto"}
          onError={onImgError}
          style={{ position: "relative", width: "100%", height: "100%", objectFit: fit }}
        />
        {credit && wikiUrl && (
          <a
            href={wikiUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute", right: 8, bottom: 8,
              background: "rgba(0,0,0,0.55)", color: "#fff",
              fontSize: 10, fontWeight: 600, letterSpacing: 0.2,
              padding: "3px 8px", borderRadius: 6,
              textDecoration: "none", pointerEvents: "auto",
            }}
          >via Wikipedia</a>
        )}
      </div>
    );
  }
  if (state.status === "loading") {
    return (
      <div style={base}>
        {/* Shimmer band sweeping across a card-tinted base */}
        <div style={{
          position: "absolute", inset: 0,
          background: `linear-gradient(90deg, ${C.card} 0%, ${C.cardHover} 20%, ${C.gold}22 50%, ${C.cardHover} 80%, ${C.card} 100%)`,
          backgroundSize: "200% 100%",
          animation: "vai-shimmer 1.6s linear infinite",
        }} />
        <span style={{ position: "relative", opacity: 0.35, display: "flex" }}>
          <CategoryIcon tags={tags} size={Math.round(fontSize * 0.62)} color={C.gold} strokeWidth={1.6} />
        </span>
      </div>
    );
  }
  // Wikipedia chain returned nothing. If the caller supplied a fallback URL
  // (e.g. Wikidata P18 for curated destinations), use it before dropping to
  // the category-icon placeholder.
  if (fallbackImg) {
    return (
      <div style={base}>
        {fit === "contain" && (
          <div aria-hidden="true" style={{
            position: "absolute", inset: 0,
            backgroundImage: `url(${fallbackImg})`, backgroundSize: "cover", backgroundPosition: "center",
            filter: "blur(10px) saturate(1.15)", transform: "scale(1.3)",
          }} />
        )}
        <img
          src={fallbackImg}
          alt={name}
          loading="lazy"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
          style={{ position: "relative", width: "100%", height: "100%", objectFit: fit }}
        />
      </div>
    );
  }
  return (
    <div style={base}>
      <CategoryIcon tags={tags} size={Math.round(fontSize * 0.62)} color={C.gold} strokeWidth={1.6} />
    </div>
  );
}
