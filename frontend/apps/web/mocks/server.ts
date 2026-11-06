import { setupServer } from 'msw/node';

import { handlers } from './handlers';

/** Node-side MSW for Vitest; started in vitest.setup.ts. Unhandled requests fail the test. */
export const server = setupServer(...handlers);
