import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiFetch } from '@/lib/api/api-fetch';
import { renderWithProviders } from '@/test/render-with-providers';
import type { TeamSettings } from '../../_lib/settings-queries';
import { TeamSettingsHeaderAction, TeamSettingsView } from './TeamSettingsView';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
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
function renderSettings(value = team) {
  vi.mocked(apiFetch).mockImplementation(async (url, init) => {
    if (init?.method && init.method !== 'GET') return undefined as never;
    if (url.endsWith('/settings')) return value as never;
    if (url.endsWith('/members'))
      return {
        items: [
          {
            userId: 1,
            handle: 'owner',
            name: '오너',
            avatarUrl: null,
            role: 'OWNER',
            githubOrgStatus: 'MEMBER',
            joinedAt: '2026-11-01T00:00:00Z',
          },
        ],
        count: 1,
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
});

it('renders the actual server response with nullable avatar/board and no deferred fields or invite API', async () => {
  renderSettings();
  expect(await screen.findByText('오너 @owner')).toBeVisible();
  expect(screen.getByRole('button', { name: '초대 링크 복사' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '팀 초대' })).toBeDisabled();
  expect(vi.mocked(apiFetch).mock.calls.map(([url]) => url)).not.toContain(
    '/api/v1/user/teams/1/invite-links',
  );
  await userEvent.click(screen.getByRole('button', { name: '팀 정보 편집' }));
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

it('does not allow write actions on a read-only team even with stale permission flags', async () => {
  renderSettings({ ...team, status: 'READ_ONLY' });
  await screen.findByText('오너 @owner');
  expect(screen.getByRole('button', { name: '팀 정보 편집' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '팀 삭제' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '저장소 추가' })).toBeDisabled();
});
