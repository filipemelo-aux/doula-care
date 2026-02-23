import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

const APP_VERSION = "1.0.1";

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
        name: "Papo de Doula",
        short_name: "Papo de Doula",
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
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
