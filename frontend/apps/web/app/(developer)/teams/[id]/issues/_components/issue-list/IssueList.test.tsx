import { screen, waitFor, within } from '@testing-library/react';
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
  statusColor: 'BLUE',
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

it('shows Figma rows (title + status dot, #number · repo · assignees, date), accessibly', async () => {
  const { container } = renderWithProviders(<IssueList teamId="1" />, {
    viewer: { role: 'developer', login: 'me' },
  });
  const title = await screen.findByRole('link', { name: '피드 카드 컴포넌트' });
  expect(title).toHaveAttribute('href', '/teams/1/issues/1015');
  const row = screen.getByRole('article', { name: '피드 카드 컴포넌트' });
  // Status is a dot; its name is for screen readers only
  expect(within(row).getByText('작업 중')).toHaveClass('sr-only');
  expect(within(row).getByText('#15')).toBeVisible();
  expect(within(row).getByText('linker-web')).toBeVisible();
  expect(within(row).getByText('장준영, 강지우')).toBeVisible();
  expect(within(row).getByText('10월 30일').closest('time')).toHaveAttribute(
    'dateTime',
    '2026-10-30',
  );
  expect(screen.getByRole('heading', { name: '이슈 목록 1개' })).toBeVisible();
  expect(await screen.findByRole('button', { name: '전체 1', pressed: true })).toBeVisible();
  // No "일정 없음" chip (Figma 11); that list is reached only from 15's calendar link
  expect(screen.queryByRole('button', { name: /일정 없음/ })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: '이슈 작성' })).toHaveAttribute(
    'href',
    '/teams/1/issues/new',
  );
  expect(screen.getByRole('searchbox', { name: '이슈 제목 검색' })).toHaveAttribute(
    'placeholder',
    '검색어를 입력해 주세요',
  );
  expect(await axe(container)).toHaveNoViolations();
});

it('passes URL filters to the list, counts chips without their own status, and refreshes', async () => {
  renderWithProviders(<IssueList teamId="1" />, {
    viewer: { role: 'developer', login: 'me' },
    searchParams: '?status=TODO&open=true',
  });
  await screen.findByText('피드 카드 컴포넌트');
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/v1/user/teams/1/issues?status=TODO&open=true',
    expect.objectContaining({ method: 'GET' }),
  );
  // "전체" keeps the other filters but drops the status
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/v1/user/teams/1/issues?open=true&size=1',
    expect.anything(),
  );
  expect(await screen.findByRole('button', { name: /작업 전/, pressed: true })).toBeVisible();
  await userEvent.setup().click(screen.getByRole('button', { name: '새로 고침' }));
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/v1/user/teams/1/issues/refresh?status=TODO&open=true&view=all',
    expect.objectContaining({ method: 'POST' }),
  );
});

it('searches titles through ?q= and a status chip sets ?status=', async () => {
  const user = userEvent.setup();
  const onUrlUpdate = vi.fn();
  renderWithProviders(<IssueList teamId="1" />, {
    viewer: { role: 'developer', login: 'me' },
    onUrlUpdate,
  });
  await screen.findByText('피드 카드 컴포넌트');
  await user.type(screen.getByRole('searchbox', { name: '이슈 제목 검색' }), ' 피드 {Enter}');
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/user/teams/1/issues?q=%ED%94%BC%EB%93%9C',
      expect.anything(),
    ),
  );
  await user.click(await screen.findByRole('button', { name: /^정지/ }));
  await waitFor(() =>
    expect(onUrlUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ queryString: expect.stringContaining('status=BLOCKED') }),
    ),
  );
  expect(screen.getByRole('button', { name: /^정지/, pressed: true })).toBeVisible();
});

it('lists 일정 없음 issues from the 15 calendar link (?view=unscheduled) and adds one to the project', async () => {
  const user = userEvent.setup();
  renderWithProviders(<IssueList teamId="1" />, {
    viewer: { role: 'developer', login: 'me' },
    searchParams: '?view=unscheduled',
  });
  await screen.findByText('README 영문 번역');
  expect(screen.queryByText('피드 카드 컴포넌트')).not.toBeInTheDocument();
  // Same status chips; none is pressed in this list
  expect(screen.queryByRole('button', { pressed: true })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '프로젝트에 추가: README 영문 번역' }));
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/user/teams/1/issues/1022/project-item',
      expect.objectContaining({ method: 'POST' }),
    ),
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
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/v1/user/teams/1/issues/refresh?view=all',
    expect.objectContaining({ method: 'POST' }),
  );
  const waiting = await screen.findByRole('button', { name: /\d+초 후 새로 고침/ });
  // The label counts down in real time, so CI may already show 59.
  const seconds = Number(waiting.textContent?.match(/(\d+)초/)?.[1]);
  expect(seconds).toBeLessThanOrEqual(60);
  expect(seconds).toBeGreaterThan(50);
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
  const waiting = await screen.findByRole('button', { name: /\d+초 후 새로 고침/ });
  const seconds = Number(waiting.textContent?.match(/(\d+)초/)?.[1]);
  expect(seconds).toBeLessThanOrEqual(30);
  expect(seconds).toBeGreaterThan(20);
  expect(waiting).toHaveAttribute('aria-disabled', 'true');
});
