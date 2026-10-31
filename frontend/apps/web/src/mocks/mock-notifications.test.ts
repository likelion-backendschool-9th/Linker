import { MOCK_ROLE_COOKIE } from '@/lib/auth/mock-viewer';

import { mockFetch } from './mock-fetch';

type Item = { id: number; read: boolean; appeal?: { sanctionId: number; submitted: boolean } };
const login = (role: string) => {
  document.cookie = `${MOCK_ROLE_COOKIE}=${role}; path=/`;
};
afterEach(() => {
  document.cookie = `${MOCK_ROLE_COOKIE}=; path=/; max-age=0`;
});

it('isolates read status between developer and recruiter accounts', async () => {
  login('recruiter');
  const before = await mockFetch<{ count: number }>('/api/v1/user/notifications/unread-count');
  login('developer');
  await mockFetch('/api/v1/user/notifications/read-all', { method: 'POST' });
  expect(await mockFetch('/api/v1/user/notifications/unread-count')).toEqual({ count: 0 });
  login('recruiter');
  expect(await mockFetch('/api/v1/user/notifications/unread-count')).toEqual(before);
});

it('validates appeal ownership and accepts only one appeal per sanction', async () => {
  login('developer');
  const page = await mockFetch<{ items: Item[] }>('/api/v1/user/notifications');
  const item = page.items.find((n) => n.appeal)!;
  const request = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sanctionId: item.appeal!.sanctionId, body: '검토를 부탁드려요.' }),
  };
  login('recruiter');
  await expect(mockFetch('/api/v1/user/appeals', request)).rejects.toMatchObject({ status: 404 });
  login('developer');
  await expect(
    mockFetch('/api/v1/user/appeals', {
      ...request,
      body: JSON.stringify({ sanctionId: item.appeal!.sanctionId, body: '   ' }),
    }),
  ).rejects.toMatchObject({ status: 400 });
  await expect(mockFetch('/api/v1/user/appeals', request)).resolves.toHaveProperty('appealId');
  await expect(mockFetch('/api/v1/user/appeals', request)).rejects.toMatchObject({
    status: 409,
    code: 'ALREADY_APPEALED',
  });
});
