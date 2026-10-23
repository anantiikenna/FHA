import { defineConfig } from "@playwright/test";

// E2E suite runs against the production build served locally (port 3100) and
// the live demo database. Tests must never hard-code record counts — always
// assert parity between the UI and /api/v1/* responses.
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    channel: process.env.CI ? "chrome" : "msedge",
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run build && npx next start -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    // Warm builds are seconds; a full Turbopack recompile on a loaded
    // 4-core box can exceed 5 minutes, so leave generous headroom.
    timeout: 900_000,
  },
});
