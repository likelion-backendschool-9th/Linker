import { MOCK_ROLE_COOKIE } from '@/lib/auth/mock-viewer';
import { ApiError } from '@/lib/api/api-error';

import { mockFetch } from './mock-fetch';
import { routes } from './routes';

function loginAs(role: string) {
  document.cookie = `${MOCK_ROLE_COOKIE}=${role}; path=/`;
}

afterEach(() => {
  document.cookie = `${MOCK_ROLE_COOKIE}=; path=/; max-age=0`;
});

async function errorOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error as ApiError;
  }
  throw new Error('expected the call to fail');
}

describe('mock routes', () => {
  it('has no duplicate method + path', () => {
    const keys = routes.map((route) => `${route.method} ${route.path}`);
    expect(keys.filter((key, index) => keys.indexOf(key) !== index)).toEqual([]);
  });

  it('only uses /api/v1 paths with a known permission prefix', () => {
    for (const route of routes) {
      expect(route.path).toMatch(/^\/api\/v1\/(public|user|recruiter|admin)\//);
    }
  });
});

describe('mockFetch', () => {
  it('answers public reads as a guest', async () => {
    const feed = await mockFetch<{ items: unknown[] }>('/api/v1/public/feed');
    expect(feed.items.length).toBeGreaterThan(0);
  });

  it('rejects user APIs for guests with LOGIN_REQUIRED', async () => {
    const error = await errorOf(mockFetch('/api/v1/user/me'));
    expect(error).toMatchObject({ status: 401, code: 'LOGIN_REQUIRED' });
  });

  it('returns the member for the role cookie', async () => {
    loginAs('developer');
    const me = await mockFetch<{ userType: string; isAdmin: boolean; onboarded: boolean }>(
      '/api/v1/user/me',
    );
    expect(me).toMatchObject({ userType: 'DEVELOPER', isAdmin: false, onboarded: true });

    loginAs('operator');
    expect((await mockFetch<{ isAdmin: boolean }>('/api/v1/user/me')).isAdmin).toBe(true);

    loginAs('newcomer');
    expect((await mockFetch<{ onboarded: boolean }>('/api/v1/user/me')).onboarded).toBe(false);
  });

  it('blocks developer-only writes for recruiters and recruiter APIs for developers', async () => {
    loginAs('recruiter');
    expect(
      await errorOf(mockFetch('/api/v1/user/posts/1/likes', { method: 'POST' })),
    ).toMatchObject({
      status: 403,
      code: 'DEVELOPER_ONLY',
    });

    loginAs('developer');
    expect(await errorOf(mockFetch('/api/v1/recruiter/offers'))).toMatchObject({ status: 403 });
    expect(await errorOf(mockFetch('/api/v1/admin/audit-logs'))).toMatchObject({ status: 403 });
  });

  it('lists report cases for an operator without OTP', async () => {
    vi.useFakeTimers();
    try {
      loginAs('operator');
      const cases = mockFetch<{ items: unknown[] }>('/api/v1/admin/report-cases?status=PENDING');
      await vi.advanceTimersByTimeAsync(150);
      await expect(cases).resolves.toMatchObject({ items: expect.any(Array) });
    } finally {
      vi.useRealTimers();
    }
  });

  it('prefers static segments over :param ones', async () => {
    loginAs('developer');
    const template = await mockFetch<{ key: string }>(
      '/api/v1/user/teams/1/issue-templates/default:task',
    );
    expect(template.key).toBe('default:task');
  });

  it('keeps state across calls and never leaks references', async () => {
    loginAs('developer');
    await mockFetch('/api/v1/user/users/seoyeon-park/follow', { method: 'POST' });
    const profile = await mockFetch<{ isFollowing: boolean }>('/api/v1/public/users/seoyeon-park');
    expect(profile.isFollowing).toBe(true);
    profile.isFollowing = false;
    expect(
      (await mockFetch<{ isFollowing: boolean }>('/api/v1/public/users/seoyeon-park')).isFollowing,
    ).toBe(true);
  });

  it('turns a status change into a closed GitHub issue', async () => {
    loginAs('developer');
    await mockFetch('/api/v1/user/teams/1/issues/1018/status', {
      method: 'PUT',
      body: JSON.stringify({ status: 'DONE' }),
    });
    const issue = await mockFetch<{ state: string }>('/api/v1/user/teams/1/issues/1018');
    expect(issue.state).toBe('CLOSED');
  });

  it('answers unknown routes with MOCK_NOT_IMPLEMENTED', async () => {
    expect(await errorOf(mockFetch('/api/v1/public/nope'))).toMatchObject({
      status: 404,
      code: 'MOCK_NOT_IMPLEMENTED',
    });
  });
});
