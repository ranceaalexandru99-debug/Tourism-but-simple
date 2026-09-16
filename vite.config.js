import path from "node:path";
import { fileURLToPath } from "node:url";
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
            // City and POI data now comes from Supabase rather than static
            // /pois/*.json files, so cache the read queries as they're used.
            // StaleWhileRevalidate: offline serves the cached copy, online
            // silently refreshes as the dataset is corrected.
            //
            // Scoped to the two public, read-only tables ON PURPOSE. A pattern
            // covering the whole Supabase origin would also cache /auth/v1/*,
            // putting session responses into a shared cache — never do that.
            runtimeCaching: [{
              urlPattern: /\/rest\/v1\/(cities|city_pois)\?/,
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "supabase-cities-v1",
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [200] },
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
  // `vite preview` defaults to port 4173 — and so does every other Vite project
  // on this machine. Serving this build there registered its PWA service worker
  // against http://localhost:4173, an origin they all share, and it then served
  // this app's cached shell in place of whatever else was previewed on that
  // port. Pin a port of our own, and refuse to start rather than silently drift
  // onto someone else's.
  preview: {
    port: 5175, strictPort: true, host: true, allowedHosts: true,
  },
  // Vitest. The native app's modules are plain JavaScript and worth testing
  // from here — the alternative is a second test runner with its own React
  // Native stack, for logic that needs none of it.
  //
  // What stops them importing is the expo packages: each pulls in
  // expo-modules-core and then react-native, whose Flow syntax vitest cannot
  // parse. Aliasing them to small stubs makes any native module importable.
  test: {
    alias: {
      ...Object.fromEntries(
        [
          "expo-crypto", "expo-file-system", "expo-image-picker",
          "expo-constants", "react-native",
        ].map((pkg) => [
          pkg,
          path.resolve(
            path.dirname(fileURLToPath(import.meta.url)),
            `src/__tests__/stubs/${pkg}.js`,
          ),
        ]),
      ),
    },
  },

  server: {
    port: 5173, open: true, host: true, allowedHosts: true,
    // Route /api to the local API server (npm run server) so the browser sees
    // one origin in dev — no CORS, and the client needs no absolute URL.
    proxy: {
      "/api": {
        target: process.env.API_TARGET || "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
}));
