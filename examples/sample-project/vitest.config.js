import { defineConfig } from 'vitest/config';

// Separate unit tests (vitest) from E2E tests (Playwright).
// vitest only runs tests/ directory; tests-e2e/ is owned by Playwright.

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    exclude: ['tests-e2e/**', 'node_modules/**'],
  },
});
