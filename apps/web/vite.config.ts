import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

const configDir = path.dirname(fileURLToPath(import.meta.url));

const fallbackAppVersion =
  (
    JSON.parse(
      readFileSync(new URL("./package.json", import.meta.url), "utf8"),
    ) as {
      version?: string;
    }
  ).version ?? "0.0.0";

const appVersion = (() => {
  try {
    return execSync("git describe --tags --abbrev=0", {
      cwd: configDir,
      encoding: "utf8",
    }).trim();
  } catch {
    return fallbackAppVersion;
  }
})();

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      devOptions: {
        enabled: true,
        navigateFallback: "/index.html",
        navigateFallbackAllowlist: [/^\/$/, /^\/login$/],
      },
      includeAssets: [
        "favicon.svg",
        "pwa-192x192.png",
        "pwa-512x512.png",
        "pwa-maskable-512x512.png",
      ],
      manifest: {
        name: "PkpkDUPR",
        short_name: "PkpkDUPR",
        description: "Pickleball DUPR match and member app",
        id: "/",
        lang: "ko",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#ffffff",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/uploads\//,
          /^\/uptime\//,
          /^\/db\//,
        ],
        runtimeCaching: [
          {
            urlPattern:
              /^https?:\/\/[^/]+\/api\/(?:me|players|matches)(?:\?.*)?$/,
            handler: "NetworkFirst",
            options: {
              cacheName: "pkpkdupr-api-read-v1",
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 24 * 60 * 60,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https?:\/\/[^/]+\/uploads\/avatars\/.+$/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "pkpkdupr-avatar-v1",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@pkpkdupr/shared": path.resolve(__dirname, "../../packages/shared/src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 8080,
    allowedHosts: ["neiz-office.fedev.kakao.com"],
    hmr: {
      host: "neiz-office.fedev.kakao.com",
    },
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/uptime": {
        target: "http://localhost:3300",
        changeOrigin: true,
        ws: true,
      },
      "/db": {
        target: "http://localhost:3301",
        changeOrigin: true,
      },
    },
  },
});
