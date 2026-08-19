import { useEffect, useState } from "react";
import { View, Image, ActivityIndicator, StyleSheet } from "react-native";
import { C, themedStyles } from "../lib/theme.js";
import { fetchPhoto } from "../lib/photos.js";
import { CategoryIcon } from "../icons.js";

// Real Wikipedia photo for a place, with a category-SVG fallback while loading
// or when none is found. Mirrors the web PoiImage (`tags` picks the icon;
// `wiki` = optional explicit article title, `context` = city for searches).
export default function PoiImage({ name, emoji, tags, wiki, context, width = "100%", height = 150, radius = 18, fontSize = 64, style }) {
  const [state, setState] = useState({ status: "loading", src: null });

  useEffect(() => {
    let on = true;
    setState({ status: "loading", src: null });
    fetchPhoto(name, wiki, context).then((s) => { if (on) setState({ status: "done", src: s }); });
    return () => { on = false; };
  }, [name, wiki, context]);

  const base = [styles.base, { width, height, borderRadius: radius }, style];

  if (state.status === "done" && state.src) {
    return (
      <View style={base}>
        <Image source={{ uri: state.src }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
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
