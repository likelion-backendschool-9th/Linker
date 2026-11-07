import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

export default defineConfig({
  ...baseConfig,
  testMatch: ['d-chat-share.spec.ts'],
  workers: 1,
  use: { ...baseConfig.use, baseURL: 'http://localhost:3142' },
  webServer: {
    command: 'pnpm exec next dev --hostname localhost --port 3142',
    url: 'http://localhost:3142',
    reuseExistingServer: false,
    timeout: 180_000,
    env: { NEXT_PUBLIC_USE_MOCKS: 'true', NEXT_PUBLIC_SITE_URL: 'http://localhost:3142' },
  },
});
