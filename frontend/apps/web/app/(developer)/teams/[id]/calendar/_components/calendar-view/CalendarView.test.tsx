import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UrlUpdateEvent } from 'nuqs/adapters/testing';
import { axe } from 'vitest-axe';

import { apiFetch } from '@/lib/api/api-fetch';
import { todayKst } from '@/lib/format/time';
import { renderWithProviders } from '@/test/render-with-providers';

import { CalendarView } from './CalendarView';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
vi.mock('@/lib/format/time', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/format/time')>()),
  todayKst: vi.fn(),
}));
const fetchMock = vi.mocked(apiFetch);

const row = (id: number, title: string, startDate: string | null, dueDate: string, extra = {}) => ({
  id,
  number: id % 1000,
  repoId: 11,
  repoName: 'linker-web',
  title,
  status: 'IN_PROGRESS',
  statusColor: 'BLUE',
  state: 'OPEN',
  assignees: [{ id: 2, login: 'doyun', name: '이도윤', avatarUrl: '', inTeam: true }],
  labels: [],
  startDate,
  dueDate,
  overdue: false,
  inProject: true,
  scheduleSyncFailed: false,
  ...extra,
});

beforeEach(() => {
  vi.mocked(todayKst).mockReturnValue('2026-11-15');
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url) => {
    if (url.includes('/issue-filters')) {
      return { repos: [], labels: [], statuses: [], members: [] };
    }
    return {
      from: '2026-10-26',
      to: '2026-12-06',
      items: [
        row(1015, '피드 카드', '2026-11-02', '2026-11-04'),
        row(1021, '아이콘 교체', null, '2026-11-04', { status: 'DONE', statusColor: 'GREEN' }),
      ],
    };
  });
});

const render = (searchParams = '?date=2026-11-15', onUrlUpdate?: (e: UrlUpdateEvent) => void) =>
  renderWithProviders(<CalendarView teamId="1" />, {
    viewer: { role: 'developer', login: 'me' },
    searchParams,
    onUrlUpdate,
  });

it('shows the month, four status chips, Monday-first weekdays and dates with issues as buttons', async () => {
  const { container } = render();
  expect(await screen.findByRole('button', { name: /^2026년 11월/ })).toBeVisible();
  for (const name of ['작업 전', '진행', '완료', '정지']) {
    expect(screen.getByText(name)).toBeVisible();
  }
  expect(container.querySelector('ol[aria-hidden]')?.textContent).toBe('월화수목금토일');
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /^11월 ?4 ?일 수요일, 이슈 2개$/ })).toBeVisible(),
  );
  // A date without issues is not a button
  expect(screen.queryByRole('button', { name: /^11월 ?10 ?일/ })).toBeNull();
  expect(await axe(container)).toHaveNoViolations();
}, 15_000);

it('opens the "?" note with the unscheduled link and closes it with Esc', async () => {
  const user = userEvent.setup();
  render();
  await user.click(await screen.findByRole('button', { name: '캘린더 안내' }));
  expect(screen.getByText('마감일이 없는 이슈는 캘린더에 보이지 않아요.')).toBeVisible();
  expect(screen.getByRole('link', { name: /일정 없음/ })).toHaveAttribute(
    'href',
    '/teams/1/issues?view=unscheduled',
  );
  await user.keyboard('{Escape}');
  expect(screen.queryByText('마감일이 없는 이슈는 캘린더에 보이지 않아요.')).toBeNull();
});

it("opens the day sheet with that date's issues", async () => {
  const user = userEvent.setup();
  render();
  await user.click(await screen.findByRole('button', { name: /^11월 ?4 ?일 수요일/ }));
  const sheet = await screen.findByRole('dialog', { name: '11월 4일 이슈' });
  expect(within(sheet).getByRole('link', { name: '피드 카드' })).toBeVisible();
  expect(within(sheet).getByRole('link', { name: '아이콘 교체' })).toBeVisible();
});

it('moves to the picked month with the date sheet', async () => {
  const user = userEvent.setup();
  const updates: UrlUpdateEvent[] = [];
  // jsdom has no real history to go back in: pop right away, as the browser does
  vi.spyOn(window.history, 'back').mockImplementation(() => {
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  render('?date=2026-11-15', (event) => updates.push(event));
  await user.click(await screen.findByRole('button', { name: /^2026년 11월/ }));
  const sheet = await screen.findByRole('dialog', { name: '날짜 선택' });
  const month = within(sheet).getByRole('listbox', { name: '월' });
  month.focus();
  await user.keyboard('{ArrowUp}{ArrowUp}');
  await user.click(within(sheet).getByRole('button', { name: '저장' }));
  await waitFor(() => expect(updates.at(-1)?.queryString).toContain('date=2026-09-01'));
});
