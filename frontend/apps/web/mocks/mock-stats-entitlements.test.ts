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

async function endProIn(days: number) {
  const { buildViewer } = await import('./core/viewer');
  const { endPersonalPlanOn } = await import('./fixtures/subscriptions');
  const viewer: MockViewer = buildViewer('developer');
  endPersonalPlanOn(viewer, 'PRO', days);
}

it('keeps Pro after refunding a future period, ends it on expiry and restores it after checkout', async () => {
  expect(await mockFetch(summaryUrl)).toMatchObject({ isPro: true });
  // 7103 paid the next period only; the period already running stays (Policy ch. 11 refund).
  await mockFetch('/api/v1/user/me/payments/7103/refund', { method: 'POST' });
  expect(await mockFetch(summaryUrl)).toMatchObject({ isPro: true });
  await endProIn(-1);
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

it('keeps canceled Pro benefits until the period ends and blocks them after expiry', async () => {
  await mockFetch('/api/v1/user/me/subscriptions/7001/cancel', { method: 'POST' });
  expect(await mockFetch(summaryUrl)).toMatchObject({ isPro: true });
  await endProIn(0.01);
  expect(await mockFetch(summaryUrl)).toMatchObject({ isPro: true });
  await endProIn(-0.01);
  await expectFreeStats();
});
