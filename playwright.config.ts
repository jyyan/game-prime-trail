import { defineConfig, devices } from '@playwright/test';

const DEV_PORT = 4173;
const WRANGLER_PORT = 8788;

export default defineConfig({
  testDir: 'e2e',
  // The level library is a ~200 KB dynamic import; give the first load and full fills room.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  webServer: [
    {
      command: `VITE_E2E=1 pnpm dev --port ${DEV_PORT} --strictPort`,
      url: `http://localhost:${DEV_PORT}`,
      timeout: 120_000,
    },
    {
      // Spec §12.3 scenario 7: production build behind `wrangler dev` checks `not_found_handling`.
      command: `pnpm build && pnpm exec wrangler dev --port ${WRANGLER_PORT} --ip 127.0.0.1`,
      url: `http://127.0.0.1:${WRANGLER_PORT}`,
      timeout: 240_000,
      env: { WRANGLER_SEND_METRICS: 'false' },
    },
  ],
  use: { baseURL: `http://localhost:${DEV_PORT}` },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'wrangler',
      testMatch: /07-.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: `http://127.0.0.1:${WRANGLER_PORT}` },
    },
  ],
});
