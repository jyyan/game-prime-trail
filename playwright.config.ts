import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  webServer: {
    command: 'VITE_E2E=1 pnpm dev --port 4173',
    url: 'http://localhost:4173',
  },
  use: { baseURL: 'http://localhost:4173' },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
});
