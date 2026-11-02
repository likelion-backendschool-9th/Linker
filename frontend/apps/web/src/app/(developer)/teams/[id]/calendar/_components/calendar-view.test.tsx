import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UrlUpdateEvent } from 'nuqs/adapters/testing';
import { axe } from 'vitest-axe';

import { apiFetch } from '@/lib/api/api-fetch';
import { renderWithProviders } from '@/test/render-with-providers';

import { CalendarView } from './calendar-view';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const fetchMock = vi.mocked(apiFetch);

const row = (id: number, title: string, startDate: string | null, dueDate: string, extra = {}) => ({
  id,
  number: id % 1000,
  repoId: 11,
  repoName: 'linker-web',
  title,
  status: 'IN_PROGRESS',
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
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url) => {
    if (url.includes('/issue-filters')) {
      return {
        repos: [],
        labels: [],
        statuses: [],
        members: [{ id: 2, login: 'doyun', name: '이도윤', avatarUrl: '' }],
      };
    }
    return {
      from: '2026-11-01',
      to: '2026-12-05',
      items: [
        row(1015, '피드 카드', '2026-11-02', '2026-11-04'),
        row(1021, '아이콘 교체', null, '2026-11-04'),
        row(1007, 'JWT 쿠키', '2026-10-28', '2026-11-02', { overdue: true }),
      ],
    };
  });
});

const dayButton = (name: RegExp) => screen.getByRole('button', { name });

// The name comes from the button's content around the visible day number (WCAG 2.5.3), so browsers
// may put a space before "일"; Korean speech reads both the same
it('is a table of date buttons named "11월 4일 수요일, 이슈 2개", accessibly', async () => {
  const { container } = renderWithProviders(<CalendarView teamId="1" />, {
    viewer: { role: 'developer', login: 'me' },
    searchParams: '?date=2026-11-15',
  });
  expect(await screen.findByRole('heading', { name: '2026년 11월' })).toBeVisible();
  expect(screen.getAllByRole('columnheader')).toHaveLength(7);
  await waitFor(() => expect(dayButton(/^11월 ?4 ?일 수요일, 이슈 2개$/)).toBeVisible());
  expect(dayButton(/^11월 ?10 ?일 화요일, 이슈 없음$/)).toBeVisible();
  // Overdue bars are marked (red), and "마감 지남" shows in the day sheet
  expect(container.querySelector('[data-overdue="true"]')).not.toBeNull();
  expect(await axe(container)).toHaveNoViolations();
  // axe over a whole month of date buttons: fine alone, over 5s on a busy CI runner
}, 15_000);

it("opens the day sheet with that day's issues, each linking to 12", async () => {
  const updates: UrlUpdateEvent[] = [];
  renderWithProviders(<CalendarView teamId="1" />, {
    viewer: { role: 'developer', login: 'me' },
    searchParams: '?date=2026-11-15&overlay=calendar-day&oid=2026-11-02',
    onUrlUpdate: (event) => updates.push(event),
  });
  const sheet = await screen.findByRole('dialog', { name: '11월 2일 월요일 이슈' });
  await waitFor(() => expect(within(sheet).getAllByRole('article')).toHaveLength(2));
  expect(within(sheet).getByRole('link', { name: 'JWT 쿠키' })).toHaveAttribute(
    'href',
    '/teams/1/issues/1007',
  );
  expect(within(sheet).getByText(/마감 지남/)).toBeVisible();
});

it('keeps view, month and assignee in the URL and asks the API for that range', async () => {
  const updates: UrlUpdateEvent[] = [];
  renderWithProviders(<CalendarView teamId="1" />, {
    viewer: { role: 'developer', login: 'me' },
    searchParams: '?date=2026-11-15',
    onUrlUpdate: (event) => updates.push(event),
  });
  await screen.findByRole('heading', { name: '2026년 11월' });
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/v1/user/teams/1/calendar?from=2026-11-01&to=2026-12-05',
    expect.anything(),
  );
  await userEvent.click(screen.getByRole('button', { name: '다음 달' }));
  expect(updates.at(-1)?.searchParams.get('date')).toBe('2026-12-15');
  await userEvent.click(screen.getByRole('button', { name: '주' }));
  expect(updates.at(-1)?.searchParams.get('view')).toBe('week');
  await userEvent.selectOptions(await screen.findByLabelText('담당자'), 'doyun');
  expect(updates.at(-1)?.searchParams.get('assignee')).toBe('doyun');
});

it('points to the "일정 없음" tab for issues without a due date', async () => {
  renderWithProviders(<CalendarView teamId="1" />, { viewer: { role: 'developer', login: 'me' } });
  expect(await screen.findByRole('link', { name: /일정 없음/ })).toHaveAttribute(
    'href',
    '/teams/1/issues?view=unscheduled',
  );
});
