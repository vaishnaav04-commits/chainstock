
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  root: ".",

  plugins: [
    react(),

    VitePWA({
      registerType: "prompt",
      injectRegister: null,

      // Prevent development service-worker caches
      // from causing stale pages during VS Code work.
      devOptions: {
        enabled: false,
      },

      manifest: {
        id: "/",
        name: "ChainStock Warehouse Ledger",
        short_name: "ChainStock",
        description:
          "QR-based blockchain warehouse inventory tracking",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#080f1d",
        theme_color: "#0d9488",

        icons: [
          {
            src: "/pwa-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
        ],
      },

      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: "/index.html",

        // Cache built app assets only.
        globPatterns: [
          "**/*.{js,css,html,png,svg,ico}",
        ],

        // Blockchain JSON-RPC traffic must stay live.
        // Do not configure any runtime RPC caching.
        runtimeCaching: [],
      },
    }),
  ],

  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },

  preview: {
    host: "127.0.0.1",
    port: 4173,
  },

  build: {
    outDir: "dist",
  },
});
