// The gallery's photo map.
//
// Only photos taken from a stop carry coordinates — the stop's own, with no
// location permission involved — so this plots a subset, and the caller is
// responsible for saying so when the subset is empty.

import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { C, themedStyles } from "../lib/theme.js";
import { FONT } from "../fonts.js";
import { buildMemoryMapHtml } from "../lib/memoryMapHtml.js";
import { toThumbnails } from "../lib/albumExport.js";
import { readMapMessage } from "../lib/mapMessage.js";

export default function MemoryMap({ memories, onPick }) {
  const [html, setHtml] = useState(null);
  const [failed, setFailed] = useState(false);

  const geo = (memories || []).filter((m) => Array.isArray(m.ll) && m.uri);

  useEffect(() => {
    let alive = true;
    // The photos have to cross into the WebView as data URLs: it cannot read
    // the app's own files, and giving it that access to save a conversion
    // would be the wrong trade. Thumbnails, because a pin is 52 points wide.
    toThumbnails(geo, 120)
      .then((pins) => { if (alive) setHtml(buildMemoryMapHtml(pins, { gold: C.gold, card: C.card, bg: C.bg })); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo.length]);

  if (failed) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.msg}>—</Text>
      </View>
    );
  }
  if (!html) {
    return (
      <View style={styles.wrap}><ActivityIndicator color={C.gold} /></View>
    );
  }

  return (
    <View style={styles.wrap}>
      <WebView
        source={{ html }}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled={false}
        allowFileAccess={false}
        onMessage={(e) => {
          const msg = readMapMessage(e.nativeEvent.data);
          if (msg?.type === "pick") {
            const hit = geo.find((m) => m.id === msg.id);
            if (hit) onPick?.(hit);
          }
        }}
        onError={() => setFailed(true)}
        style={{ flex: 1, backgroundColor: C.bg }}
      />
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  wrap: { height: 380, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: C.border, backgroundColor: C.bg, alignItems: "stretch", justifyContent: "center" },
  msg: { color: C.muted, fontSize: 13, textAlign: "center", fontFamily: FONT.body },
}));
