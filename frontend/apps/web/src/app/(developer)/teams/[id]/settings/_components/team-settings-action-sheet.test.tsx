import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiFetch } from '@/lib/api/api-fetch';
import { resetOverlayHistory, useOverlay } from '@/lib/navigation/use-overlay';
import { renderWithProviders } from '@/test/render-with-providers';
import type { Members, TeamSettings } from '../_lib/settings-queries';
import { TeamSettingsActionSheet } from './team-settings-action-sheet';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const team: TeamSettings = {
  id: 1,
  name: '검토 팀',
  description: '소개',
  orgLogin: 'review-org',
  orgAvatarUrl: '',
  status: 'COMPLETED',
  plan: 'FREE',
  myRole: 'ADMIN',
  permissions: {
    editInfo: true,
    manageRepos: true,
    createInviteLink: true,
    manageMembers: true,
    changeRoles: false,
    transferOwnership: false,
    completeProject: true,
    archive: false,
    deleteTeam: false,
    leave: true,
  },
  repos: [],
  availableRepos: [],
  board: { id: 'b1', name: 'Linker', url: 'https://github.com' },
  aiSummaryEnabled: false,
  completedAt: '2026-11-01T00:00:00Z',
  memberLimit: 6,
  githubOrgOwner: false,
  githubInvitationBlockedReason: null,
  billing: { managerName: '오너', canManage: false, nextAmount: null, nextBillingAt: null },
  ownershipTransfer: null,
  ownershipClaim: null,
  completion: { canUndo: true, finalized: false, canRestart: false },
};
const member: Members['items'][number] = {
  user: { id: 2, login: 'other-admin', name: '다른 관리자', avatarUrl: '' },
  role: 'ADMIN',
  joinedAt: '2026-10-01',
  inGithubOrg: true,
  githubOrgStatus: 'MEMBER',
};
function renderSheet(value: TeamSettings, action: string, members: Members['items'] = []) {
  return renderWithProviders(<TeamSettingsActionSheet team={value} members={members} />, {
    viewer: { role: 'developer', login: 'me' },
    searchParams: `?overlay=team-settings-action&oid=${action}`,
  });
}
beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  resetOverlayHistory();
});

it('keeps the selected role and confirmation consistent when member management is reopened', async () => {
  const owner = {
    ...team,
    myRole: 'OWNER' as const,
    permissions: { ...team.permissions, changeRoles: true },
  };
  function Preview() {
    const overlay = useOverlay('team-settings-action');
    return (
      <>
        <button onClick={() => overlay.open('member:2')}>관리 다시 열기</button>
        <TeamSettingsActionSheet team={owner} members={[member]} />
      </>
    );
  }
  renderWithProviders(<Preview />, { searchParams: '?overlay=team-settings-action&oid=member:2' });
  await userEvent.selectOptions(screen.getByLabelText('팀 역할'), 'MEMBER');
  await userEvent.click(screen.getByRole('button', { name: '역할 변경 확인' }));
  expect(await screen.findByText(/다른 관리자님의 역할을 멤버로 변경해요/)).toBeVisible();
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: '관리 다시 열기' }));
  expect(await screen.findByLabelText('팀 역할')).toHaveValue('MEMBER');
  expect(apiFetch).not.toHaveBeenCalled();
});

it('shows undo only when the server allows it, with no mutation request', () => {
  renderSheet(team, 'undo-completion');
  expect(screen.getByRole('dialog', { name: '프로젝트 완료를 취소할까요?' })).toBeVisible();
  expect(screen.getByRole('button', { name: '완료 취소' })).toBeDisabled();
  expect(apiFetch).not.toHaveBeenCalled();
});

it('blocks a forged undo URL after finalization', () => {
  renderSheet(
    { ...team, completion: { canUndo: false, finalized: true, canRestart: true } },
    'undo-completion',
  );
  expect(screen.getByText('현재 역할이나 팀 상태에서는 변경할 수 없어요.')).toBeVisible();
  expect(screen.queryByRole('button', { name: '완료 취소' })).not.toBeInTheDocument();
});

it('an admin cannot remove another admin by opening its overlay URL', () => {
  renderSheet({ ...team, status: 'ACTIVE' }, 'remove:2', [member]);
  expect(screen.getByText('현재 역할이나 팀 상태에서는 변경할 수 없어요.')).toBeVisible();
});

it('a read-only team cannot query board candidates through a forged overlay', () => {
  renderSheet({ ...team, status: 'READ_ONLY' }, 'board');
  expect(screen.getByText('현재 역할이나 팀 상태에서는 변경할 수 없어요.')).toBeVisible();
  expect(apiFetch).not.toHaveBeenCalled();
});

it('ownership acceptance is reserved to the request recipient', () => {
  renderSheet(
    {
      ...team,
      status: 'ACTIVE',
      ownershipTransfer: { id: 1, fromName: '현재 오너', toName: '다른 사람', isRecipient: false },
    },
    'accept-transfer',
  );
  expect(screen.getByText('현재 역할이나 팀 상태에서는 변경할 수 없어요.')).toBeVisible();
});

it('server-approved succession has its own informational screen without assuming ownership', () => {
  renderSheet(
    {
      ...team,
      status: 'ACTIVE',
      ownershipClaim: { eligible: true, reason: '기존 오너가 장기간 활동하지 않았어요.' },
    },
    'claim',
  );
  expect(screen.getByRole('dialog', { name: '소유권 인수 안내' })).toBeVisible();
  expect(screen.queryByRole('button', { name: '저장' })).not.toBeInTheDocument();
  expect(apiFetch).not.toHaveBeenCalled();
});
