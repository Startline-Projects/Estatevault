import { defineConfig, devices } from "@playwright/test";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.test" });
dotenv.config({ path: ".env.local", override: process.env.TEST_ALLOW_SHARED_DB === "1" });

// Dedicated test port — keeps Playwright's dev server (which must run against
// the .env.test Supabase project) separate from any manual `npm run dev` on 3000.
const PORT = process.env.TEST_PORT || "3100";
// Per-portal hosts. Chromium resolves *.localhost to loopback automatically.
const APP_URL = process.env.TEST_BASE_URL || `http://localhost:${PORT}`;
const PRO_URL = process.env.TEST_PRO_URL || `http://pro.localhost:${PORT}`;
const SALES_URL = process.env.TEST_SALES_URL || `http://sales.localhost:${PORT}`;
const ADMIN_URL = process.env.TEST_ADMIN_URL || `http://admin.localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: (() => {
    const runId = process.env.RUN_ID || new Date().toISOString().replace(/[:.]/g, "-");
    return [
      ["html", { outputFolder: `playwright-report/${runId}`, open: "never" }],
      ["json", { outputFile: `test-results/results-${runId}.json` }],
      ["junit", { outputFile: `test-results/junit-${runId}.xml` }],
      ["list"],
    ] as const;
  })(),
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    // Consumer host. Runs every test NOT tagged for a pro/sales/admin portal.
    {
      name: "app",
      use: { ...devices["Desktop Chrome"], baseURL: APP_URL },
      grepInvert: /@pro|@sales|@admin/,
    },
    // Partner portal — pro.localhost. Partner accounts only log in here.
    {
      name: "pro",
      use: { ...devices["Desktop Chrome"], baseURL: PRO_URL },
      grep: /@pro/,
    },
    // Sales portal — sales.localhost. Sales-rep accounts only log in here.
    {
      name: "sales",
      use: { ...devices["Desktop Chrome"], baseURL: SALES_URL },
      grep: /@sales/,
    },
    // Admin portal — admin.localhost. Admin + review-attorney accounts log in here.
    {
      name: "admin",
      use: { ...devices["Desktop Chrome"], baseURL: ADMIN_URL },
      grep: /@admin/,
    },
  ],
  webServer: process.env.CI
    ? undefined
    : {
        // Inherits this process's env (loaded from .env.test above), so Next
        // boots against the test Supabase project. Next does not override env
        // vars already present in process.env.
        command: `npx next dev --port ${PORT}`,
        url: APP_URL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
