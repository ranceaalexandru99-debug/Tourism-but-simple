// Renders a short by driving an off-screen WebView.
//
// Mount it with an album and it reports progress, then hands back a file URI.
// Unmount it to cancel — the WebView goes with it and takes the render along.
//
// The WebView is 1×1 and behind everything rather than `display: none`: a hidden
// WebView is treated as a background tab, requestAnimationFrame stops, and the
// render never advances. It has to be technically on screen to run.

import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import * as FileSystem from "expo-file-system";
import { buildShortRenderHtml } from "../lib/shortRenderHtml.js";

export default function ShortRenderer({ payload, onProgress, onDone, onError }) {
  const [html] = useState(() => buildShortRenderHtml(payload));
  // Chunks arrive in order but are indexed anyway, so a dropped message is
  // detectable instead of producing a silently corrupt file.
  const parts = useRef([]);
  const meta = useRef(null);
  const settled = useRef(false);

  // Watchdog for a WebView that goes silent.
  //
  // Every way the render can die without saying so ends here: a MediaRecorder
  // that never fires onstop, the OS reclaiming the WebView, the JS engine
  // throwing somewhere the page's own try cannot see. WebView's onError only
  // covers loading the page, so none of those reached us and the user sat on a
  // progress bar that would never move again.
  //
  // A fixed deadline would be wrong — a twelve-photo render legitimately takes
  // a while. What is never legitimate is SILENCE: the page reports progress
  // continuously, so the timer resets on every message and only fires when
  // nothing has arrived at all.
  const STALL_MS = 45000;
  const watchdog = useRef(null);
  const stopWatchdog = () => { if (watchdog.current) { clearTimeout(watchdog.current); watchdog.current = null; } };
  const kickWatchdog = () => {
    stopWatchdog();
    watchdog.current = setTimeout(() => {
      if (settled.current) return;
      settled.current = true;
      onError?.("stalled");
    }, STALL_MS);
  };

  useEffect(() => {
    kickWatchdog();
    return () => { settled.current = true; stopWatchdog(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = async () => {
    if (settled.current) return;
    const { parts: n, mime } = meta.current || {};
    const missing = [];
    for (let i = 0; i < n; i++) if (typeof parts.current[i] !== "string") missing.push(i);
    if (missing.length) { settled.current = true; onError?.("incomplete"); return; }

    try {
      const base64 = parts.current.join("");
      const dir = FileSystem.cacheDirectory + "shorts/";
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
      const uri = `${dir}short-${Date.now()}.${mime}`;
      await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
      settled.current = true;
      onDone?.(uri, mime);
    } catch (e) {
      settled.current = true;
      onError?.(String(e?.message || e));
    }
  };

  const onMessage = (event) => {
    if (settled.current) return;
    let msg;
    try { msg = JSON.parse(event.nativeEvent.data); } catch { return; }
    kickWatchdog();   // it is alive; start the silence clock over
    switch (msg.type) {
      case "progress": onProgress?.(msg.value); break;
      case "begin": meta.current = msg; parts.current = new Array(msg.parts); break;
      case "chunk": parts.current[msg.i] = msg.data; break;
      case "done": stopWatchdog(); finish(); break;
      case "error": stopWatchdog(); settled.current = true; onError?.(msg.reason); break;
      default: break;
    }
  };

  return (
    <View style={{ position: "absolute", width: 1, height: 1, opacity: 0, zIndex: -1 }} pointerEvents="none">
      <WebView
        source={{ html }}
        originWhitelist={["*"]}
        onMessage={onMessage}
        // The page is self-contained; nothing else may load.
        javaScriptEnabled
        domStorageEnabled={false}
        allowFileAccess={false}
        mediaPlaybackRequiresUserAction={false}
        onError={() => { if (!settled.current) { settled.current = true; stopWatchdog(); onError?.("webview"); } }}
        style={{ width: 1, height: 1, backgroundColor: "transparent" }}
      />
    </View>
  );
}
