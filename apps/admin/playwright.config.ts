import { defineConfig, devices } from "@playwright/test";

/**
 * Dedicated ports, not the usual 3001/5173: an e2e run boots its own backend
 * with a fresh in-memory store and is free to mutate it, so it can never
 * disturb — or be disturbed by — a dev session someone already has open.
 */
export const BACKEND_PORT = 3101;
export const ADMIN_PORT = 5174;

export const API_URL = `http://localhost:${BACKEND_PORT}`;
const BASE_URL = `http://localhost:${ADMIN_PORT}`;

/**
 * Watching the run (`--headed`) means watching one thing happen, not nineteen
 * browser windows fight for the screen — so it drops to a single worker.
 */
const headed = process.argv.includes("--headed");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "list" : "html",
  workers: headed ? 1 : undefined,

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    // Headless, these steps land faster than an eye can follow them. A little
    // slack makes a headed run something you can actually read.
    launchOptions: { slowMo: headed ? 250 : 0 },
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  webServer: [
    {
      command: "pnpm --filter backend dev",
      url: `${API_URL}/health`,
      reuseExistingServer: !process.env.CI,
      env: {
        PORT: String(BACKEND_PORT),
        CORS_ORIGIN: BASE_URL,
        // Passed explicitly rather than leaning on apps/backend/.env, so the
        // suite runs on a clean checkout. Node's --env-file does not override
        // variables that are already set, so these win.
        JWT_SECRET: "e2e-secret-value-not-used-in-production",
      },
    },
    {
      // `pnpm run dev -- --port` would hand Vite a literal `--`, which it
      // ignores — leaving the server on its configured 5173 while Playwright
      // waited on 5174 until it timed out. Invoke Vite directly instead, and
      // let --strictPort fail loudly rather than drift to another port.
      command: `pnpm --filter admin exec vite --port ${ADMIN_PORT} --strictPort`,
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      env: { VITE_API_URL: API_URL },
    },
  ],
});
