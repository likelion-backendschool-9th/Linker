import type { RequestHandler } from 'msw';

/**
 * Default MSW handlers for tests. Add orval-generated mocks here once `packages/api` is generated
 * (e.g. `getP24FeedMock()`); screens override per test with `server.use()` from their `_lib/handlers.ts`.
 */
export const handlers: RequestHandler[] = [];
