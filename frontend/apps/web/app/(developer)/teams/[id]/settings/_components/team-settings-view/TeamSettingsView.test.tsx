import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api/api-fetch';
import { resetOverlayHistory } from '@/lib/navigation/use-overlay';
import { renderWithProviders } from '@/test/render-with-providers';
import type { TeamSettings, ServerMembers } from '../../_lib/settings-queries';
import { TeamSettingsHeaderAction, TeamSettingsView } from './TeamSettingsView';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const replace = vi.fn();
const team: TeamSettings = {
  id: 1,
  name: '서버 팀',
  description: '소개',
  orgLogin: 'org',
  orgAvatarUrl: '',
  status: 'ACTIVE',
  plan: 'FREE',
  myRole: 'OWNER',
  permissions: {
    editInfo: true,
    manageRepos: true,
    createInviteLink: false,
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
const ownerRow: ServerMembers['items'][number] = {
  userId: 1,
  handle: 'owner',
  name: '오너',
  avatarUrl: null,
  role: 'OWNER',
  githubOrgStatus: 'MEMBER',
  joinedAt: '2026-11-01T00:00:00Z',
  githubLogin: 'owner',
};
function renderSettings(
  value = team,
  rows = [ownerRow],
  write?: (url: string, init: Parameters<typeof apiFetch>[1]) => Promise<unknown>,
) {
  vi.mocked(apiFetch).mockImplementation(async (url, init) => {
    if (init?.method && init.method !== 'GET') return write?.(url, init) as never;
    if (url.endsWith('/settings')) return value as never;
    if (url.endsWith('/members'))
      return {
        items: rows,
        count: rows.length,
        limit: 6,
      } as never;
    throw new Error(`Unexpected endpoint: ${url}`);
  });
  return renderWithProviders(
    <>
      <TeamSettingsHeaderAction teamId="1" />
      <TeamSettingsView teamId="1" />
    </>,
    { viewer: { role: 'developer', status: 'ACTIVE' } },
  );
}
beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  replace.mockReset();
  resetOverlayHistory();
  vi.mocked(useRouter).mockReturnValue({
    bfcacheId: '',
    push: vi.fn(),
    replace,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  });
});

it('renders the actual server response with nullable avatar/board and no deferred fields or invite API', async () => {
  renderSettings();
  expect(await screen.findByText('오너 @owner')).toBeVisible();
  expect(screen.getByRole('button', { name: '초대 링크 복사' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '팀 초대' })).toBeDisabled();
  expect(vi.mocked(apiFetch).mock.calls.map(([url]) => url)).not.toContain(
    '/api/v1/user/teams/1/invite-links',
  );
  await userEvent.click(screen.getByRole('button', { name: '팀 설정' }));
  await userEvent.click(await screen.findByRole('button', { name: '팀 정보 편집' }));
  await userEvent.clear(await screen.findByLabelText('팀 소개'));
  await userEvent.type(screen.getByLabelText('팀 소개'), '수정 소개');
  await userEvent.click(screen.getByRole('button', { name: '저장' }));
  expect(apiFetch).toHaveBeenCalledWith(
    '/api/v1/user/teams/1',
    expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ name: '서버 팀', description: '수정 소개' }),
    }),
  );
});

it('keeps settings readable but hides write actions on a read-only team with stale flags', async () => {
  renderSettings({ ...team, status: 'READ_ONLY' });
  await screen.findByText('오너 @owner');
  expect(screen.getByRole('button', { name: '팀 삭제' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '저장소 추가' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: '팀 설정' }));
  expect(await screen.findByRole('dialog', {name:'팀 설정'})).toBeVisible();
  expect(screen.queryByRole('button', {name:'팀 정보 편집'})).not.toBeInTheDocument();
  expect(screen.getByRole('button', {name:'플랜 보기'})).toBeEnabled();
});

it('connects the actual delete button to typed confirmation and waits for server success', async () => {
  let finish!: (value: undefined) => void;
  const write = vi.fn(
    () =>
      new Promise<undefined>((resolve) => {
        finish = resolve;
      }),
  );
  renderSettings(team, [ownerRow], write);
  await userEvent.click(await screen.findByRole('button', { name: '팀 삭제' }));
  const dialog = screen.getByRole('alertdialog', { name: '팀 삭제' });
  const confirm = within(dialog).getByRole('button', { name: '삭제하기' });
  expect(confirm).toBeDisabled();
  await userEvent.type(screen.getByLabelText('확인을 위해 팀 이름을 입력해 주세요'), team.name);
  resetOverlayHistory(); // nuqs' testing adapter does not consume history.back().
  await userEvent.dblClick(confirm);
  expect(write).toHaveBeenCalledTimes(1);
  expect(write).toHaveBeenCalledWith(
    '/api/v1/user/teams/1',
    expect.objectContaining({ method: 'DELETE', body: JSON.stringify({ confirmName: team.name }) }),
  );
  expect(confirm).toBeDisabled();
  expect(replace).not.toHaveBeenCalled();
  await userEvent.click(within(dialog).getByRole('button', { name: '닫기' }));
  expect(dialog).toBeVisible();
  await act(async () => finish(undefined));
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/workspace'));
});

it('keeps a failed deletion open with the server error', async () => {
  renderSettings(team, [ownerRow], async () => {
    throw new Error('서버가 삭제를 거절했어요');
  });
  await userEvent.click(await screen.findByRole('button', { name: '팀 삭제' }));
  await userEvent.type(screen.getByLabelText('확인을 위해 팀 이름을 입력해 주세요'), team.name);
  await userEvent.click(screen.getByRole('button', { name: '삭제하기' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('서버가 삭제를 거절했어요');
  expect(screen.getByRole('alertdialog')).toBeVisible();
  expect(replace).not.toHaveBeenCalled();
});

const memberTeam: TeamSettings = {
  ...team,
  myRole: 'MEMBER',
  permissions: {
    ...team.permissions,
    deleteTeam: false,
    changeRoles: false,
    manageMembers: false,
    leave: true,
  },
};

it('submits a single leave request from the member confirmation then replaces navigation', async () => {
  let finish!: (value: undefined) => void;
  const write = vi.fn(
    () =>
      new Promise<undefined>((resolve) => {
        finish = resolve;
      }),
  );
  renderSettings(memberTeam, [ownerRow], write);
  await userEvent.click(await screen.findByRole('button', { name: '팀 나가기' }));
  const dialog = screen.getByRole('alertdialog', { name: '팀 나가기' });
  resetOverlayHistory();
  await userEvent.dblClick(within(dialog).getByRole('button', { name: '팀 나가기' }));
  expect(write).toHaveBeenCalledTimes(1);
  expect(write).toHaveBeenCalledWith(
    '/api/v1/user/teams/1/members/me',
    expect.objectContaining({ method: 'DELETE' }),
  );
  expect(replace).not.toHaveBeenCalled();
  await userEvent.click(within(dialog).getByRole('button', { name: '취소하기' }));
  expect(dialog).toBeVisible();
  await act(async () => finish(undefined));
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/workspace'));
});

it('keeps a failed leave visible and does not navigate', async () => {
  renderSettings(memberTeam, [ownerRow], async () => {
    throw new Error('팀을 나가지 못했어요');
  });
  await userEvent.click(await screen.findByRole('button', { name: '팀 나가기' }));
  await userEvent.click(
    within(screen.getByRole('alertdialog')).getByRole('button', { name: '팀 나가기' }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent('팀을 나가지 못했어요');
  expect(replace).not.toHaveBeenCalled();
});

it('uses delegated owner permissions for admin rows and the delete button', async () => {
  renderSettings({ ...team, myRole: 'ADMIN' }, [
    ownerRow,
    { ...ownerRow, userId: 2, role: 'ADMIN', name: '관리자' },
  ]);
  expect(await screen.findByRole('button', { name: '관리자 관리' })).toBeEnabled();
  expect(screen.getByRole('button', { name: '팀 삭제' })).toBeEnabled();
});

it('keeps ordinary admins out of other admin rows and hides admin leave per Policy', async () => {
  renderSettings(
    {
      ...team,
      myRole: 'ADMIN',
      permissions: { ...team.permissions, changeRoles: false, deleteTeam: false, leave: true },
    },
    [ownerRow, { ...ownerRow, userId: 2, role: 'ADMIN', name: '관리자' }],
  );
  await screen.findByText('관리자 @owner');
  expect(screen.queryByRole('button', { name: '관리자 관리' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '팀 삭제' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '팀 나가기' })).not.toBeInTheDocument();
});

it('lets an authorized manager remove a member by ID when their account has no handle', async () => {
  const write = vi.fn(async () => undefined);
  renderSettings(
    team,
    [
      ownerRow,
      {
        ...ownerRow,
        userId: 2,
        role: 'MEMBER',
        name: '탈퇴한 사용자',
        handle: null,
        githubLogin: null,
      },
    ],
    write,
  );
  await userEvent.click(await screen.findByRole('button', { name: '탈퇴한 사용자 관리' }));
  expect(screen.queryByText(/@null/)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '팀에서 내보내기' }));
  await userEvent.click(await screen.findByRole('button', { name: '팀에서 내보내기' }));
  expect(write).toHaveBeenCalledWith(
    '/api/v1/user/teams/1/members/2',
    expect.objectContaining({ method: 'DELETE' }),
  );
});
