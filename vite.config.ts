import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import fs from "fs";

const APP_VERSION = "1.1.0";

// Short build suffix: MMDD + optional counter for multiple builds per day
const now = new Date();
const TODAY = `${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

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
        name: "Doula Care",
        short_name: "Doula Care",
        start_url: `/?v=${APP_VERSION}`,
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#c34a1c",
        orientation: "portrait",
        icons: [
          {
            src: `/pwa-icon-192.png?v=${APP_VERSION}`,
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: `/pwa-icon-512.png?v=${APP_VERSION}`,
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: `/pwa-icon-192.png?v=${APP_VERSION}`,
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: `/pwa-icon-512.png?v=${APP_VERSION}`,
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
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
              cacheName: `supabase-api-cache-${APP_VERSION}`,
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
