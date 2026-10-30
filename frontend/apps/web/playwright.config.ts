import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:3000' },
  // Mobile first: a 360px Android viewport is the default project
  projects: [
    { name: 'mobile', use: { ...devices['Galaxy S9+'], viewport: { width: 360, height: 740 } } },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
