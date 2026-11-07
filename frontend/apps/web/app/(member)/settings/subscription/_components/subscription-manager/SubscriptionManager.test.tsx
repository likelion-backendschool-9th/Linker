import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Payment, Subscription } from '@/features/subscription/management-api';
import { apiFetch } from '@/lib/api/api-fetch';
import { renderWithProviders } from '@/test/render-with-providers';

import { SubscriptionManager } from './SubscriptionManager';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const fetchMock = vi.mocked(apiFetch);

const pro: Subscription = {
  subscriptionId: 41,
  planKey: 'PRO',
  status: 'ACTIVE',
  billing: 'MONTHLY',
  teamId: null,
  teamName: null,
  expiresOn: '2026-12-08',
  nextBillingOn: null,
  cancelAtPeriodEnd: false,
  seats: null,
  nextSeats: null,
  nextAmount: null,
};
const flex: Subscription = {
  ...pro,
  subscriptionId: 42,
  planKey: 'FLEX',
  teamId: 1,
  teamName: '내 팀',
  cancelAtPeriodEnd: true,
  seats: 7,
  nextSeats: 8,
  nextAmount: 11700,
};
const paid = (overrides: Partial<Payment>): Payment => ({
  paymentId: 1,
  orderName: 'Pro 월간 구독',
  planKey: 'PRO',
  billing: 'MONTHLY',
  teamId: null,
  amount: 2900,
  status: 'DONE',
  method: '카드',
  approvedAt: '2026-11-07T05:00:00Z',
  canceledAt: null,
  refundedAmount: 0,
  refundable: false,
  refundReason: null,
  ...overrides,
});
const started = '이미 혜택이 시작된 결제는 환불할 수 없어요. 해지하면 남은 기간까지 쓸 수 있어요.';

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url, init) => {
    if (init?.method === 'POST') return { ...pro, cancelAtPeriodEnd: true };
    if (url.includes('/me/subscriptions')) return { items: [pro, flex] };
    return {
      items: [
        paid({ paymentId: 9, refundable: true }),
        paid({ paymentId: 8, refundReason: started }),
        paid({ paymentId: 7, status: 'CANCELED', refundedAmount: 2900 }),
      ],
      nextCursor: null,
    };
  });
});

it('shows running and canceled subscriptions from the server fields', async () => {
  renderWithProviders(<SubscriptionManager />, { viewer: { role: 'developer', login: 'dev' } });
  const proCard = (await screen.findByRole('heading', { name: 'Pro' })).closest('article')!;
  expect(within(proCard).getByText('이용 중')).toBeVisible();
  expect(within(proCard).getByText('이용 기간 만료일')).toBeVisible();

  const flexCard = screen.getByRole('heading', { name: '내 팀 · Flex' }).closest('article')!;
  expect(within(flexCard).getByText('해지 예약')).toBeVisible();
  expect(within(flexCard).getByText('혜택 종료일')).toBeVisible();
  expect(within(flexCard).getByText(/결제 인원 7명/)).toBeVisible();
  expect(within(flexCard).queryByRole('button', { name: /해지하기/ })).not.toBeInTheDocument();
});

it('shows the Policy refund reason and refund state for each payment', async () => {
  renderWithProviders(<SubscriptionManager />, { viewer: { role: 'developer', login: 'dev' } });
  expect(await screen.findByText(started)).toBeVisible();
  expect(screen.getAllByRole('button', { name: /환불하기/ })).toHaveLength(1);
  expect(screen.getByText(/환불 완료/)).toBeVisible();
});

it('cancels with the numeric subscription id', async () => {
  renderWithProviders(<SubscriptionManager />, { viewer: { role: 'developer', login: 'dev' } });
  const proCard = (await screen.findByRole('heading', { name: 'Pro' })).closest('article')!;
  await userEvent.click(within(proCard).getByRole('button', { name: /해지하기/ }));
  await userEvent.click(await screen.findByRole('button', { name: '해지 예약하기' }));
  expect(
    fetchMock.mock.calls.some(
      ([url, init]) =>
        init?.method === 'POST' && url.endsWith('/api/v1/user/me/subscriptions/41/cancel'),
    ),
  ).toBe(true);
});
