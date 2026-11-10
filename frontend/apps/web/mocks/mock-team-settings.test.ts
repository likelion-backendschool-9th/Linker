import { MOCK_ROLE_COOKIE } from '@/lib/auth/mock-viewer';
import { mockFetch } from './mock-fetch';
import type { ServerMembers } from '../app/(developer)/teams/[id]/settings/_lib/settings-queries';

beforeEach(() => {
  document.cookie = `${MOCK_ROLE_COOKIE}=developer; path=/`;
});
afterEach(() => {
  document.cookie = `${MOCK_ROLE_COOKIE}=; path=/; max-age=0`;
});

it('returns the flat live member DTO rather than hiding a nested-user contract mismatch', async () => {
  const members = await mockFetch<ServerMembers>('/api/v1/user/teams/1/members');
  expect(members.items[0]).toMatchObject({
    userId: expect.any(Number),
    handle: expect.any(String),
  });
  expect(members.items[0]).not.toHaveProperty('user');
});

it.each(['demo-read-only', 'demo-archived'])(
  'rejects accepting %s instead of simulating a successful join',
  async (code) => {
    await expect(
      mockFetch(`/api/v1/user/invites/${code}/accept`, { method: 'POST' }),
    ).rejects.toMatchObject({ status: 409, code: 'STATE_CONFLICT' });
  },
);
