import { defineConfig } from '@playwright/test';
import base from './playwright.config';

/** Isolated, explicitly mocked browser verification; never reuse a real API server. */
export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: 'http://localhost:3100' },
  workers: 1,
  webServer: [
    {
      command: 'pnpm dev:mock --port 3100',
      url: 'http://localhost:3100',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'node e2e/loading-fixture/server.mjs',
      url: 'http://127.0.0.1:3101',
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
