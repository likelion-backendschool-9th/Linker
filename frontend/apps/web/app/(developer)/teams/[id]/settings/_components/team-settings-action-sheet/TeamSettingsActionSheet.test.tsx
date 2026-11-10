import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiFetch } from '@/lib/api/api-fetch';
import { resetOverlayHistory, useOverlay } from '@/lib/navigation/use-overlay';
import { renderWithProviders } from '@/test/render-with-providers';
import type { Members, TeamSettings } from '../../_lib/settings-queries';
import { TeamSettingsActionSheet } from './TeamSettingsActionSheet';

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
  jobLabel: 'BE',
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

it('requires the exact team name before sending a delete request', async () => {
  vi.mocked(apiFetch).mockRejectedValue(new Error('삭제 요청을 다시 시도해 주세요.'));
  renderSheet(
    { ...team, status: 'ACTIVE', permissions: { ...team.permissions, deleteTeam: true } },
    'delete',
  );
  const confirm = screen.getByRole('button', { name: '확인' });
  expect(confirm).toBeDisabled();
  const input = screen.getByLabelText('확인을 위해 팀 이름을 입력해 주세요');
  await userEvent.type(input, '다른 팀');
  expect(confirm).toBeDisabled();
  await userEvent.clear(input);
  await userEvent.type(input, team.name);
  await userEvent.click(confirm);
  expect(apiFetch).toHaveBeenCalledWith(
    '/api/v1/user/teams/1',
    expect.objectContaining({
      method: 'DELETE',
      body: JSON.stringify({ confirmName: team.name }),
    }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent('삭제 요청을 다시 시도해 주세요.');
  expect(screen.getByRole('dialog')).toBeVisible();
});

it('sends the selected role through the existing member role API', async () => {
  vi.mocked(apiFetch).mockResolvedValue(undefined);
  const owner = {
    ...team,
    myRole: 'OWNER' as const,
    permissions: { ...team.permissions, changeRoles: true },
  };
  renderSheet(owner, 'member:2', [member]);
  await userEvent.selectOptions(screen.getByLabelText('팀 역할'), 'MEMBER');
  await userEvent.click(screen.getByRole('button', { name: '역할 변경 확인' }));
  await userEvent.click(await screen.findByRole('button', { name: '역할 변경' }));
  expect(apiFetch).toHaveBeenCalledWith(
    '/api/v1/user/teams/1/members/2/role',
    expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ role: 'MEMBER' }),
    }),
  );
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

it('disconnects using the cached ID while leaving the GitHub repository intact', async () => {
  vi.mocked(apiFetch).mockResolvedValue(undefined);
  renderSheet(
    { ...team, repos: [{ id: 41, githubRepoId: 9001, name: 'repo', fullName: 'org/repo' }] },
    'remove-repo:41',
  );
  await userEvent.click(screen.getByRole('button', { name: '확인' }));
  expect(apiFetch).toHaveBeenCalledWith('/api/v1/user/teams/1/repos/41', { method: 'DELETE' });
});

it('uses GitHub IDs for additions and cached IDs for removals when saving repo selection', async () => {
  vi.mocked(apiFetch).mockImplementation(async (_url, init) =>
    init?.method
      ? undefined
      : ({
          items: [
            { id: 9001, name: 'old', fullName: 'org/old', private: false },
            { id: 9002, name: 'new', fullName: 'org/new', private: false },
          ],
          notInstalledCount: null,
        } as never),
  );
  renderSheet(
    {
      ...team,
      myRole: 'OWNER',
      repos: [{ id: 41, githubRepoId: 9001, name: 'old', fullName: 'org/old' }],
    },
    'repos',
  );
  await userEvent.click(await screen.findByRole('checkbox', { name: 'org/old' }));
  await userEvent.click(screen.getByRole('checkbox', { name: 'org/new' }));
  await userEvent.click(screen.getByRole('button', { name: '저장' }));
  await waitFor(() =>
    expect(apiFetch).toHaveBeenCalledWith('/api/v1/user/teams/1/repos/41', { method: 'DELETE' }),
  );
  expect(apiFetch).toHaveBeenCalledWith(
    '/api/v1/user/teams/1/repos',
    expect.objectContaining({ method: 'POST', body: JSON.stringify({ repoId: 9002 }) }),
  );
});

it('does not repeat a pending request after a second click', async () => {
  vi.mocked(apiFetch).mockReturnValue(new Promise(() => {}));
  renderSheet(team, 'remove:2', [{ ...member, role: 'MEMBER' }]);
  const submit = screen.getByRole('button', { name: '팀에서 내보내기' });
  await userEvent.dblClick(submit);
  expect(apiFetch).toHaveBeenCalledTimes(1);
  expect(submit).toBeDisabled();
});

it('creates a link then notifies the typed Linker developer with that same code', async () => {
  vi.mocked(apiFetch).mockResolvedValueOnce({
    id: 51,
    code: 'created-code',
    expiresAt: '2026-11-17T00:00:00Z',
    createdBy: '오너',
  });
  vi.mocked(apiFetch).mockResolvedValueOnce(undefined);
  renderSheet(team, 'invite');
  const submit = screen.getByRole('button', { name: '초대' });
  expect(submit).toBeDisabled();
  await userEvent.type(screen.getByLabelText('GitHub 로그인'), '@new-member');
  await userEvent.click(submit);
  await waitFor(() =>
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/v1/user/teams/1/invite-links/51/notify',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ handle: 'new-member', code: 'created-code' }),
      }),
    ),
  );
});

it('uses the current member ID for GitHub invitations even when GitHub login differs from Linker handle', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ sent: true, status: 'PENDING' });
  renderSheet({ ...team, myRole: 'OWNER', githubOrgOwner: true }, 'github', [
    { ...member, githubLogin: 'actual-github-login', inGithubOrg: false },
  ]);
  await userEvent.type(screen.getByLabelText('GitHub 로그인'), 'actual-github-login');
  await userEvent.click(screen.getByRole('button', { name: '초대' }));
  expect(apiFetch).toHaveBeenCalledWith('/api/v1/user/teams/1/members/2/github-invitation', {
    method: 'POST',
  });
});

it('retains an upstream invitation error without announcing success or closing the sheet', async () => {
  vi.mocked(apiFetch).mockRejectedValue(new Error('오늘은 GitHub 초대를 더 보낼 수 없어요'));
  renderSheet({ ...team, myRole: 'OWNER', githubOrgOwner: true }, 'github:2', [member]);
  await userEvent.click(screen.getByRole('button', { name: '초대' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    '오늘은 GitHub 초대를 더 보낼 수 없어요',
  );
  expect(screen.getByRole('dialog')).toBeVisible();
});

it('starts a fresh invitation after success so deliberate re-invites are not suppressed', async () => {
  let linkId = 60;
  vi.mocked(apiFetch).mockImplementation(async (url, init) => {
    if (url.endsWith('/notify')) return undefined as never;
    if (init?.method === 'POST')
      return {
        id: ++linkId,
        code: `link-${linkId}`,
        expiresAt: '2099-01-01T00:00:00Z',
        createdBy: '오너',
      } as never;
    return { items: [] } as never;
  });
  function Preview() {
    const overlay = useOverlay('team-settings-action');
    return (
      <>
        <button onClick={() => overlay.open('invite')}>새 초대</button>
        <TeamSettingsActionSheet team={team} members={[]} />
      </>
    );
  }
  renderWithProviders(<Preview />, {
    viewer: { role: 'developer', login: 'me' },
    searchParams: '?overlay=team-settings-action&oid=invite',
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) await userEvent.click(screen.getByRole('button', { name: '새 초대' }));
    // The nuqs memory adapter does not consume window.history.back().
    resetOverlayHistory();
    await userEvent.type(await screen.findByLabelText('GitHub 로그인'), '@same-person');
    await userEvent.click(screen.getByRole('button', { name: '초대' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  }
  const urls = vi.mocked(apiFetch).mock.calls.map(([url]) => url);
  expect(urls).toContain('/api/v1/user/teams/1/invite-links/61/notify');
  expect(urls).toContain('/api/v1/user/teams/1/invite-links/62/notify');
});
