import { MOCK_ROLE_COOKIE } from '@/lib/auth/mock-viewer';
import { SUBSCRIPTION_PRICE } from '@/lib/policy';

import { mockFetch } from './mock-fetch';
import { TEAM_MEMBERS } from './fixtures/teams';

const login = (role: string) => {
  document.cookie = `${MOCK_ROLE_COOKIE}=${role}; path=/`;
};
const post = (body: unknown) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
type Order = { orderId: string; amount: number };
beforeEach(() => login('developer'));
afterEach(() => {
  document.cookie = `${MOCK_ROLE_COOKIE}=; path=/; max-age=0`;
});

it('uses the server price, rejects amount/key tampering, and confirms idempotently', async () => {
  const order = await mockFetch<Order>(
    '/api/v1/user/payments/checkout',
    post({ planKey: 'PRO', billing: 'YEARLY', amount: 1 }),
  );
  expect(order.amount).toBe(SUBSCRIPTION_PRICE.proYearly);
  const correct = {
    orderId: order.orderId,
    amount: order.amount,
    paymentKey: `mock_${order.orderId}`,
  };
  await expect(
    mockFetch('/api/v1/user/payments/confirm', post({ ...correct, amount: 1 })),
  ).rejects.toMatchObject({ code: 'AMOUNT_MISMATCH' });
  await expect(
    mockFetch('/api/v1/user/payments/confirm', post({ ...correct, paymentKey: 'fake' })),
  ).rejects.toMatchObject({ code: 'INVALID_PAYMENT' });
  const result = await mockFetch('/api/v1/user/payments/confirm', post(correct));
  expect(result).toMatchObject({ status: 'ACTIVE', planKey: 'PRO' });
  expect(await mockFetch('/api/v1/user/payments/confirm', post(correct))).toEqual(result);
});
it('enforces plan/role/billing/team ownership on order creation and approval', async () => {
  const order = await mockFetch<Order>(
    '/api/v1/user/payments/checkout',
    post({ planKey: 'PRO', billing: 'MONTHLY' }),
  );
  login('recruiter');
  await expect(
    mockFetch('/api/v1/user/payments/checkout', post({ planKey: 'PRO', billing: 'MONTHLY' })),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    mockFetch(
      '/api/v1/user/payments/confirm',
      post({ orderId: order.orderId, amount: order.amount, paymentKey: `mock_${order.orderId}` }),
    ),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    mockFetch('/api/v1/user/payments/checkout', post({ planKey: 'SCOUT', billing: 'YEARLY' })),
  ).rejects.toMatchObject({ status: 403, code: 'PLAN_MISMATCH' });
  login('developer');
  await expect(
    mockFetch('/api/v1/user/payments/checkout', post({ planKey: 'PRO', billing: 'WEEKLY' })),
  ).rejects.toMatchObject({ status: 400, code: 'INVALID_BILLING' });
  await expect(
    mockFetch(
      '/api/v1/user/payments/checkout',
      post({ planKey: 'FLEX', billing: 'YEARLY', teamId: 1 }),
    ),
  ).resolves.toMatchObject({ planKey: 'FLEX', billing: 'YEARLY', teamId: 1 });
  login('developer');
  await expect(
    mockFetch(
      '/api/v1/user/payments/checkout',
      post({ planKey: 'FLEX', billing: 'MONTHLY', teamId: 2 }),
    ),
  ).rejects.toMatchObject({ status: 403 });
});
it('uses current team headcount for Flex rather than client-supplied totals', async () => {
  const members = TEAM_MEMBERS[1]!;
  const originalLength = members.length;
  try {
    while (members.length < 7) members.push({ ...members[0]! });
    const order = await mockFetch<Order>(
      '/api/v1/user/payments/checkout',
      post({ planKey: 'FLEX', billing: 'MONTHLY', teamId: 1, amount: 1 }),
    );
    expect(order.amount).toBe(9800);
  } finally {
    members.splice(originalLength);
  }
});
it('does not activate a failed order', async () => {
  const order = await mockFetch<Order>(
    '/api/v1/user/payments/checkout',
    post({ planKey: 'PRO', billing: 'MONTHLY' }),
  );
  await mockFetch(`/api/v1/user/payments/${order.orderId}/fail`, post({ code: 'MOCK_DECLINED' }));
  await expect(
    mockFetch(
      '/api/v1/user/payments/confirm',
      post({ orderId: order.orderId, amount: order.amount, paymentKey: `mock_${order.orderId}` }),
    ),
  ).rejects.toMatchObject({ code: 'ORDER_FAILED' });
});
