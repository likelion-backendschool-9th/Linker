import { MOCK_ROLE_COOKIE } from '@/lib/auth/mock-viewer';
import type { Payment, Subscription } from '@/features/subscription/management-api';
import { mockFetch } from './mock-fetch';
const login = (role: string) => {
  document.cookie = `${MOCK_ROLE_COOKIE}=${role}; path=/`;
};
const post = { method: 'POST' };
beforeEach(() => {
  login('developer');
});
afterEach(() => {
  document.cookie = `${MOCK_ROLE_COOKIE}=; path=/; max-age=0`;
});
async function purchase() {
  const order = await mockFetch<{ orderId: string; amount: number }>(
    '/api/v1/user/payments/checkout',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planKey: 'PRO', billing: 'MONTHLY' }),
    },
  );
  await mockFetch('/api/v1/user/payments/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...order, paymentKey: `mock_${order.orderId}` }),
  });
  return order;
}
it('cancels a confirmed checkout idempotently while keeping benefits until expiry', async () => {
  const order = await purchase();
  const subs = await mockFetch<{ items: Subscription[] }>('/api/v1/user/me/subscriptions');
  const sub = subs.items.find((item) => item.id === order.orderId)!;
  expect(sub.status).toBe('ACTIVE');
  const result = await mockFetch(`/api/v1/user/me/subscriptions/${order.orderId}/cancel`, post);
  expect(result).toMatchObject({
    status: 'CANCELING',
    endsOn: sub.nextBillingDate,
    nextBillingDate: null,
  });
  expect(await mockFetch(`/api/v1/user/me/subscriptions/${order.orderId}/cancel`, post)).toEqual(
    result,
  );
});
it('refunds once, ends benefits and prevents reapproval', async () => {
  const order = await purchase();
  const result = await mockFetch(`/api/v1/user/me/payments/${order.orderId}/refund`, post);
  expect(result).toMatchObject({ status: 'REFUNDED', refundable: false });
  expect(await mockFetch(`/api/v1/user/me/payments/${order.orderId}/refund`, post)).toEqual(result);
  const subs = await mockFetch<{ items: Subscription[] }>('/api/v1/user/me/subscriptions');
  expect(subs.items.find((item) => item.id === order.orderId)?.status).toBe('ENDED');
  await expect(
    mockFetch('/api/v1/user/payments/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...order, paymentKey: `mock_${order.orderId}` }),
    }),
  ).rejects.toMatchObject({ code: 'ORDER_FAILED' });
});
it('enforces the refund deadline and unused-benefit rule on the server', async () => {
  for (const id of ['demo-old', 'demo-flex-payment'])
    await expect(mockFetch(`/api/v1/user/me/payments/${id}/refund`, post)).rejects.toMatchObject({
      code: 'REFUND_NOT_ALLOWED',
    });
  const payments = await mockFetch<{ items: Payment[] }>('/api/v1/user/me/payments');
  expect(payments.items.find((item) => item.id === 'demo-flex-payment')).toMatchObject({
    refundable: false,
    refundReason: expect.stringContaining('혜택'),
  });
});
it('isolates orders across accounts and gives recruiters Scout only', async () => {
  const order = await purchase();
  login('recruiter');
  const subs = await mockFetch<{ items: Subscription[] }>('/api/v1/user/me/subscriptions');
  expect(subs.items.every((item) => item.kind === 'SCOUT')).toBe(true);
  await expect(
    mockFetch(`/api/v1/user/me/subscriptions/${order.orderId}/cancel`, post),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    mockFetch(`/api/v1/user/me/payments/${order.orderId}/refund`, post),
  ).rejects.toMatchObject({ status: 404 });
});
