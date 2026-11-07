import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { apiFetch } from '@/lib/api/api-fetch';
import { renderWithProviders } from '@/test/render-with-providers';

import { PlanSelector } from './PlanSelector';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
vi.mock('../payment-panel', () => ({ PaymentPanel: () => <p>주문 준비됨</p> }));
const fetchMock = vi.mocked(apiFetch);
const plans = [
  {
    key: 'PRO',
    name: 'Pro',
    monthly: 2900,
    yearly: 29000,
    benefits: ['사진 10장'],
    trialAvailable: true,
  },
  {
    key: 'FLEX',
    name: 'Flex',
    monthly: 7900,
    yearly: null,
    benefits: ['팀 혜택'],
    trialAvailable: true,
    perExtraMember: 1900,
  },
  {
    key: 'SCOUT',
    name: 'Scout',
    monthly: 14900,
    yearly: null,
    benefits: ['채용 혜택'],
    trialAvailable: false,
  },
];
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url) =>
    url.includes('team-candidates')
      ? { items: [{ teamId: 1, name: '내 팀', memberCount: 7, amount: 9800, currentPlan: 'FREE' }] }
      : { plans, currentPlan: 'FREE', reason: null },
  );
});
it('uses annual pricing only for Pro and requires a team for Flex checkout', async () => {
  renderWithProviders(<PlanSelector reason="" />, {
    viewer: { role: 'developer', login: 'developer' },
  });
  await screen.findByRole('heading', { name: 'Pro' });
  await userEvent.click(screen.getByRole('button', { name: '연간' }));
  expect(screen.getByText('₩29,000')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Flex 결제 준비' })).toBeDisabled();
  await userEvent.selectOptions(screen.getByRole('combobox', { name: '결제할 팀' }), '1');
  fetchMock.mockResolvedValue({
    orderId: 'order-1',
    amount: 9800,
    orderName: 'Flex',
    customerKey: 'c-1',
    planKey: 'FLEX',
    billing: 'MONTHLY',
    teamId: 1,
  });
  await userEvent.click(screen.getByRole('button', { name: 'Flex 결제 준비' }));
  await screen.findByText('주문 준비됨');
  const call = fetchMock.mock.calls.find(([url]) => url.endsWith('/checkout'))!;
  expect(JSON.parse(String(call[1]?.body))).toEqual({
    planKey: 'FLEX',
    billing: 'MONTHLY',
    teamId: 1,
  });
});
it('shows recruiters an empty plan list until Scout opens, without querying team candidates', async () => {
  fetchMock.mockImplementation(async () => ({ plans: [], currentPlan: 'FREE', reason: null }));
  renderWithProviders(<PlanSelector reason="" />, {
    viewer: { role: 'recruiter', login: 'recruiter' },
  });
  expect(await screen.findByText('지금 결제할 수 있는 요금제가 없어요.')).toBeVisible();
  expect(screen.queryByRole('heading', { name: 'Pro' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '연간' })).not.toBeInTheDocument();
  expect(fetchMock.mock.calls.some(([url]) => url.includes('team-candidates'))).toBe(false);
});

it('selects a team handed off by settings only from the permitted candidates, without creating an order', async () => {
  renderWithProviders(<PlanSelector reason="team-members" />, {
    viewer: { role: 'developer', login: 'developer' },
    searchParams: '?teamId=1',
  });
  expect(await screen.findByRole('combobox', { name: '결제할 팀' })).toHaveValue('1');
  expect(screen.getByRole('button', { name: 'Flex 결제 준비' })).toBeEnabled();
  expect(fetchMock.mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(
    true,
  );
});

it('a forged team id does not bypass the permitted candidate list', async () => {
  renderWithProviders(<PlanSelector reason="team-members" />, {
    viewer: { role: 'developer', login: 'developer' },
    searchParams: '?teamId=999',
  });
  expect(
    await screen.findByText(
      '이 팀을 선택할 수 없어요. 결제할 수 있는 팀 목록에서 다시 선택해 주세요.',
    ),
  ).toBeVisible();
  expect(screen.getByRole('button', { name: 'Flex 결제 준비' })).toBeDisabled();
  expect(fetchMock.mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(
    true,
  );
});
