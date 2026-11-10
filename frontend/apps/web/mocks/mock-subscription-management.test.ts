import { MOCK_ROLE_COOKIE } from '@/lib/auth/mock-viewer';
import type { Payment, Subscription } from '@/features/subscription/management-api';

let mockFetch: typeof import('./mock-fetch').mockFetch;
const login = (role: string) => {
  document.cookie = `${MOCK_ROLE_COOKIE}=${role}; path=/`;
};
const post = { method: 'POST' };
const json = (body: unknown) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
beforeEach(async () => {
  vi.resetModules();
  sessionStorage.clear();
  login('developer');
  mockFetch = (await import('./mock-fetch')).mockFetch;
});
afterEach(() => {
  document.cookie = `${MOCK_ROLE_COOKIE}=; path=/; max-age=0`;
  sessionStorage.clear();
});
const subscriptions = async () =>
  (await mockFetch<{ items: Subscription[] }>('/api/v1/user/me/subscriptions')).items;
const payments = async () =>
  (await mockFetch<{ items: Payment[]; nextCursor: string | null }>('/api/v1/user/me/payments'))
    .items;
async function purchase(body: Record<string, unknown> = { planKey: 'PRO', billing: 'MONTHLY' }) {
  const order = await mockFetch<{ orderId: string; amount: number }>(
    '/api/v1/user/payments/checkout',
    json(body),
  );
  const result = await mockFetch<{ expiresOn: string }>(
    '/api/v1/user/payments/confirm',
    json({ ...order, paymentKey: `mock_${order.orderId}` }),
  );
  return { order, result };
}

it('answers with the server contract: numeric ids, ACTIVE + cancelAtPeriodEnd, DONE payments', async () => {
  const [pro, flex] = await subscriptions();
  expect(pro).toMatchObject({
    subscriptionId: expect.any(Number),
    planKey: 'PRO',
    status: 'ACTIVE',
    cancelAtPeriodEnd: false,
    expiresOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    nextBillingOn: null,
    seats: null,
    nextSeats: null,
    nextAmount: null,
  });
  expect(flex).toMatchObject({ planKey: 'FLEX', teamName: expect.any(String) });
  expect(flex!.seats).toEqual(expect.any(Number));
  expect(flex!.nextAmount).toEqual(expect.any(Number));
  const items = await payments();
  expect(items.every((item) => item.status === 'DONE' && typeof item.paymentId === 'number')).toBe(
    true,
  );
});

it('gives the Policy ch. 12 reason for each non-refundable payment and allows only the latest future period', async () => {
  const items = await payments();
  const reasons = Object.fromEntries(items.map((item) => [item.paymentId, item.refundReason]));
  expect(items.filter((item) => item.refundable).map((item) => item.paymentId)).toEqual([7103]);
  expect(reasons[7101]).toBe('결제 후 7일이 지나 환불할 수 없어요.');
  expect(reasons[7102]).toBe('가장 최근 결제부터 환불할 수 있어요.');
  expect(reasons[7104]).toBe(
    '이미 혜택이 시작된 결제는 환불할 수 없어요. 해지하면 남은 기간까지 쓸 수 있어요.',
  );
  await expect(mockFetch('/api/v1/user/me/payments/7102/refund', post)).rejects.toMatchObject({
    status: 409,
    code: 'REFUND_NOT_LATEST',
  });
  await expect(mockFetch('/api/v1/user/me/payments/7104/refund', post)).rejects.toMatchObject({
    code: 'REFUND_BENEFITS_USED',
  });
});

it('a first payment cannot be refunded; a second one takes back only its own period', async () => {
  login('recruiter');
  expect(await subscriptions()).toEqual([]);
  login('developer');
  const flexTeam = (await subscriptions()).find((item) => item.planKey === 'FLEX')!;
  const before = flexTeam.expiresOn;
  const { result } = await purchase({
    planKey: 'FLEX',
    billing: 'MONTHLY',
    teamId: flexTeam.teamId,
  });
  expect(result.expiresOn > before).toBe(true);
  const latest = (await payments())[0]!;
  expect(latest).toMatchObject({ planKey: 'FLEX', refundable: true, refundReason: null });

  const refunded = await mockFetch<Payment>(
    `/api/v1/user/me/payments/${latest.paymentId}/refund`,
    post,
  );
  expect(refunded).toMatchObject({
    status: 'CANCELED',
    refundable: false,
    refundedAmount: latest.amount,
  });
  expect(await mockFetch(`/api/v1/user/me/payments/${latest.paymentId}/refund`, post)).toEqual(
    refunded,
  );
  expect((await subscriptions()).find((item) => item.planKey === 'FLEX')?.expiresOn).toBe(before);
});

it('cancels idempotently while keeping benefits until expiresOn', async () => {
  const pro = (await subscriptions()).find((item) => item.planKey === 'PRO')!;
  const result = await mockFetch<Subscription>(
    `/api/v1/user/me/subscriptions/${pro.subscriptionId}/cancel`,
    post,
  );
  expect(result).toMatchObject({
    status: 'ACTIVE',
    cancelAtPeriodEnd: true,
    expiresOn: pro.expiresOn,
  });
  expect(
    await mockFetch(`/api/v1/user/me/subscriptions/${pro.subscriptionId}/cancel`, post),
  ).toEqual(result);
});

it('isolates accounts and shows recruiters the Scout card while its checkout stays closed', async () => {
  const pro = (await subscriptions()).find((item) => item.planKey === 'PRO')!;
  login('recruiter');
  expect(await mockFetch('/api/v1/user/plans')).toMatchObject({
    plans: [{ key: 'SCOUT', yearly: null }],
    currentPlan: 'FREE',
  });
  await expect(
    mockFetch('/api/v1/user/payments/checkout', json({ planKey: 'SCOUT', billing: 'MONTHLY' })),
  ).rejects.toMatchObject({ status: 403, code: 'PLAN_MISMATCH' });
  await expect(
    mockFetch(`/api/v1/user/me/subscriptions/${pro.subscriptionId}/cancel`, post),
  ).rejects.toMatchObject({ status: 404 });
  await expect(mockFetch('/api/v1/user/me/payments/7103/refund', post)).rejects.toMatchObject({
    status: 404,
  });
});
