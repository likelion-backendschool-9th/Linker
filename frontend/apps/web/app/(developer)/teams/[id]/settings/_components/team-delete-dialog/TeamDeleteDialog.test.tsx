import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiFetch } from '@/lib/api/api-fetch';
import { resetOverlayHistory } from '@/lib/navigation/use-overlay';
import { renderWithProviders } from '@/test/render-with-providers';
import type { TeamSettings } from './api';
import { TeamDeleteDialog } from './TeamDeleteDialog';
vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const team: TeamSettings = {
  id: 1,
  name: '삭제할 팀',
  description: null,
  orgLogin: 'org',
  orgAvatarUrl: null,
  status: 'ACTIVE',
  plan: 'FREE',
  myRole: 'OWNER',
  permissions: {
    editInfo: true,
    manageRepos: true,
    createInviteLink: true,
    manageMembers: true,
    changeRoles: true,
    transferOwnership: false,
    completeProject: false,
    archive: true,
    deleteTeam: true,
    leave: false,
  },
  repos: [],
  board: null,
  aiSummaryEnabled: false,
  memberLimit: 6,
  billing: { managerName: null, canManage: false, nextAmount: null, nextBillingAt: null },
};
function renderDialog(value = team) {
  return renderWithProviders(<TeamDeleteDialog team={value} />, {
    viewer: { role: 'developer', status: 'ACTIVE' },
    searchParams: '?overlay=team-delete',
  });
}
beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  resetOverlayHistory();
});

it('keeps the centered alert dialog and requires the exact name; failure stays visible', async () => {
  vi.mocked(apiFetch).mockRejectedValue(new Error('팀 이름을 다시 확인해 주세요'));
  renderDialog();
  expect(screen.getByRole('alertdialog', { name: '팀 삭제' })).toBeVisible();
  const submit = screen.getByRole('button', { name: '삭제하기' });
  expect(submit).toBeDisabled();
  const input = screen.getByLabelText('확인을 위해 팀 이름을 입력해 주세요');
  await userEvent.type(input, '다른 팀');
  expect(submit).toBeDisabled();
  await userEvent.clear(input);
  await userEvent.type(input, team.name);
  await userEvent.click(submit);
  expect(apiFetch).toHaveBeenCalledWith(
    '/api/v1/user/teams/1',
    expect.objectContaining({ method: 'DELETE', body: JSON.stringify({ confirmName: team.name }) }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent('팀 이름을 다시 확인해 주세요');
  expect(screen.getByRole('alertdialog')).toBeVisible();
});

it('sends only one pending delete and closes only after success', async () => {
  let finish!: (value: undefined) => void;
  vi.mocked(apiFetch).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  renderDialog();
  await userEvent.type(screen.getByLabelText('확인을 위해 팀 이름을 입력해 주세요'), team.name);
  await userEvent.dblClick(screen.getByRole('button', { name: '삭제하기' }));
  expect(apiFetch).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: '삭제하기' })).toBeDisabled();
  await act(async () => finish(undefined));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
});

it('rejects a forged delete overlay for members without issuing an API request', () => {
  renderDialog({
    ...team,
    myRole: 'MEMBER',
    permissions: { ...team.permissions, deleteTeam: false },
  });
  expect(screen.getByText('현재 역할이나 팀 상태에서는 변경할 수 없어요.')).toBeVisible();
  expect(screen.queryByRole('button', { name: '삭제하기' })).not.toBeInTheDocument();
  expect(apiFetch).not.toHaveBeenCalled();
});
