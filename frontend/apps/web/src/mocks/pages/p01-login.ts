import { get, post, type MockRoute } from '../core/define';

/**
 * 01 Start / login: `LoginController`.
 * The mock authorize URL goes straight to the mock login route (it sets the role cookie and redirects to
 * `returnTo`), so the real "GitHub → /auth/callback" hop is skipped. `/auth/callback` still works if opened.
 */
export const routes: MockRoute[] = [
  get('/api/v1/public/auth/github/authorize-url', ({ query }) => {
    const returnTo = query.get('returnTo') ?? '/feed';
    const role = query.get('mockRole') ?? 'developer';
    return {
      authorizeUrl: `/api/mock/login/${role}?returnTo=${encodeURIComponent(returnTo)}`,
      state: 'mock-state',
    };
  }),
  post('/api/v1/public/auth/github/callback', ({ body, setMockRole }) => {
    setMockRole('developer');
    return { isNew: false, restored: false, returnTo: String(body.returnTo ?? '/feed') };
  }),
];
