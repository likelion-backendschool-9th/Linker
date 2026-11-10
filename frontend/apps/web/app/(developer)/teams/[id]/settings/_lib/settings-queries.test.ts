import { QueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/api-fetch';
import { membersOptions, getOrCreateTeamInvite } from './settings-queries';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
});

it('maps the live flat member DTO into the settings view without inventing job labels', async () => {
  vi.mocked(apiFetch).mockResolvedValue({
    items: [
      {
        userId: 7,
        handle: 'member',
        name: '팀원',
        avatarUrl: null,
        role: 'MEMBER',
        githubOrgStatus: 'NOT_MEMBER',
        githubLogin: null,
        joinedAt: '2026-11-01T00:00:00Z',
      },
    ],
    count: 1,
    limit: 6,
  });
  const result = await new QueryClient().fetchQuery(membersOptions('1'));
  expect(result.items[0]).toEqual({
    user: { id: 7, login: 'member', name: '팀원', avatarUrl: null },
    role: 'MEMBER',
    githubOrgStatus: 'NOT_MEMBER',
    githubLogin: null,
    joinedAt: '2026-11-01T00:00:00Z',
    inGithubOrg: false,
    jobLabel: null,
  });
});

it('shares one code across concurrent copy/notify actions and replaces a revoked cached link', async () => {
  let nextId = 1;
  let revoked = false;
  vi.mocked(apiFetch).mockImplementation(async (_url, init) => {
    if (init?.method === 'POST')
      return {
        id: nextId++,
        code: `code-${nextId}`,
        expiresAt: '2099-01-01T00:00:00Z',
        createdBy: '오너',
      } as never;
    return { items: revoked ? [] : [{ id: 1 }] } as never;
  });
  const client = new QueryClient();
  const [copied, notified] = await Promise.all([
    getOrCreateTeamInvite(client, 1, 'owner'),
    getOrCreateTeamInvite(client, 1, 'owner'),
  ]);
  expect(copied.code).toBe(notified.code);
  expect(vi.mocked(apiFetch).mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(
    1,
  );
  expect((await getOrCreateTeamInvite(client, 1, 'owner')).code).toBe(copied.code);
  revoked = true;
  expect((await getOrCreateTeamInvite(client, 1, 'owner')).id).not.toBe(copied.id);
  expect(vi.mocked(apiFetch).mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(
    2,
  );
});

it('never reuses a different account cache or automatically retries invitation creation', async () => {
  const client = new QueryClient();
  vi.mocked(apiFetch).mockRejectedValue(new Error('연결 실패'));
  await expect(getOrCreateTeamInvite(client, 1, 'owner')).rejects.toThrow('연결 실패');
  expect(apiFetch).toHaveBeenCalledTimes(1);
  vi.mocked(apiFetch).mockResolvedValue({
    id: 1,
    code: 'fresh',
    expiresAt: '2099-01-01T00:00:00Z',
    createdBy: '오너',
  });
  await getOrCreateTeamInvite(client, 1, 'owner');
  await getOrCreateTeamInvite(client, 1, 'other-account');
  expect(vi.mocked(apiFetch).mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(
    3,
  );
});
