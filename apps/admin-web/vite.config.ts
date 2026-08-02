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
  const envVersion = process.env.VITE_APP_VERSION?.trim();
  if (envVersion) return envVersion;
  try {
    return execSync("git describe --tags --abbrev=0", {
      cwd: __dirname,
      encoding: "utf8",
    }).trim();
  } catch {
    return fallbackAppVersion;
  }
})();

const resolvePort = (value: string | undefined, fallback: number) => {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 ? port : fallback;
};

const resolveAllowedHosts = (value: string | undefined, fallback: string[]) => {
  const hosts = value
    ?.split(",")
    .map((host) => host.trim())
    .filter(Boolean);
  return hosts?.length ? hosts : fallback;
};

const devPort = resolvePort(process.env.VITE_DEV_PORT, 3100);
const devApiTarget = process.env.VITE_DEV_API_TARGET || "http://localhost:4000";
const devAllowedHosts = resolveAllowedHosts(process.env.VITE_DEV_ALLOWED_HOSTS, []);

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
    port: devPort,
    allowedHosts: devAllowedHosts,
    proxy: {
      "/api": {
        target: devApiTarget,
        changeOrigin: true,
      },
    },
  },
});
