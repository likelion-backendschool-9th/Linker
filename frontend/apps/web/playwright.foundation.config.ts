import { defineConfig } from '@playwright/test';

import baseConfig from './playwright.config';

/** Frontend foundation checks run against a fresh, explicit mock-mode server. */
export default defineConfig({
  ...baseConfig,
  testMatch: ['foundation.spec.ts', 'c-policy-seo.spec.ts'],
  workers: 1,
  use: { ...baseConfig.use, baseURL: 'http://localhost:3138' },
  webServer: {
    command: 'pnpm exec next dev --hostname localhost --port 3138',
    url: 'http://localhost:3138',
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      NEXT_PUBLIC_USE_MOCKS: 'true',
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3138',
    },
  },
});
