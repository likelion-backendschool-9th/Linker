import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';

import { ApiError } from '@/lib/api/api-error';
import { apiFetch } from '@/lib/api/api-fetch';
import { useToastStore } from '@/stores/toast-store';
import { renderWithProviders } from '@/test/render-with-providers';

import { BoardView } from './board-view';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const fetchMock = vi.mocked(apiFetch);

const card = (id: number, title: string, status: string, extra: object = {}) => ({
  id,
  number: id % 1000,
  repoId: 11,
  repoName: 'linker-web',
  title,
  status,
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

function board(canWrite: boolean, withOther = false) {
  return {
    canWrite,
    columns: [
      { status: 'TODO', label: '작업 전', cards: [card(1018, '필터 시트 개선', 'TODO')] },
      { status: 'IN_PROGRESS', label: '작업 중', cards: [] },
      {
        status: 'BLOCKED',
        label: '작업 중단',
        cards: [card(1009, '웹훅 검증', 'BLOCKED', { dueDate: '2026-10-01', overdue: true })],
      },
      { status: 'DONE', label: '작업 완료', cards: [] },
      {
        status: 'OTHER',
        label: '기타',
        cards: withOther ? [card(1014, '배포 정리', 'OTHER')] : [],
      },
    ],
  };
}

/** A column by its exact name ("작업 중" vs "작업 중단"); `hidden` too, since an open sheet hides the board */
const column = (name: string) =>
  screen.getByRole('region', { name: new RegExp(`^${name}\\d`), hidden: true });

beforeEach(() => {
  fetchMock.mockReset();
  useToastStore.setState({ toasts: [] });
});

it('shows four columns (기타 only when it has cards) with the 중단 mark and overdue text, accessibly', async () => {
  fetchMock.mockResolvedValue(board(true));
  const { container } = renderWithProviders(<BoardView teamId="1" />, {
    viewer: { role: 'developer', login: 'me' },
  });
  expect(await screen.findAllByRole('heading', { level: 2 })).toHaveLength(4);
  const blocked = column('작업 중단');
  expect(within(blocked).getByText('중단')).toBeVisible();
  expect(within(blocked).getByText(/마감 지남/)).toBeVisible();
  expect(screen.getByRole('button', { name: '필터 시트 개선 옮기기' })).toBeVisible();
  expect(await axe(container)).toHaveNoViolations();
});

it('shows the 기타 column when unmapped cards exist', async () => {
  fetchMock.mockResolvedValue(board(true, true));
  renderWithProviders(<BoardView teamId="1" />, { viewer: { role: 'developer', login: 'me' } });
  expect(await screen.findByRole('region', { name: /^기타/ })).toBeVisible();
});

it('moves a card right away and back again when GitHub refuses (POL-I-4)', async () => {
  let release: (value: unknown) => void = () => undefined;
  fetchMock.mockImplementation(async (url, init) => {
    if (init?.method === 'PUT') {
      await new Promise((resolve) => {
        release = resolve;
      });
      throw new ApiError(502, { code: 'GITHUB_UNAVAILABLE', message: 'GitHub 오류' });
    }
    return board(true);
  });
  renderWithProviders(<BoardView teamId="1" />, {
    viewer: { role: 'developer', login: 'me' },
    searchParams: '?overlay=issue-status&oid=1018',
  });
  await userEvent.click(await screen.findByRole('radio', { name: /^작업 중\s*지금/ }));
  await userEvent.click(screen.getByRole('button', { name: '저장' }));
  // Shown in the new column before GitHub answers
  await waitFor(() => expect(within(column('작업 중')).getByText('필터 시트 개선')).toBeVisible());
  release(undefined);
  await waitFor(() => expect(within(column('작업 전')).getByText('필터 시트 개선')).toBeVisible());
  expect(useToastStore.getState().toasts.at(-1)?.message).toBe(
    'GitHub에 반영하지 못했어요. 카드를 원래 자리로 돌려놨어요.',
  );
});

it("saves a move through 12's status API", async () => {
  fetchMock.mockImplementation(async (url, init) =>
    init?.method === 'PUT' ? { status: 'DONE', state: 'CLOSED' } : board(true),
  );
  renderWithProviders(<BoardView teamId="1" />, {
    viewer: { role: 'developer', login: 'me' },
    searchParams: '?overlay=issue-status&oid=1018',
  });
  await userEvent.click(await screen.findByRole('radio', { name: /작업 완료/ }));
  await userEvent.click(screen.getByRole('button', { name: '저장' }));
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/user/teams/1/issues/1018/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'DONE' }),
    }),
  );
});

it('has no drag handles without write permission, and explains why', async () => {
  fetchMock.mockResolvedValue(board(false));
  renderWithProviders(<BoardView teamId="2" />, { viewer: { role: 'developer', login: 'me' } });
  await screen.findAllByRole('heading', { level: 2 });
  expect(screen.queryByRole('button', { name: /옮기기$/ })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /상태 바꾸기: 필터 시트 개선/ }));
  expect(useToastStore.getState().toasts.at(-1)?.message).toBe(
    '이 레포에 쓸 권한이 없어요. 레포 관리자에게 권한을 요청해 주세요.',
  );
});
