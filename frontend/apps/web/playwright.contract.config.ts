import { defineConfig } from '@playwright/test';

// Isolate persisted Next fetch-cache entries from the upstream requests under test.
const apiPort = process.env.LINKER_CONTRACT_API_PORT ?? String(22_000 + (process.pid % 10_000));
process.env.LINKER_CONTRACT_API_PORT = apiPort;
const upstream = `http://localhost:${apiPort}`;

/** Normal frontend/API transport; only the upstream OAuth/session HTTP server is a test double. */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'native-auth-contract.spec.ts',
  workers: 1,
  use: { baseURL: 'http://localhost:3137', browserName: 'chromium' },
  webServer: [
    {
      command: 'node e2e/fixtures/native-contract-server.mjs',
      url: `${upstream}/health`,
    },
    {
      command: 'pnpm exec next dev --hostname localhost --port 3137',
      url: 'http://localhost:3137',
      env: {
        NEXT_PUBLIC_USE_MOCKS: 'false',
        NEXT_PUBLIC_API_BASE_URL: upstream,
        API_INTERNAL_URL: upstream,
        NEXT_PUBLIC_SITE_URL: 'http://localhost:3137',
      },
    },
  ],
});
