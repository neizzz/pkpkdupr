import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(configDir, "../..");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  snapshotPathTemplate: path.join(
    repoRoot,
    "tmp/snapshots/{testFilePath}/{projectName}/{arg}{ext}",
  ),
  use: {
    baseURL: "http://127.0.0.1:4173",
    colorScheme: "light",
    locale: "ko-KR",
    // page.route fixture가 PWA 개발 service worker에 우회되지 않게 한다.
    serviceWorkers: "block",
    timezoneId: "Asia/Seoul",
  },
  projects: [
    {
      name: "mobile",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 430, height: 932 },
        deviceScaleFactor: 1,
      },
    },
  ],
  webServer: {
    command:
      "env VITE_DEV_PORT=4173 VITE_DEV_HMR_HOST=127.0.0.1 VITE_DEV_ALLOWED_HOSTS=pkelo.localhost pnpm --filter @pkpkdupr/web dev -- --host 127.0.0.1",
    cwd: repoRoot,
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
