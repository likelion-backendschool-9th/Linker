import { screen, within } from '@testing-library/react';
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
    benefits: ['피드 저장소 사진 10장으로 확장'],
    trialAvailable: true,
  },
  {
    key: 'FLEX',
    name: 'Flex',
    monthly: 7900,
    yearly: 79000,
    benefits: ['팀 혜택'],
    trialAvailable: true,
    perExtraMember: 1900,
    perExtraMemberYearly: 19000,
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
      ? {
          items: [
            {
              teamId: 1,
              name: '내 팀',
              memberCount: 7,
              amount: 9800,
              yearlyAmount: 98000,
              currentPlan: 'FREE',
            },
          ],
        }
      : { plans, currentPlan: 'FREE', reason: null },
  );
});
it('shows yearly prices and the saving for Pro and Flex, and checks out the Flex team yearly', async () => {
  renderWithProviders(<PlanSelector reason="" />, {
    viewer: { role: 'developer', login: 'developer' },
  });
  await screen.findByRole('heading', { name: 'Pro' });
  expect(screen.getByText('월간 청구, 7명 이상 인당 + ₩1,900')).toBeVisible();
  expect(screen.queryByText(/절약/)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '연간 결제 2개월 무료' }));
  expect(screen.getByText('₩29,000')).toBeVisible();
  expect(screen.getByText('연간 청구')).toBeVisible();
  expect(screen.getByText('월간 결제보다 ₩5,800 절약 (2개월 무료)')).toBeVisible();
  expect(screen.getByText('₩79,000')).toBeVisible();
  expect(screen.getByText('연간 청구, 7명 이상 인당 + ₩19,000')).toBeVisible();
  expect(screen.getByText('월간 결제보다 ₩15,800 절약 (2개월 무료)')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Flex 플랜 구독하기' }));
  const sheet = await screen.findByRole('dialog', { name: '결제할 팀 선택' });
  expect(within(sheet).getByRole('button', { name: 'Flex 결제 준비' })).toBeDisabled();
  await userEvent.click(within(sheet).getByRole('radio', { name: /내 팀.*₩98,000 \/ 년/ }));
  fetchMock.mockResolvedValue({
    orderId: 'order-1',
    amount: 9800,
    orderName: 'Flex',
    customerKey: 'c-1',
    planKey: 'FLEX',
    billing: 'MONTHLY',
    teamId: 1,
  });
  await userEvent.click(within(sheet).getByRole('button', { name: 'Flex 결제 준비' }));
  await screen.findByText('주문 준비됨');
  const call = fetchMock.mock.calls.find(([url]) => url.endsWith('/checkout'))!;
  expect(JSON.parse(String(call[1]?.body))).toEqual({
    planKey: 'FLEX',
    billing: 'YEARLY',
    teamId: 1,
  });
});

it('shows the Figma title, emphasised benefits, terms links and the trial note', async () => {
  renderWithProviders(<PlanSelector reason="" />, {
    viewer: { role: 'developer', login: 'developer' },
  });
  expect(
    await screen.findByText('개발자와 팀을 위한 요금제를 선택해 더욱 편하게 개발하세요'),
  ).toBeVisible();
  expect(screen.getByText('10장으로 확장').tagName).toBe('STRONG');
  expect(screen.getByRole('link', { name: '이용 약관' })).toHaveAttribute('href', '/legal/terms');
  expect(screen.getByRole('link', { name: '개인정보처리방침' })).toHaveAttribute(
    'href',
    '/legal/privacy',
  );
  expect(screen.getByText('계정 당 Pro, Flex의 무료 체험은 1회만 제공 됩니다')).toBeVisible();
});

it('shows recruiters a display-only Scout card, without querying team candidates', async () => {
  fetchMock.mockImplementation(async () => ({
    plans: plans.filter((plan) => plan.key === 'SCOUT'),
    currentPlan: 'FREE',
    reason: null,
  }));
  renderWithProviders(<PlanSelector reason="" />, {
    viewer: { role: 'recruiter', login: 'recruiter' },
  });
  expect(await screen.findByRole('heading', { name: 'Scout' })).toBeVisible();
  expect(screen.getByText('₩14,900')).toBeVisible();
  expect(screen.getByText('월간 청구')).toBeVisible();
  // Scout checkout is [Included]: the server refuses it, so the button stays off.
  expect(screen.getByRole('button', { name: 'Scout 플랜 준비 중' })).toBeDisabled();
  expect(screen.getByText('결제는 곧 열릴 예정이에요.')).toBeVisible();
  expect(screen.getByText('원하시는 인재를 더 빠르게 채용해 보세요')).toBeVisible();
  expect(screen.queryByRole('heading', { name: 'Pro' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /연간 결제/ })).not.toBeInTheDocument();
  expect(screen.queryByText(/무료 체험은 1회만/)).not.toBeInTheDocument();
  expect(fetchMock.mock.calls.some(([url]) => url.includes('team-candidates'))).toBe(false);
});

it('preselects a team handed off by settings only from the permitted candidates, without creating an order', async () => {
  renderWithProviders(<PlanSelector reason="team-members" />, {
    viewer: { role: 'developer', login: 'developer' },
    searchParams: '?teamId=1',
  });
  await userEvent.click(await screen.findByRole('button', { name: 'Flex 플랜 구독하기' }));
  const sheet = await screen.findByRole('dialog', { name: '결제할 팀 선택' });
  expect(within(sheet).getByRole('radio', { name: /내 팀/ })).toBeChecked();
  expect(within(sheet).getByRole('button', { name: 'Flex 결제 준비' })).toBeEnabled();
  expect(fetchMock.mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(
    true,
  );
});

it('a forged team id does not bypass the permitted candidate list', async () => {
  renderWithProviders(<PlanSelector reason="team-members" />, {
    viewer: { role: 'developer', login: 'developer' },
    searchParams: '?teamId=999',
  });
  await userEvent.click(await screen.findByRole('button', { name: 'Flex 플랜 구독하기' }));
  const sheet = await screen.findByRole('dialog', { name: '결제할 팀 선택' });
  expect(
    within(sheet).getByText(
      '이 팀을 선택할 수 없어요. 결제할 수 있는 팀 목록에서 다시 선택해 주세요.',
    ),
  ).toBeVisible();
  expect(within(sheet).getByRole('button', { name: 'Flex 결제 준비' })).toBeDisabled();
  expect(fetchMock.mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(
    true,
  );
});

it('shows the server limit reason and leaves the free plan out, as in Figma', async () => {
  fetchMock.mockImplementation(async (url) =>
    url.includes('team-candidates')
      ? { items: [] }
      : {
          plans: [
            {
              key: 'FREE',
              name: '무료',
              monthly: 0,
              yearly: null,
              benefits: [],
              trialAvailable: false,
            },
            ...plans,
          ],
          currentPlan: 'FREE',
          reason: null,
        },
  );
  renderWithProviders(<PlanSelector reason="RECRUIT_POSTS" returnTo="/recruits/new" />, {
    viewer: { role: 'developer', login: 'developer' },
  });
  expect(await screen.findByText('모집 글을 더 많이 열어 두고 싶으신가요?')).toBeVisible();
  expect(screen.queryByRole('heading', { name: '무료' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: '무료로 이용하기' })).not.toBeInTheDocument();
  expect(screen.getAllByRole('heading', { level: 2 }).map((node) => node.textContent)).toEqual([
    'Pro',
    'Flex',
  ]);
});
