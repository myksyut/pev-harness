import { defineConfig } from '@playwright/test';

// Playwright config for pev-harness sample-project dog food fixture (v1.4+)
// Static HTML + http-server (no Vite, minimal footprint).

export default defineConfig({
  testDir: './tests-e2e',
  outputDir: './artifacts/e2e/test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: './artifacts/e2e/playwright-report', open: 'never' }],
    ['json', { outputFile: './artifacts/e2e/results.json' }],
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
