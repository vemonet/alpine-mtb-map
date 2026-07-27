import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vite-plus";

export default defineConfig({
  // Relative base so the site works at user.github.io/alpine-mtb-map/ and locally.
  base: "./",
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "icon.png",
        "icon-192.png",
        "icon-512.png",
        "icon-maskable-512.png",
        "apple-touch-icon.png",
      ],
      manifest: {
        name: "Alpine MTB Map",
        short_name: "Alpine MTB",
        description:
          "Lift-served mountain-bike spots across the Alps and the Jura, with travel times, lift prices and what the trails are like.",
        // The icon's own background, so the splash screen matches the mark.
        theme_color: "#073354",
        background_color: "#073354",
        display: "standalone",
        orientation: "any",
        start_url: "./",
        scope: "./",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Precache the map data with the app shell so it remains available
        // offline and the KML can be loaded on startup without a network.
        globPatterns: ["**/*.{js,css,html,png,kml,gpx,geojson}"],
        // The exports grow with every spot added; the GeoJSON passed Workbox's
        // 2 MiB default and failed the build. Raised so the data keeps being
        // precached rather than silently dropping out of the offline bundle.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.open-meteo\.com\/v1\/forecast/,
            handler: "NetworkFirst",
            options: {
              cacheName: "weather-forecasts",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Tiles you have already looked at stay available offline. Capped
            // so a long browsing session cannot fill up the device.
            urlPattern: /^https:\/\/[a-c]?\.?tile.*\.(png|jpg)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "map-tiles",
              expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],

  // --------------------------------------------------------------- Vite+ ---
  // Everything below is Vite+ only. It replaces husky, lint-staged, prettier
  // and eslint, so the whole toolchain is this file plus `vp`.

  fmt: {
    // Keep Markdown prose as full logical lines; editors handle visual wrapping.
    proseWrap: "never",
    // The KML is hand-edited XML whose layout is part of how readable it is,
    // and the GPX and GeoJSON are generated. All three are data, not source.
    ignorePatterns: ["public/alpine-mtb-map.*", ".claude/**"],
  },

  lint: {
    env: { browser: true },
    // The conversion and icon scripts run under Node, not in the page.
    overrides: [{ files: ["scripts/**"], env: { node: true } }],
  },

  run: {
    cache: true,
    tasks: {
      // Regenerate the GPX and GeoJSON from the KML. The pre-commit hook runs
      // this, so the three formats can never drift apart. Vite Task tracks the
      // files it reads and writes on its own, so re-running it is free.
      convert: { command: "node scripts/convert.mjs" },
      // The PWA icons, derived from public/icon.png. Only needed when the mark
      // itself changes, so it is not wired into the build.
      icons: { command: "python3 scripts/make-icons.py" },
      // What CI runs, and what to run before opening a pull request.
      ready: {
        command: ["vp check", "vp run convert", "vp build"],
        cache: false,
      },
    },
  },

  staged: {
    "*.{js,mjs,css,html,json,md}": "vp check --fix",
  },
});
