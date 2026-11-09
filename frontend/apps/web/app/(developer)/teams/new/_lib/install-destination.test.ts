import { installDestination } from './install-destination';

const origin = 'http://localhost:3000';
const state = 'issued-state';

it('preserves the server-issued installation state on the exact GitHub App destination', () => {
  const url = 'https://github.com/apps/linker-test/installations/new?state=issued-state';
  expect(installDestination({ installUrl: url, state }, origin).href).toBe(url);
});

it('accepts a same-origin callback while retaining the session context and opaque return fields', () => {
  const result = installDestination(
    { installUrl: '/teams/new/callback?installation_id=777&state=issued-state', state },
    origin,
  );
  expect(result.origin).toBe(origin);
  expect(result.pathname).toBe('/teams/new/callback');
  expect(result.searchParams.get('installation_id')).toBe('777');
});

it.each([
  'javascript:alert(1)',
  'http://github.com/apps/linker/installations/new?state=issued-state',
  'https://github.com.evil.test/apps/linker/installations/new?state=issued-state',
  'https://name:password@github.com/apps/linker/installations/new?state=issued-state',
  'https://github.com:444/apps/linker/installations/new?state=issued-state',
  'https://other.test/teams/new/callback?state=issued-state',
  '/teams/new?state=issued-state',
  'https://github.com/login?state=issued-state',
])('rejects an unsafe or unrelated destination: %s', (installUrl) => {
  expect(() => installDestination({ installUrl, state }, origin)).toThrow();
});

it.each([
  { installUrl: 'https://github.com/apps/linker/installations/new?state=forged', state },
  {
    installUrl: 'https://github.com/apps/linker/installations/new?state=issued-state&state=forged',
    state,
  },
  { installUrl: 'https://github.com/apps/linker/installations/new#state=issued-state', state },
  { state },
  { installUrl: 'https://github.com/apps/linker/installations/new?state=issued-state' },
])('rejects missing or mismatched state without navigating', (response) => {
  expect(() => installDestination(response, origin)).toThrow();
});
