import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';

import { subscriptionKeys } from '@/features/subscription/subscription-api';
import { apiFetch } from '@/lib/api/api-fetch';
import { ViewerProvider } from '@/lib/auth/viewer-context';
import { renderWithProviders } from '@/test/render-with-providers';

import { statsSummaryOptions } from '../_lib/stats-queries';
import { StatsView } from './stats-view';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const fetchMock = vi.mocked(apiFetch);
const post = {
  postId: 1,
  intro: '팀과 함께 만든 작업물',
  likeCount: 2,
  commentCount: 1,
  viewCount: 6,
};

beforeEach(() => {
  fetchMock.mockReset();
});

function renderCachedStats(client: QueryClient, login: string) {
  return render(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter>
        <ViewerProvider viewer={{ role: 'developer', login, status: null, suspendedUntil: null }}>
          <StatsView />
        </ViewerProvider>
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
}

it('Free shows an upgrade entry without requesting private Pro data', async () => {
  fetchMock.mockResolvedValue({ items: [post], isPro: false });
  renderWithProviders(<StatsView />, { viewer: { role: 'developer', login: 'free-user' } });

  expect(await screen.findByRole('link', { name: 'Pro로 보기' })).toHaveAttribute(
    'href',
    '/subscribe?reason=stats&returnTo=%2Fme%2Fstats',
  );
  expect(screen.queryByRole('heading', { name: '채용 담당자 조회' })).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/user/me/stats/summary', expect.anything());
});

it('Pro exposes the same numeric chart data as an accessible table without a write', async () => {
  fetchMock.mockImplementation(async (url) => {
    if (url.endsWith('/summary')) return { items: [post], isPro: true };
    if (url.includes('/recruiter-views'))
      return { thisWeek: 2, weeks: [{ weekStart: '2026-10-26', count: 2 }] };
    return {
      items: [
        {
          postId: 1,
          intro: post.intro,
          bySource: [
            { source: 'FEED', count: 4 },
            { source: 'EXTERNAL', count: 2 },
          ],
          readmeExpands: 1,
          trend: [
            { date: '2026-10-30', views: 3 },
            { date: '2026-10-31', views: 3 },
          ],
        },
      ],
    };
  });
  renderWithProviders(<StatsView />, { viewer: { role: 'developer', login: 'pro-user' } });

  expect(await screen.findByText('이번 주 채용 담당자 2명이 내 프로필을 봤어요.')).toBeVisible();
  expect(await screen.findByRole('img', { name: '피드 4회' })).toBeVisible();
  await userEvent.click(screen.getAllByText('표로 보기', { exact: true })[1]!);
  expect(screen.getByRole('table', { name: '유입 경로 상세 수치' })).toBeVisible();
  expect(screen.getByRole('row', { name: '외부 링크 2회' })).toBeVisible();
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  expect(fetchMock.mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(
    true,
  );
});

it('rechecks cached or server-prefetched Pro access before requesting paid data on entry', async () => {
  const login = 'refunded-user';
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(statsSummaryOptions(login).queryKey, { items: [post], isPro: true });
  fetchMock.mockResolvedValue({ items: [post], isPro: false });

  const view = renderCachedStats(client, login);
  expect(await screen.findByRole('link', { name: 'Pro로 보기' })).toBeVisible();
  expect(screen.queryByRole('heading', { name: '채용 담당자 조회' })).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/user/me/stats/summary', expect.anything());
  view.unmount();
  client.clear();
});

it('refreshes stats access when the existing payment flow invalidates the subscription account', async () => {
  const login = 'subscription-user';
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let isPro = false;
  fetchMock.mockImplementation(async (url) => {
    if (url.endsWith('/summary')) return { items: [post], isPro };
    if (url.includes('/recruiter-views')) return { thisWeek: 2, weeks: [] };
    return { items: [] };
  });
  const view = renderCachedStats(client, login);
  expect(await screen.findByRole('link', { name: 'Pro로 보기' })).toBeVisible();

  isPro = true;
  await act(async () => {
    await client.invalidateQueries({ queryKey: subscriptionKeys.account(login) });
  });
  expect(await screen.findByText('이번 주 채용 담당자 2명이 내 프로필을 봤어요.')).toBeVisible();
  expect(screen.queryByRole('link', { name: 'Pro로 보기' })).not.toBeInTheDocument();

  isPro = false;
  await act(async () => {
    await client.invalidateQueries({ queryKey: subscriptionKeys.account(login) });
  });
  expect(await screen.findByRole('link', { name: 'Pro로 보기' })).toBeVisible();
  expect(screen.queryByRole('heading', { name: '채용 담당자 조회' })).not.toBeInTheDocument();
  view.unmount();
  client.clear();
});
