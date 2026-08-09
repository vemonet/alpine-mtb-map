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
        // Only the KML: the other exports are release assets, not site files.
        globPatterns: ["**/*.{js,css,html,png,kml}"],
        // The KML grows with every spot added and passed Workbox's 2 MiB
        // default. Raised so the data keeps being precached rather than
        // silently dropping out of the offline bundle.
        maximumFileSizeToCacheInBytes: 16 * 1024 * 1024,
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
    ignorePatterns: ["alpine-mtb-map.*", "CHANGELOG.md", ".claude/**"],
  },

  lint: {
    env: { browser: true },
    // The export and icon scripts run under Node, not in the page.
    overrides: [{ files: ["scripts/**"], env: { node: true } }],
  },

  run: {
    cache: true,
    tasks: {
      // Regenerate the GPX, GeoJSON and KMZ from the KML. They are gitignored:
      // the release attaches them instead. Declaring the inputs and outputs
      // lets Vite Task replay the 20 MB of exports from its cache when the KML
      // has not moved, so a retried release does not rebuild them.
      export: {
        command: "node scripts/export.mjs",
        input: ["alpine-mtb-map.kml", "scripts/export.mjs", "src/lib/kml-export.js"],
        output: ["alpine-mtb-map.geojson", "alpine-mtb-map.gpx", "alpine-mtb-map.kmz"],
      },
      // The PWA icons, derived from public/icon.png. Only needed when the mark
      // itself changes, so it is not wired into the build.
      icons: { command: "python3 scripts/make-icons.py" },
      // What CI runs, and what to run before opening a pull request.
      ready: {
        command: ["vp check", "vp run export", "vp build"],
        cache: false,
      },
      // Cut a release: release-it prompts for the version, bumps package.json,
      // rewrites CHANGELOG.md with git-cliff, commits, tags and pushes. None of
      // that needs a token. Pushing the tag is what triggers
      // .github/workflows/release.yml, which publishes the GitHub release and
      // attaches the exports.
      //   vp run release              # interactive
      //   vp run release minor
      //   vp run release --dry-run
      // `dependsOn` keeps the export honest during the dry run, so a broken KML
      // is caught here rather than after the tag is already pushed.
      release: {
        command: "release-it",
        dependsOn: ["export"],
        cache: false,
      },
    },
  },

  staged: {
    "*.{js,mjs,css,html,json,md}": "vp check --fix",
  },
});
