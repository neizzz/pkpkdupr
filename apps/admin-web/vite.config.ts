import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const basePath = process.env.VITE_BASE_PATH || "/";
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
      cwd: __dirname,
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
    base: basePath,
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
             "@": path.resolve(__dirname, "./src"),
             "@pkpkdupr/shared": path.resolve(__dirname, "../../packages/shared/src"),
         },
     },
    server: {
        host: "0.0.0.0",
        port: 3100,
        proxy: {
             "/api": {
                target: "http://localhost:4000",
                changeOrigin: true,
             },
         },
     },
});
