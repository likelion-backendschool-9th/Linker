import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Payment, Subscription } from '@/features/subscription/management-api';
import { apiFetch } from '@/lib/api/api-fetch';
import { toast } from '@/stores/toast-store';
import { renderWithProviders } from '@/test/render-with-providers';

import { SubscriptionManager } from './SubscriptionManager';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
vi.mock('@/stores/toast-store', () => ({ toast: vi.fn() }));
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
  amount: 2900,
  payerName: null,
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
  amount: 9800,
  payerName: '이준호',
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
        paid({ paymentId: 6, approvedAt: '2026-08-03T05:00:00Z' }),
      ],
      nextCursor: null,
    };
  });
});

it('shows each subscription as the Figma plan card and info box', async () => {
  renderWithProviders(<SubscriptionManager />, { viewer: { role: 'developer', login: 'dev' } });
  const proSection = await screen.findByRole('region', { name: 'Pro 요금제' });
  expect(within(proSection).getByRole('heading', { name: 'Pro 요금제' })).toBeVisible();
  expect(within(proSection).getByText('현재 사용 중인 요금제')).toBeVisible();
  expect(within(proSection).getByText('이용 만료일')).toBeVisible();
  expect(within(proSection).getByText('2026년 12월 8일')).toBeVisible();
  expect(within(proSection).getByText('월간 결제')).toBeVisible();
  expect(within(proSection).getByText('2,900(Pro)')).toBeVisible();
  expect(within(proSection).getByRole('link', { name: '요금제 변경하기' })).toHaveAttribute(
    'href',
    '/subscribe',
  );

  const flexSection = screen.getByRole('region', { name: 'Flex 요금제 · 내 팀' });
  expect(within(flexSection).getByText('혜택 종료일')).toBeVisible();
  expect(within(flexSection).getByText('9,800(Flex)')).toBeVisible();
  expect(within(flexSection).getByText('8명')).toBeVisible();
  expect(within(flexSection).getByText('이준호')).toBeVisible();
  expect(within(flexSection).getByText(/해지 예약됨/)).toBeVisible();
  expect(
    within(flexSection).queryByRole('button', { name: /요금제 해지/ }),
  ).not.toBeInTheDocument();
  expect(within(flexSection).getByRole('link', { name: '요금제 변경하기' })).toHaveAttribute(
    'href',
    '/subscribe?teamId=1',
  );
  await userEvent.click(within(flexSection).getByRole('button', { name: '결제 담당자 변경' }));
  expect(toast).toHaveBeenCalledWith('미구현 기능입니다.');
});

it('shows the free plan card when nothing is paid', async () => {
  fetchMock.mockImplementation(async () => ({ items: [], nextCursor: null }));
  renderWithProviders(<SubscriptionManager />, { viewer: { role: 'developer', login: 'dev' } });
  expect(await screen.findByRole('heading', { name: '무료 요금제' })).toBeVisible();
  expect(screen.getByRole('link', { name: '요금제 변경하기' })).toHaveAttribute(
    'href',
    '/subscribe',
  );
  expect(screen.getByText('결제 내역이 없어요.')).toBeVisible();
});

it('lists three payments with amounts, a refund button only where allowed, and the rest behind 전체 보기', async () => {
  renderWithProviders(<SubscriptionManager />, { viewer: { role: 'developer', login: 'dev' } });
  const history = await screen.findByRole('region', { name: '결제 내역' });
  expect(await within(history).findAllByRole('listitem')).toHaveLength(3);
  expect(within(history).getAllByText('2,900 원 결제')).toHaveLength(2);
  expect(within(history).getByText('2,900 원 환불')).toBeVisible();
  expect(within(history).getAllByRole('button', { name: /^환불/ })).toHaveLength(1);
  await userEvent.click(within(history).getByRole('button', { name: '전체 보기' }));
  expect(within(history).getAllByRole('listitem')).toHaveLength(4);
  expect(within(history).getByText('2026년 8월 3일')).toBeVisible();
  expect(within(history).queryByRole('button', { name: '전체 보기' })).not.toBeInTheDocument();
});

it('cancels from the Figma modal with the numeric subscription id', async () => {
  renderWithProviders(<SubscriptionManager />, { viewer: { role: 'developer', login: 'dev' } });
  const proSection = await screen.findByRole('region', { name: 'Pro 요금제' });
  await userEvent.click(within(proSection).getByRole('button', { name: /요금제 해지/ }));
  const dialog = await screen.findByRole('alertdialog', { name: '요금제 해지' });
  expect(within(dialog).getByText(/2026년 12월 8일까지만 혜택을 받을 수 있어요/)).toBeVisible();
  await userEvent.click(within(dialog).getByRole('button', { name: '해지 하기' }));
  expect(
    fetchMock.mock.calls.some(
      ([url, init]) =>
        init?.method === 'POST' && url.endsWith('/api/v1/user/me/subscriptions/41/cancel'),
    ),
  ).toBe(true);
});

it('refunds from the same modal style', async () => {
  renderWithProviders(<SubscriptionManager />, { viewer: { role: 'developer', login: 'dev' } });
  const history = await screen.findByRole('region', { name: '결제 내역' });
  await userEvent.click(await within(history).findByRole('button', { name: /^환불/ }));
  const dialog = await screen.findByRole('alertdialog', { name: '전액 환불' });
  await userEvent.click(within(dialog).getByRole('button', { name: '환불 하기' }));
  expect(
    fetchMock.mock.calls.some(
      ([url, init]) => init?.method === 'POST' && url.includes('/payments/9/refund'),
    ),
  ).toBe(true);
});
