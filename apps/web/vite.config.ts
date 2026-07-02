import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
      "/grafana": {
        target: "http://localhost:3300",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
