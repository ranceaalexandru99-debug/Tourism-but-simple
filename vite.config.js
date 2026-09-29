import fs from "node:fs";
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
      ? [viteSingleFile(), {
          // The one file the single-file build was still leaving behind.
          //
          // /noflash.js is external on purpose in the normal build: keeping it
          // out of the HTML is what lets the page ship script-src 'self' with
          // no 'unsafe-inline'. But "one self-contained file you can send to
          // anyone" is the entire point of this mode, and a page that 404s on a
          // sibling script flashes light before dark and leaves <html lang>
          // unset. There is no CSP over a file:// page to protect anyway.
          name: "inline-noflash",
          transformIndexHtml: {
            order: "post",
            handler(html) {
              const js = fs.readFileSync(
                path.resolve(path.dirname(fileURLToPath(import.meta.url)), "public", "noflash.js"),
                "utf8",
              );
              const tag = /<script src="\.?\/noflash\.js"><\/script>/;
              if (!tag.test(html)) throw new Error("noflash.js tag not found — did index.html change?");
              return html.replace(tag, `<script>${js}</script>`);
            },
          },
        }]
      : [VitePWA({
          registerType: "autoUpdate",
          // Register via an external script (not an inline one) so index.html
          // stays free of inline scripts and can ship a strict CSP.
          injectRegister: "script",
          workbox: {
            globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
            // Not the fifteen translations a reader will never open.
            //
            // The dictionaries were split per language so the browser fetches
            // one instead of sixteen — 82 KB off the first paint, measured.
            // Precaching them all would hand that back: the service worker
            // would download every one in the background on the first visit,
            // which is the same bytes over the same connection, just later.
            //
            // The one that IS opened is cached at runtime below, so it still
            // works offline after a single visit. English is not excluded — it
            // rides in the main bundle as the fallback for any missing key.
            globIgnores: ["**/assets/{ro,fr,es,it,de,pt,nl,pl,el,tr,uk,ru,zh,ja,ko}-*.js"],
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
            }, {
              // The language someone actually uses, kept after its first fetch
              // so the app still opens in their own language offline.
              // CacheFirst because a dictionary chunk is content-hashed: a new
              // wording ships under a new filename, so a stale hit is
              // impossible and revalidating would be a request for nothing.
              urlPattern: /\/assets\/(ro|fr|es|it|de|pt|nl|pl|el|tr|uk|ru|zh|ja|ko)-[\w-]+\.js$/,
              handler: "CacheFirst",
              options: {
                cacheName: "i18n-v1",
                // A handful: whatever a person switches between, not all of them.
                expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 365 },
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
      // "expo-file-system/legacy" FIRST. Vite matches a string alias as a
      // prefix, so the bare package name would otherwise capture the subpath
      // too and rewrite it to <stub>/legacy, which does not exist.
      //
      // The two stubs are deliberately different: the legacy one works, and the
      // root one throws, exactly as the real package does since SDK 54. That is
      // not pedantry — the app imported the throwing entry point for months and
      // the suite stayed green because the old stub made the root work.
      ...Object.fromEntries(
        [
          ["expo-file-system/legacy", "expo-file-system-legacy"],
          ["expo-file-system", "expo-file-system"],
          ["expo-crypto", "expo-crypto"],
          ["expo-image-picker", "expo-image-picker"],
          ["expo-constants", "expo-constants"],
          ["react-native", "react-native"],
          ["expo-print", "expo-print"],
          ["expo-sharing", "expo-sharing"],
          ["expo-image-manipulator", "expo-image-manipulator"],
        ].map(([spec, stub]) => [
          spec,
          path.resolve(
            path.dirname(fileURLToPath(import.meta.url)),
            `src/__tests__/stubs/${stub}.js`,
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
