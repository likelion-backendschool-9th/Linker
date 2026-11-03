import { defineConfig } from '@playwright/test';

import base from './playwright.config';

/** Browser-side WebView emulation, isolated from a developer's running web server. */
export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: 'http://localhost:3137' },
  webServer: {
    command: 'pnpm exec next dev --hostname localhost --port 3137',
    url: 'http://localhost:3137',
    env: { NEXT_PUBLIC_USE_MOCKS: 'true' },
    reuseExistingServer: false,
  },
});
