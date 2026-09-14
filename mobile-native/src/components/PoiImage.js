import { useEffect, useState } from "react";
import { View, Image, ActivityIndicator, StyleSheet } from "react-native";
import { C, themedStyles } from "../lib/theme.js";
import { fetchPhoto } from "../lib/photos.js";
import { CategoryIcon } from "../icons.js";

// Real Wikipedia photo for a place, with a category-SVG fallback while loading
// or when none is found. Mirrors the web PoiImage (`tags` picks the icon;
// `wiki` = optional explicit article title, `context` = city for searches).
// `fit` decides what happens when the photo's shape does not match the box.
//   "cover"   — fill the box, crop the overflow. Right for a backdrop behind
//               text, or a hero that must reach every edge.
//   "contain" — show the whole photo over a blurred copy of itself filling the
//               rest. Right wherever the picture IS the content.
// Mirrors the web component's prop of the same name.
export default function PoiImage({ name, emoji, tags, wiki, context, width = "100%", height = 150, radius = 18, fontSize = 64, fit = "cover", style }) {
  const [state, setState] = useState({ status: "loading", src: null });

  useEffect(() => {
    let on = true;
    setState({ status: "loading", src: null });
    fetchPhoto(name, wiki, context).then((s) => { if (on) setState({ status: "done", src: s }); });
    return () => { on = false; };
  }, [name, wiki, context]);

  const base = [styles.base, { width, height, borderRadius: radius, overflow: "hidden" }, style];

  if (state.status === "done" && state.src) {
    return (
      <View style={base}>
        {fit === "contain" && (
          <Image source={{ uri: state.src }} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={14} />
        )}
        <Image source={{ uri: state.src }} style={{ width: "100%", height: "100%" }} resizeMode={fit} />
      </View>
    );
  }
  return (
    <View style={base}>
      {state.status === "loading" && <ActivityIndicator size="small" color={C.gold} style={StyleSheet.absoluteFill} />}
      <View style={{ opacity: 0.45 }}>
        <CategoryIcon tags={tags} size={Math.round(fontSize * 0.62)} color={C.gold} strokeWidth={1.6} />
      </View>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  base: {
    overflow: "hidden", backgroundColor: C.card,
    alignItems: "center", justifyContent: "center",
  },
}));
