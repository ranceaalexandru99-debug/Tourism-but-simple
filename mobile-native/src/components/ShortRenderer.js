// Renders a short by driving an off-screen WebView.
//
// Mount it with an album and it reports progress, then hands back a file URI.
// Unmount it to cancel — the WebView goes with it and takes the render along.
//
// The WebView is 1×1 and behind everything rather than `display: none`: a hidden
// WebView is treated as a background tab, requestAnimationFrame stops, and the
// render never advances. It has to be technically on screen to run.
//
// Everything that decides anything — the chunk bookkeeping, the watchdog, the
// sanitising of values that arrive in a message — lives in shortCollector.js,
// where it can be tested. What is left here is the WebView and the file write.

import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import * as FileSystem from "expo-file-system";
import { buildShortRenderHtml } from "../lib/shortRenderHtml.js";
import { createShortCollector } from "../lib/shortCollector.js";

export default function ShortRenderer({ payload, onProgress, onDone, onError }) {
  const [html] = useState(() => buildShortRenderHtml(payload));

  // Handlers are read through a ref so the collector, built once, always calls
  // the current ones — rebuilding it on every render would restart the
  // watchdog and lose the chunks collected so far.
  const handlers = useRef({ onProgress, onDone, onError });
  handlers.current = { onProgress, onDone, onError };

  const collector = useRef(null);
  if (!collector.current) {
    collector.current = createShortCollector({
      onProgress: (v) => handlers.current.onProgress?.(v),
      onDone: (uri, ext) => handlers.current.onDone?.(uri, ext),
      onError: (reason) => handlers.current.onError?.(reason),
      write: async (base64, ext) => {
        const dir = FileSystem.cacheDirectory + "shorts/";
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
        const uri = `${dir}short-${Date.now()}.${ext}`;
        await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
        return uri;
      },
    });
  }

  useEffect(() => {
    const c = collector.current;
    c.start();
    // Unmounting IS the cancel: silently, because the user asked for it.
    return () => c.cancel();
  }, []);

  return (
    <View style={{ position: "absolute", width: 1, height: 1, opacity: 0, zIndex: -1 }} pointerEvents="none">
      <WebView
        source={{ html }}
        originWhitelist={["*"]}
        // These pages are built here and loaded as raw HTML; none of them has
        // anywhere to navigate TO. Refusing every top-level navigation means a
        // link that appears in one later — or a redirect from something it
        // loads — cannot turn the WebView into an uncontrolled browser.
        onShouldStartLoadWithRequest={(req) => req.url === "about:blank"}
        onMessage={(event) => collector.current.handleMessage(event.nativeEvent.data)}
        // The page is self-contained; nothing else may load.
        javaScriptEnabled
        domStorageEnabled={false}
        allowFileAccess={false}
        mediaPlaybackRequiresUserAction={false}
        onError={() => collector.current.cancel("webview")}
        style={{ width: 1, height: 1, backgroundColor: "transparent" }}
      />
    </View>
  );
}
