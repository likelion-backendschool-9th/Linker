import { fireEvent, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { apiFetch } from '@/lib/api/api-fetch';
import { ApiError } from '@/lib/api/api-error';
import { renderWithProviders } from '@/test/render-with-providers';
import type { BoardSelection } from '../../../_components/team-board-selection';
import { TeamSetupBoards } from './TeamSetupBoards';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const options = [
  { id: 'opt-1', name: '대기', color: 'GRAY' },
  { id: 'opt-2', name: '개발', color: 'BLUE' },
  { id: 'opt-3', name: '중단', color: 'RED' },
  { id: 'opt-4', name: '종료', color: 'GREEN' },
];
const board = {
  id: 'PVT_1',
  name: 'ShowMoa',
  cardCount: 18,
  statusColumns: options.map((o) => o.name),
  statusOptions: options,
};
const data = { items: [board, { ...board, id: 'PVT_2', name: 'Linker' }] };
const saved = vi.fn();
const empty: BoardSelection = { mode: 'existing', boardId: '', statusMapping: {} };
function Boards({
  teamId = 77,
  initial = empty,
}: {
  teamId?: number | null;
  initial?: BoardSelection;
}) {
  const [value, setValue] = useState(initial);
  return <TeamSetupBoards teamId={teamId} value={value} onChange={setValue} onSaved={saved} />;
}
function respond() {
  vi.mocked(apiFetch).mockImplementation(async (_url, init) =>
    init?.method === 'POST' ? { boardId: 'PVT_1', name: 'ShowMoa' } : data,
  );
}
function mapAll() {
  ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'].forEach((status, index) => {
    fireEvent.change(screen.getByRole('combobox', { name: options[index]!.name }), {
      target: { value: status },
    });
  });
}
beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  saved.mockReset();
});

it('requires an explicit board choice and all four states, sends option IDs, and advances only after save', async () => {
  respond();
  renderWithProviders(<Boards />);
  expect(await screen.findByRole('radio', { name: 'ShowMoa' })).not.toBeChecked();
  expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
  fireEvent.click(screen.getByRole('radio', { name: 'ShowMoa' }));
  expect(screen.getByText('ShowMoa · 카드 18개')).toBeVisible();
  expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
  mapAll();
  expect(screen.getByRole('button', { name: '다음' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: '다음' }));
  await waitFor(() => expect(saved).toHaveBeenCalledWith({ boardId: 'PVT_1', name: 'ShowMoa' }));
  expect(apiFetch).toHaveBeenCalledWith(
    '/api/v1/user/teams/77/setup/board',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        mode: 'EXISTING',
        boardId: 'PVT_1',
        statusMapping: {
          'opt-1': 'TODO',
          'opt-2': 'IN_PROGRESS',
          'opt-3': 'BLOCKED',
          'opt-4': 'DONE',
        },
      }),
    }),
  );
});

it('clears mapping on board changes and never infers states from column names', async () => {
  respond();
  renderWithProviders(<Boards />);
  fireEvent.click(await screen.findByRole('radio', { name: 'ShowMoa' }));
  mapAll();
  fireEvent.click(screen.getByRole('radio', { name: 'Linker' }));
  expect(screen.getByRole('combobox', { name: '대기' })).toHaveValue('');
  expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
  expect(apiFetch).not.toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ method: 'POST' }),
  );
});

it('ignores stale option IDs rather than treating them as a complete mapping', async () => {
  respond();
  renderWithProviders(
    <Boards
      initial={{
        mode: 'existing',
        boardId: 'PVT_1',
        statusMapping: { old1: 'TODO', old2: 'IN_PROGRESS', old3: 'BLOCKED', old4: 'DONE' },
      }}
    />,
  );
  await screen.findByRole('radio', { name: 'ShowMoa' });
  expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
});

it('preserves drafts on failure and never automatically retries creation', async () => {
  vi.mocked(apiFetch).mockImplementation(async (_url, init) => {
    if (init?.method === 'POST')
      throw new ApiError(409, {
        code: 'STATE_CONFLICT',
        message: '보드 생성 결과를 확인하고 기존 보드를 선택해 주세요',
      });
    return data;
  });
  renderWithProviders(<Boards />);
  await screen.findByRole('radio', { name: 'ShowMoa' });
  fireEvent.click(screen.getByRole('button', { name: '새 보드 생성' }));
  fireEvent.click(screen.getByRole('button', { name: '다음' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    '보드 생성 결과를 확인하고 기존 보드를 선택해 주세요',
  );
  await waitFor(() => expect(screen.getByRole('button', { name: '다음' })).toBeEnabled());
  expect(vi.mocked(apiFetch).mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(
    1,
  );
  expect(saved).not.toHaveBeenCalled();
});

it('creates with the existing NEW contract, keeps four fixed states, and preserves an existing draft across mode switches', async () => {
  respond();
  renderWithProviders(<Boards />);
  fireEvent.click(await screen.findByRole('radio', { name: 'ShowMoa' }));
  mapAll();
  fireEvent.click(screen.getByRole('button', { name: '새 보드 생성' }));
  for (const label of ['작업 전', '작업 진행', '작업 완료', '작업 정지'])
    expect(screen.getByRole('button', { name: `${label} 삭제` })).toBeDisabled();
  expect(screen.getByRole('button', { name: '저장소 추가' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '기존 보드 사용' }));
  expect(screen.getByRole('radio', { name: 'ShowMoa' })).toBeChecked();
  expect(screen.getByRole('combobox', { name: '대기' })).toHaveValue('TODO');
  fireEvent.click(screen.getByRole('button', { name: '새 보드 생성' }));
  fireEvent.click(screen.getByRole('button', { name: '다음' }));
  await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
  expect(apiFetch).toHaveBeenCalledWith(
    '/api/v1/user/teams/77/setup/board',
    expect.objectContaining({ method: 'POST', body: JSON.stringify({ mode: 'NEW' }) }),
  );
});

it('uses NEW when the authorized organization has no projects', async () => {
  vi.mocked(apiFetch).mockImplementation(async (_url, init) =>
    init?.method === 'POST' ? { boardId: 'PVT_new', name: 'Linker' } : { items: [] },
  );
  renderWithProviders(<Boards />);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '기존 보드 사용' })).toBeDisabled(),
  );
  expect(screen.getByRole('button', { name: '새 보드 생성' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  fireEvent.click(screen.getByRole('button', { name: '다음' }));
  await waitFor(() => expect(saved).toHaveBeenCalledWith({ boardId: 'PVT_new', name: 'Linker' }));
});

it('does not read or write without a team ID', () => {
  renderWithProviders(<Boards teamId={null} />);
  fireEvent.click(screen.getByRole('button', { name: '새 보드 생성' }));
  expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
  expect(apiFetch).not.toHaveBeenCalled();
});

it('blocks creation too when the server denies access to the team', async () => {
  vi.mocked(apiFetch).mockRejectedValue(
    new ApiError(403, { code: 'FORBIDDEN', message: '팀 권한을 확인해 주세요' }),
  );
  renderWithProviders(<Boards />);
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: '새 보드 생성' }));
  expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
  expect(saved).not.toHaveBeenCalled();
});
