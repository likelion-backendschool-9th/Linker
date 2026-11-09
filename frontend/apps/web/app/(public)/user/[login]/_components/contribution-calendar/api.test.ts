import { apiFetch } from '@/lib/api/api-fetch';

import { fetchContributions } from './api';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));

it('requests the contribution month using the WBS profile route', async () => {
  vi.mocked(apiFetch).mockResolvedValue({
    month: '2026-11',
    days: [{ date: '2026-11-01', count: 3 }],
    asOf: '2026-11-09T00:00:00Z',
  });

  await expect(fetchContributions('octocat', '2026-11')).resolves.toEqual({
    month: '2026-11',
    days: [{ date: '2026-11-01', count: 3 }],
    asOf: '2026-11-09T00:00:00Z',
  });
  expect(apiFetch).toHaveBeenCalledWith(
    '/api/v1/public/user/octocat/contributions?month=2026-11',
  );
});
