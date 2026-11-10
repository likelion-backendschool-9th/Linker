import { screen } from '@testing-library/react';
import { axe } from 'vitest-axe';

import { apiFetch } from '@/lib/api/api-fetch';
import { renderWithProviders } from '@/test/render-with-providers';

import { IssueProgress } from './IssueProgress';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const fetchMock = vi.mocked(apiFetch);

const TOTALS: Record<string, number> = { '': 12, DONE: 7, IN_PROGRESS: 3, BLOCKED: 1, TODO: 1 };
const day = (date: string, done: number | null) => ({
  date,
  todo: 1,
  inProgress: 3,
  blocked: 1,
  done,
});

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url) => {
    if (url.includes('/progress')) {
      return {
        completion: { done: 7, total: 12, rate: 58 },
        counts: { todo: 1, inProgress: 3, blocked: 1, done: 7 },
        history: [day('2026-11-06', null), day('2026-11-07', 6), day('2026-11-08', 7)],
        openByAssignee: [],
        overdueCount: 0,
        dueSoonCount: 0,
      };
    }
    const status = new URL(url, 'http://test').searchParams.get('status') ?? '';
    return { items: [], nextCursor: null, total: TOTALS[status], canWrite: true };
  });
});

it('shows the four Figma cards with the status word written out, from list totals', async () => {
  const { container } = renderWithProviders(<IssueProgress teamId="1" flex={false} />);
  expect(await screen.findByText('7개 작업 완료')).toBeVisible();
  expect(screen.getByRole('heading', { name: '전체 이슈 12개' })).toBeVisible();
  expect(screen.getByText('3개 작업 중')).toBeVisible();
  expect(screen.getByText('1개 작업 중단')).toBeVisible();
  expect(screen.getByText('1개 작업 전')).toBeVisible();
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/v1/user/teams/1/issues?status=DONE&size=1',
    expect.anything(),
  );
  // A Free team never asks for the Flex progress (no plan-limit sheet)
  expect(fetchMock.mock.calls.some(([url]) => url.includes('/progress'))).toBe(false);
  expect(screen.queryByRole('heading', { name: /최근 추이/ })).not.toBeInTheDocument();
  expect(await axe(container)).toHaveNoViolations();
});

it('draws the 14-day trend for a Flex team with a text summary and a table', async () => {
  const { container } = renderWithProviders(<IssueProgress teamId="1" flex />);
  expect(await screen.findByRole('heading', { name: '최근 추이 근 2주' })).toBeVisible();
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/v1/user/teams/1/progress?days=14',
    expect.anything(),
  );
  expect(await screen.findByRole('table', { name: '날짜별 이슈 수' })).toBeInTheDocument();
  // A day not collected yet reads as "기록 없음", never as 0
  expect(screen.getAllByText('기록 없음').length).toBeGreaterThan(0);
  expect(screen.getByText(/작업 완료 기록 없음에서 7/)).toBeInTheDocument();
  expect(await axe(container)).toHaveNoViolations();
});
