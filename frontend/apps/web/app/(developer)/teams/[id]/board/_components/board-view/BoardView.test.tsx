import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';

import { ApiError } from '@/lib/api/api-error';
import { apiFetch } from '@/lib/api/api-fetch';
import { useToastStore } from '@/stores/toast-store';
import { renderWithProviders } from '@/test/render-with-providers';

import { BoardView } from './BoardView';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const fetchMock = vi.mocked(apiFetch);

const COLORS = {
  TODO: 'GRAY',
  IN_PROGRESS: 'BLUE',
  BLOCKED: 'RED',
  DONE: 'GREEN',
  OTHER: 'GRAY',
  NONE: 'GRAY',
} as const;

const card = (id: number, title: string, status: keyof typeof COLORS, extra: object = {}) => ({
  id,
  number: id % 1000,
  repoId: 11,
  repoName: 'linker-web',
  title,
  status,
  statusColor: COLORS[status],
  state: status === 'DONE' ? 'CLOSED' : 'OPEN',
  assignees: [],
  labels: [],
  startDate: null,
  dueDate: null,
  overdue: false,
  inProject: true,
  scheduleSyncFailed: false,
  ...extra,
});

const jun = { id: 1, login: 'jun', name: '이준호', avatarUrl: '/a.png', inTeam: true };

function board(
  canWrite: boolean,
  other: ReturnType<typeof card>[] = [],
  writePermissionReason: string | null = canWrite ? null : 'NO_REPOSITORY_WRITE_PERMISSION',
) {
  return {
    canWrite,
    writePermissionReason,
    columns: [
      {
        status: 'TODO',
        statusColor: 'GRAY',
        label: '작업 전',
        cards: [
          card(1018, '필터 시트 개선', 'TODO', {
            assignees: [jun],
            dueDate: '2026-11-06',
            labels: [
              { name: 'frontend', color: '#0075ca' },
              { name: 'UI/UX', color: '#a2eeef' },
            ],
          }),
          card(1030, '보드 정렬', 'TODO'),
        ],
      },
      { status: 'IN_PROGRESS', statusColor: 'BLUE', label: '작업 중', cards: [] },
      {
        status: 'BLOCKED',
        statusColor: 'RED',
        label: '작업 중단',
        cards: [card(1009, '웹훅 검증', 'BLOCKED', { dueDate: '2026-10-01', overdue: true })],
      },
      { status: 'DONE', statusColor: 'GREEN', label: '작업 완료', cards: [] },
      { status: 'OTHER', statusColor: 'GRAY', label: '기타', cards: other },
    ],
  };
}

const developer = { viewer: { role: 'developer' as const, login: 'me' } };
/** A column by its exact name ("작업 중" vs "작업 중단") */
const column = (name: string) => screen.getByRole('region', { name: new RegExp(`^${name} \\d+개$`) });
const titles = (region: HTMLElement) =>
  within(region)
    .queryAllByRole('heading', { level: 3 })
    .map((heading) => heading.textContent);

beforeEach(() => {
  fetchMock.mockReset();
  useToastStore.setState({ toasts: [] });
});

afterEach(() => {
  vi.useRealTimers();
});

it('shows Figma 14: toolbar, status columns with counts, cards with assignee, date, repo, labels and status', async () => {
  fetchMock.mockResolvedValue(board(true));
  const { container } = renderWithProviders(<BoardView teamId="1" />, developer);
  expect(await screen.findAllByRole('heading', { level: 2 })).toHaveLength(4);
  expect(screen.getByRole('button', { name: '상태 필터' })).toHaveAttribute('aria-haspopup', 'menu');
  expect(screen.getByRole('button', { name: '정렬, 최신순' })).toBeVisible();

  const todo = column('작업 전');
  expect(within(todo).getByRole('heading', { level: 2 })).toHaveTextContent('작업 전 2개');
  // Newest first: 1030 above 1018
  const first = within(todo).getByRole('article', { name: '필터 시트 개선' });
  expect(within(first).getByText('이준호 담당')).toBeVisible();
  expect(within(first).getByText('11월 6일')).toHaveAttribute('dateTime', '2026-11-06');
  expect(within(first).getByText('linker-web')).toBeVisible();
  expect(within(first).getByText('#18')).toBeVisible();
  expect(within(first).getByRole('link', { name: '필터 시트 개선' })).toHaveAttribute(
    'href',
    '/teams/1/issues/1018',
  );
  expect(within(within(first).getByRole('list', { name: '라벨' })).getAllByRole('listitem')).toHaveLength(2);
  expect(within(first).getByRole('button', { name: '상태 작업 전, 필터 시트 개선' })).toBeVisible();
  // Overdue: date in red, read out as 마감 지남 (no visible text, 07 decision)
  expect(within(column('작업 중단')).getByText('마감 지남,', { exact: false })).toHaveClass('sr-only');
  // "+" per column → 13 (write permission only)
  expect(within(todo).getByRole('link', { name: '이슈 작성' })).toHaveAttribute(
    'href',
    '/teams/1/issues/new',
  );
  expect(screen.getAllByRole('link', { name: '이슈 작성' })).toHaveLength(4);
  // 기타 only with cards
  expect(screen.queryByRole('region', { name: /^기타/ })).not.toBeInTheDocument();
  expect(await axe(container)).toHaveNoViolations();
});

it('keeps NONE and unmapped cards in 기타, read as 기타', async () => {
  fetchMock.mockResolvedValue(board(true, [card(1014, '배포 정리', 'NONE')]));
  renderWithProviders(<BoardView teamId="1" />, developer);
  const other = await screen.findByRole('region', { name: /^기타 1개$/ });
  expect(within(other).getByRole('button', { name: '상태 기타, 배포 정리' })).toBeVisible();
});

it('sorts each column newest first, and oldest first from the 정렬 menu', async () => {
  const urls: string[] = [];
  fetchMock.mockResolvedValue(board(true));
  renderWithProviders(<BoardView teamId="1" />, {
    ...developer,
    onUrlUpdate: ({ queryString }) => urls.push(queryString),
  });
  await screen.findAllByRole('heading', { level: 2 });
  expect(titles(column('작업 전'))).toEqual(['보드 정렬', '필터 시트 개선']);

  await userEvent.click(screen.getByRole('button', { name: '정렬, 최신순' }));
  const menu = screen.getByRole('menu', { name: '정렬' });
  expect(within(menu).getByRole('menuitemradio', { name: '최신순' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  expect(within(menu).getByRole('menuitemradio', { name: '최신순' })).toHaveFocus();
  await userEvent.keyboard('{ArrowDown}{Enter}');
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '정렬, 오래 된 순' })).toHaveFocus();
  expect(titles(column('작업 전'))).toEqual(['필터 시트 개선', '보드 정렬']);
  expect(urls.at(-1)).toBe('?sort=oldest');
});

it('the 필터 menu keeps one status column; choosing it again shows all', async () => {
  fetchMock.mockResolvedValue(board(true));
  renderWithProviders(<BoardView teamId="1" />, developer);
  await screen.findAllByRole('heading', { level: 2 });

  await userEvent.click(screen.getByRole('button', { name: '상태 필터' }));
  expect(
    within(screen.getByRole('menu', { name: '상태 필터' }))
      .getAllByRole('menuitemradio')
      .map((item) => item.textContent),
  ).toEqual(['작업 중', '작업 전', '작업 완료', '작업 중단']);
  await userEvent.click(screen.getByRole('menuitemradio', { name: '작업 중단' }));
  expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
  expect(column('작업 중단')).toBeVisible();
  const trigger = screen.getByRole('button', { name: '상태 필터, 작업 중단 칸만 보는 중' });
  expect(trigger).toHaveAttribute('data-active', 'true');

  await userEvent.click(trigger);
  await userEvent.click(screen.getByRole('menuitemradio', { name: '작업 중단' }));
  expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(4);
});

it('Escape closes a menu and returns focus to its button', async () => {
  fetchMock.mockResolvedValue(board(true));
  renderWithProviders(<BoardView teamId="1" />, developer);
  const trigger = await screen.findByRole('button', { name: '상태 필터' });
  await userEvent.click(trigger);
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it("moves a card from its status menu through 12's status API and keeps it after refetch", async () => {
  let columns = board(true);
  fetchMock.mockImplementation(async (_url, init) => {
    if (init?.method === 'PUT') {
      columns = {
        ...columns,
        columns: columns.columns.map((column) => ({
          ...column,
          cards:
            column.status === 'DONE'
              ? [
                  ...column.cards.filter((item) => item.id !== 1018),
                  {
                    ...columns.columns
                      .flatMap((item) => item.cards)
                      .find((item) => item.id === 1018)!,
                    status: 'DONE',
                    statusColor: 'GREEN',
                    state: 'CLOSED',
                  },
                ]
              : column.cards.filter((item) => item.id !== 1018),
        })),
      };
      return { status: 'DONE', statusColor: 'GREEN', state: 'CLOSED' };
    }
    return columns;
  });
  renderWithProviders(<BoardView teamId="1" />, developer);
  await userEvent.click(
    await screen.findByRole('button', { name: '상태 작업 전, 필터 시트 개선' }),
  );
  await userEvent.click(screen.getByRole('menuitemradio', { name: '작업 완료' }));
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/user/teams/1/issues/1018/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'DONE' }),
    }),
  );
  await waitFor(() => expect(titles(column('작업 완료'))).toContain('필터 시트 개선'));
  expect(titles(column('작업 전'))).not.toContain('필터 시트 개선');
});

it('moves a card right away and back again when GitHub refuses (POL-I-4)', async () => {
  let release: (value: unknown) => void = () => undefined;
  fetchMock.mockImplementation(async (_url, init) => {
    if (init?.method === 'PUT') {
      await new Promise((resolve) => {
        release = resolve;
      });
      throw new ApiError(502, { code: 'GITHUB_UNAVAILABLE', message: 'GitHub 오류' });
    }
    return board(true);
  });
  renderWithProviders(<BoardView teamId="1" />, developer);
  await userEvent.click(
    await screen.findByRole('button', { name: '상태 작업 전, 필터 시트 개선' }),
  );
  await userEvent.click(screen.getByRole('menuitemradio', { name: '작업 중' }));
  // Shown in the new column before GitHub answers
  await waitFor(() => expect(titles(column('작업 중'))).toEqual(['필터 시트 개선']));
  release(undefined);
  await waitFor(() => expect(titles(column('작업 전'))).toContain('필터 시트 개선'));
  expect(useToastStore.getState().toasts.at(-1)?.message).toBe(
    'GitHub에 반영하지 못했어요. 카드를 원래 자리로 돌려놨어요.',
  );
});

it('without write permission the status menu does not open and explains why', async () => {
  fetchMock.mockResolvedValue(board(false));
  renderWithProviders(<BoardView teamId="2" />, developer);
  const trigger = await screen.findByRole('button', { name: '상태 작업 전, 필터 시트 개선' });
  expect(trigger).toHaveAttribute('aria-disabled', 'true');
  expect(screen.queryByRole('link', { name: '이슈 작성' })).not.toBeInTheDocument();
  await userEvent.click(trigger);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(useToastStore.getState().toasts.at(-1)?.message).toBe(
    '이 레포에 쓸 권한이 없어요. 레포 관리자에게 권한을 요청해 주세요.',
  );
});

it('still allows moves when GitHub permission lookup failed for the board', async () => {
  fetchMock.mockResolvedValue(board(false, [], 'GITHUB_PERMISSION_UNAVAILABLE'));
  renderWithProviders(<BoardView teamId="1" />, developer);
  const trigger = await screen.findByRole('button', { name: '상태 작업 전, 필터 시트 개선' });
  expect(trigger).not.toHaveAttribute('aria-disabled', 'true');
  await userEvent.click(trigger);
  expect(screen.getByRole('menu')).toBeVisible();
});

it('reverts the card and shows the repo permission copy on 403 FORBIDDEN', async () => {
  let release: (value: unknown) => void = () => undefined;
  fetchMock.mockImplementation(async (_url, init) => {
    if (init?.method === 'PUT') {
      await new Promise((resolve) => {
        release = resolve;
      });
      throw new ApiError(403, {
        code: 'FORBIDDEN',
        message: '이 레포에 쓸 권한이 없어요. 레포 관리자에게 권한을 요청해 주세요.',
      });
    }
    return board(true);
  });
  renderWithProviders(<BoardView teamId="1" />, developer);
  await userEvent.click(
    await screen.findByRole('button', { name: '상태 작업 전, 필터 시트 개선' }),
  );
  await userEvent.click(screen.getByRole('menuitemradio', { name: '작업 중' }));
  await waitFor(() => expect(titles(column('작업 중'))).toEqual(['필터 시트 개선']));
  release(undefined);
  await waitFor(() => expect(titles(column('작업 전'))).toContain('필터 시트 개선'));
  expect(useToastStore.getState().toasts.at(-1)?.message).toBe(
    '이 레포에 쓸 권한이 없어요. 레포 관리자에게 권한을 요청해 주세요. 카드를 원래 자리로 돌려놨어요.',
  );
});

it('keeps a retry-scheduled move until the board is refetched after the wait', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  let applied = false;
  fetchMock.mockImplementation(async (_url, init) => {
    if (init?.method === 'PUT') {
      throw new ApiError(502, {
        code: 'GITHUB_UNAVAILABLE',
        message: 'GitHub에 잠시 연결하지 못했어요',
        detail: { retryScheduled: true, retryAfterSeconds: 60 },
      });
    }
    if (!applied) return board(true);
    const data = board(true);
    return {
      ...data,
      columns: data.columns.map((column) => ({
        ...column,
        cards:
          column.status === 'IN_PROGRESS'
            ? [
                card(1018, '필터 시트 개선', 'IN_PROGRESS', {
                  assignees: [jun],
                  dueDate: '2026-11-06',
                  labels: [
                    { name: 'frontend', color: '#0075ca' },
                    { name: 'UI/UX', color: '#a2eeef' },
                  ],
                }),
              ]
            : column.cards.filter((item) => item.id !== 1018),
      })),
    };
  });
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  renderWithProviders(<BoardView teamId="1" />, developer);
  await user.click(await screen.findByRole('button', { name: '상태 작업 전, 필터 시트 개선' }));
  await user.click(screen.getByRole('menuitemradio', { name: '작업 중' }));
  await waitFor(() => expect(titles(column('작업 중'))).toEqual(['필터 시트 개선']));
  expect(useToastStore.getState().toasts.at(-1)?.message).toBe('GitHub에 잠시 연결하지 못했어요');
  expect(titles(column('작업 전'))).not.toContain('필터 시트 개선');

  applied = true;
  await vi.advanceTimersByTimeAsync(60_000);
  await waitFor(() => expect(titles(column('작업 중'))).toContain('필터 시트 개선'));
  expect(titles(column('작업 전'))).not.toContain('필터 시트 개선');
});

it('drops a retry-scheduled move onto the server column when refetch has not applied it', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  fetchMock.mockImplementation(async (_url, init) => {
    if (init?.method === 'PUT') {
      throw new ApiError(503, {
        code: 'GITHUB_UNAVAILABLE',
        message: '잠시 후 다시 시도해 주세요',
        detail: { retryScheduled: true, retryAfterSeconds: 30 },
      });
    }
    return board(true);
  });
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  renderWithProviders(<BoardView teamId="1" />, developer);
  await user.click(await screen.findByRole('button', { name: '상태 작업 전, 필터 시트 개선' }));
  await user.click(screen.getByRole('menuitemradio', { name: '작업 중' }));
  await waitFor(() => expect(titles(column('작업 중'))).toEqual(['필터 시트 개선']));
  expect(useToastStore.getState().toasts.at(-1)?.message).toBe('잠시 후 다시 시도해 주세요');

  await vi.advanceTimersByTimeAsync(30_000);
  await waitFor(() => expect(titles(column('작업 전'))).toContain('필터 시트 개선'));
  expect(titles(column('작업 중'))).not.toContain('필터 시트 개선');
});
