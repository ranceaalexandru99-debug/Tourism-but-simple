import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { VitePWA } from "vite-plugin-pwa";

// `vite build --mode single` inlines everything into one self-contained
// index.html that runs by double-clicking (file://) — easy to send to anyone.
// The normal build/dev get a service worker (offline app-shell) via VitePWA.
export default defineConfig(({ mode }) => ({
  base: mode === "single" ? "./" : "/",
  plugins: [
    react(),
    ...(mode === "single"
      ? [viteSingleFile()]
      : [VitePWA({
          registerType: "autoUpdate",
          // Register via an external script (not an inline one) so index.html
          // stays free of inline scripts and can ship a strict CSP.
          injectRegister: "script",
          workbox: {
            globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
            // POI files are fetched lazily per city — too many to precache
            // (500+ ≈ 6 MB), so cache them as they're used. StaleWhileRevalidate:
            // offline serves the cached copy (saved trips regenerate with real
            // data), online silently refreshes (the index grows as the batch
            // adds cities).
            runtimeCaching: [{
              urlPattern: /\/pois\/[^/]+\.json$/,
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "pois-v1",
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 180 },
              },
            }],
          },
          includeAssets: ["favicon.svg", "favicon-32.png", "apple-touch-icon.png", "og.png"],
          manifest: {
            name: "Turism, dar simplu! — planificator AI de călătorii",
            short_name: "Turism simplu",
            description: "Planificator AI de călătorii — traseu personalizat, buget, hartă și sfaturi locale, pentru orice oraș.",
            // Light (porcelain + gold) is the default theme, so the installed
            // PWA chrome and splash match it.
            theme_color: "#FBFAF7",
            background_color: "#FBFAF7",
            display: "standalone",
            start_url: "/",
            icons: [
              { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
              { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
              { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
            ],
          },
        })]),
  ],
  server: { port: 5173, open: true, host: true, allowedHosts: true },
}));
