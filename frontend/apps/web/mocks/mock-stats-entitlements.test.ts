import type { MockViewer } from './core/viewer';

let mockFetch: typeof import('./mock-fetch').mockFetch;

beforeEach(async () => {
  vi.resetModules();
  sessionStorage.clear();
  document.cookie = 'linker_mock_role=developer; path=/';
  mockFetch = (await import('./mock-fetch')).mockFetch;
});

afterEach(() => {
  document.cookie = 'linker_mock_role=; path=/; max-age=0';
  sessionStorage.clear();
});

const summaryUrl = '/api/v1/user/me/stats/summary';
const proUrls = [
  '/api/v1/user/me/stats/posts?days=30',
  '/api/v1/user/me/stats/recruiter-views?weeks=8',
];

async function expectFreeStats() {
  expect(await mockFetch(summaryUrl)).toMatchObject({ isPro: false, items: expect.any(Array) });
  for (const url of proUrls) {
    await expect(mockFetch(url)).rejects.toMatchObject({
      status: 403,
      code: 'PLAN_LIMIT',
      detail: { reason: 'stats' },
    });
  }
}

it('ends Pro stats after a refund and restores them after another confirmed mock checkout', async () => {
  expect(await mockFetch(summaryUrl)).toMatchObject({ isPro: true });
  await mockFetch('/api/v1/user/me/payments/demo-recent/refund', { method: 'POST' });
  await expectFreeStats();

  const order = await mockFetch<{ orderId: string; amount: number }>(
    '/api/v1/user/payments/checkout',
    {
      method: 'POST',
      body: JSON.stringify({ planKey: 'PRO', billing: 'MONTHLY' }),
    },
  );
  await mockFetch('/api/v1/user/payments/confirm', {
    method: 'POST',
    body: JSON.stringify({ ...order, paymentKey: `mock_${order.orderId}` }),
  });
  expect(await mockFetch(summaryUrl)).toMatchObject({ isPro: true });
  await expect(mockFetch(proUrls[0]!)).resolves.toHaveProperty('items');
  await expect(mockFetch(proUrls[1]!)).resolves.toHaveProperty('thisWeek');
});

it('keeps canceled Pro benefits through their end date and blocks them after expiry', async () => {
  await mockFetch('/api/v1/user/me/subscriptions/demo-personal/cancel', { method: 'POST' });
  expect(await mockFetch(summaryUrl)).toMatchObject({ isPro: true });

  const { buildViewer } = await import('./core/viewer');
  const { state, save } = await import('./fixtures/subscriptions');
  const { todayKst } = await import('@/lib/format/time');
  const viewer: MockViewer = buildViewer('developer');
  const data = state(viewer);
  const pro = data.subscriptions.find((sub) => sub.kind === 'PRO')!;
  pro.endsOn = todayKst();
  save(viewer, data);
  expect(await mockFetch(summaryUrl)).toMatchObject({ isPro: true });

  pro.endsOn = '2000-01-01';
  save(viewer, data);
  await expectFreeStats();
});
