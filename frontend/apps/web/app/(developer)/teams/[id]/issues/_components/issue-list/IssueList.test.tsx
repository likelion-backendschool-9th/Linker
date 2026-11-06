import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';

import { ApiError } from '@/lib/api/api-error';
import { apiFetch } from '@/lib/api/api-fetch';
import { renderWithProviders } from '@/test/render-with-providers';

import { IssueList } from './IssueList';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const fetchMock = vi.mocked(apiFetch);

const row = {
  id: 1015,
  number: 15,
  repoId: 11,
  repoName: 'linker-web',
  title: '피드 카드 컴포넌트',
  status: 'IN_PROGRESS',
  state: 'OPEN',
  assignees: [
    {
      id: 1,
      login: 'me',
      name: '장준영',
      avatarUrl: 'https://avatars.githubusercontent.com/u/1',
      inTeam: true,
    },
    {
      id: 6,
      login: 'left',
      name: '강지우',
      avatarUrl: 'https://avatars.githubusercontent.com/u/6',
      inTeam: false,
    },
  ],
  labels: [{ name: 'feature', color: '0e8a16' }],
  startDate: '2026-10-28',
  dueDate: '2026-10-30',
  overdue: true,
  inProject: true,
  scheduleSyncFailed: false,
};
const unscheduled = { ...row, id: 1022, number: 22, title: 'README 영문 번역', inProject: false };

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url, init) => {
    if (url.includes('/issues/refresh')) return { refreshedAt: '2026-11-01T00:00:00Z' };
    if (url.includes('/project-item') && init?.method === 'POST') return undefined;
    if (url.includes('/issues/unscheduled'))
      return { items: [unscheduled], nextCursor: null, total: 1, canWrite: true };
    return { items: [row], nextCursor: null, total: 1, canWrite: true };
  });
});

it('shows issue rows with overdue text, status and assignees, accessibly', async () => {
  const { container } = renderWithProviders(<IssueList teamId="1" />, {
    viewer: { role: 'developer', login: 'me' },
  });
  const title = await screen.findByRole('link', { name: '피드 카드 컴포넌트' });
  expect(title).toHaveAttribute('href', '/teams/1/issues/1015');
  expect(screen.getByText(/마감 지남/)).toBeVisible();
  expect(screen.getByText('작업 중')).toBeVisible();
  expect(screen.getByText('담당자 장준영, 강지우(팀 밖 사용자)')).toBeInTheDocument();
  expect(screen.getByText('팀 밖 사용자')).toBeVisible();
  expect(screen.getByRole('link', { name: '이슈 작성' })).toHaveAttribute(
    'href',
    '/teams/1/issues/new',
  );
  expect(await axe(container)).toHaveNoViolations();
});

it('passes URL filters to the list API', async () => {
  renderWithProviders(<IssueList teamId="1" />, {
    viewer: { role: 'developer', login: 'me' },
    searchParams: '?status=TODO&open=true',
  });
  await screen.findByText('피드 카드 컴포넌트');
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/v1/user/teams/1/issues?status=TODO&open=true',
    expect.anything(),
  );
  expect(screen.getByRole('button', { name: /필터 2/ })).toBeVisible();
  await userEvent.setup().click(screen.getByRole('button', { name: '새로 고침' }));
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/v1/user/teams/1/issues/refresh?status=TODO&open=true&view=all',
    { method: 'POST' },
  );
});

it('switches to the 일정 없음 tab and adds an issue to the project', async () => {
  const user = userEvent.setup();
  renderWithProviders(<IssueList teamId="1" />, { viewer: { role: 'developer', login: 'me' } });
  await screen.findByText('피드 카드 컴포넌트');
  await user.click(screen.getByRole('button', { name: '일정 없음' }));
  await screen.findByText('README 영문 번역');
  await user.click(screen.getByRole('button', { name: '프로젝트에 추가: README 영문 번역' }));
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/user/teams/1/issues/1022/project-item', {
      method: 'POST',
    }),
  );
});

it('hides writing actions without repo write permission', async () => {
  fetchMock.mockImplementation(async () => ({
    items: [row],
    nextCursor: null,
    total: 1,
    canWrite: false,
  }));
  renderWithProviders(<IssueList teamId="2" />, { viewer: { role: 'developer', login: 'me' } });
  await screen.findByText('피드 카드 컴포넌트');
  expect(screen.queryByRole('link', { name: '이슈 작성' })).not.toBeInTheDocument();
});

it('waits a minute between refreshes, also after RATE_LIMITED', async () => {
  const user = userEvent.setup();
  renderWithProviders(<IssueList teamId="1" />, { viewer: { role: 'developer', login: 'me' } });
  await screen.findByText('피드 카드 컴포넌트');
  await user.click(screen.getByRole('button', { name: '새로 고침' }));
  // Only this screen's issues: the tab and filters go along (04 ch. 7 "Sync")
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/user/teams/1/issues/refresh?view=all', {
    method: 'POST',
  });
  const waiting = await screen.findByRole('button', { name: /60초 후 새로 고침/ });
  // aria-disabled keeps it focusable; tapping only says how long to wait
  expect(waiting).toHaveAttribute('aria-disabled', 'true');
  await user.click(waiting);
  expect(fetchMock.mock.calls.filter(([url]) => url.includes('/issues/refresh'))).toHaveLength(1);
});

it('keeps the button waiting for the server-given seconds when rate limited', async () => {
  const user = userEvent.setup();
  fetchMock.mockImplementation(async (url) => {
    if (url.includes('/issues/refresh'))
      throw new ApiError(429, {
        code: 'RATE_LIMITED',
        message: '잠시 후 다시 시도해 주세요',
        detail: { retryAfterSeconds: 30 },
      });
    return { items: [row], nextCursor: null, total: 1, canWrite: true };
  });
  renderWithProviders(<IssueList teamId="1" />, { viewer: { role: 'developer', login: 'me' } });
  await screen.findByText('피드 카드 컴포넌트');
  await user.click(screen.getByRole('button', { name: '새로 고침' }));
  expect(await screen.findByRole('button', { name: /30초 후 새로 고침/ })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
});
