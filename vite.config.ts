import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import fs from "fs";

const APP_VERSION = "1.1.0";

// Short build suffix: MMDD using Brazil timezone to avoid UTC date shift
const now = new Date();
// Force Brazil timezone (UTC-3) to get correct local date
const brDate = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
const TODAY = `${String(brDate.getMonth() + 1).padStart(2, "0")}${String(brDate.getDate()).padStart(2, "0")}`;

let buildCount = 1;
const counterFile = path.resolve(__dirname, "build-counter.json");
try {
  const raw = JSON.parse(fs.readFileSync(counterFile, "utf-8"));
  if (raw.date === TODAY) {
    buildCount = (raw.count || 1) + 1;
  }
} catch { /* first build or missing file */ }
fs.writeFileSync(counterFile, JSON.stringify({ date: TODAY, count: buildCount }, null, 2));

const BUILD_ID = buildCount === 1 ? TODAY : `${TODAY}${buildCount}`;
const FULL_VERSION = `${APP_VERSION}.${BUILD_ID}`;

// Inject version into sw-push.js so cache busting stays in sync
const swPushPath = path.resolve(__dirname, "public/sw-push.js");
const swPushSource = fs.readFileSync(swPushPath, "utf-8");
const updatedSw = swPushSource.replace(
  /const CACHE_VERSION = "v[^"]*";/,
  `const CACHE_VERSION = "v${APP_VERSION}";`
);
if (updatedSw !== swPushSource) {
  fs.writeFileSync(swPushPath, updatedSw);
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "pwa-icon-192.png", "pwa-icon-512.png"],
      manifest: {
        id: `/?v=${APP_VERSION}`,
        name: "Doula Care",
        short_name: "Doula Care",
        start_url: `/?v=${APP_VERSION}`,
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#c34a1c",
        orientation: "portrait",
        icons: [
          {
            src: "/pwa-icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
        screenshots: [
          {
            src: "/screenshot-mobile.png",
            sizes: "1080x1920",
            type: "image/png",
          },
          {
            src: "/screenshot-desktop.png",
            sizes: "1920x1080",
            type: "image/png",
            form_factor: "wide",
          },
        ] as any,
      },
      workbox: {
        skipWaiting: false,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallbackDenylist: [/^\/~oauth/],
        importScripts: ["/sw-push.js"],
      runtimeCaching: [
          {
            urlPattern: /^https:\/\/gjnvxzsforfrxjanxqnq\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: `supabase-api-v${APP_VERSION}`,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 300,
              },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  define: {
    __APP_VERSION__: JSON.stringify(FULL_VERSION),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
