import { screen } from '@testing-library/react';
import { apiFetch } from '@/lib/api/api-fetch';
import { renderWithProviders } from '@/test/render-with-providers';
import type { MyTeam } from '../../teams/[id]/_lib/team-queries';
import { WorkspaceView } from './workspace-view';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const team = (id: number, status: MyTeam['status']): MyTeam => ({
  id,
  name: `프로젝트 ${id}`,
  orgAvatarUrl: 'https://avatars.githubusercontent.com/u/1',
  status,
  plan: 'FREE',
  myRole: 'MEMBER',
  memberCount: 3,
  openIssueCount: 2,
  chatRoomId: id,
  unreadCount: 0,
});
beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
});

it('keeps cross-owner entry links available when the team list fails without loading C data', async () => {
  vi.mocked(apiFetch).mockRejectedValue(new Error('team service unavailable'));
  renderWithProviders(<WorkspaceView />);
  await screen.findByRole('alert');
  expect(screen.getByRole('link', { name: '내 이슈 전체 보기' })).toHaveAttribute(
    'href',
    '/workspace/issues',
  );
  expect(screen.getByRole('link', { name: '내 통계' })).toHaveAttribute('href', '/me/stats');
  expect(vi.mocked(apiFetch).mock.calls.every(([url]) => url === '/api/v1/user/me/teams')).toBe(
    true,
  );
});

it('empty teams provide both documented navigation choices', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ items: [], teamLimit: 10, teamCount: 0 });
  renderWithProviders(<WorkspaceView />);
  expect(await screen.findByText('아직 함께하는 팀이 없어요.')).toBeVisible();
  expect(screen.getByRole('link', { name: '팀 찾으러 가기' })).toHaveAttribute('href', '/recruits');
});
it('the ten-team limit cannot be bypassed from an empty status filter', async () => {
  vi.mocked(apiFetch).mockResolvedValue({
    items: Array.from({ length: 10 }, (_, index) => team(index + 1, 'ACTIVE')),
    teamLimit: 10,
    teamCount: 10,
  });
  renderWithProviders(<WorkspaceView />, { searchParams: '?status=COMPLETED' });
  await screen.findByText('이 상태의 팀이 없어요.');
  expect(screen.queryByRole('link', { name: '팀 만들기' })).not.toBeInTheDocument();
  expect(
    screen
      .getAllByRole('button', { name: '팀 만들기' })
      .every((button) => button.hasAttribute('disabled')),
  ).toBe(true);
});
it('archived teams do not consume the membership limit and link only to chat history', async () => {
  vi.mocked(apiFetch).mockResolvedValue({
    items: [
      ...Array.from({ length: 9 }, (_, index) => team(index + 1, 'ACTIVE')),
      team(10, 'ARCHIVED'),
    ],
    teamLimit: 10,
    teamCount: 10,
  });
  renderWithProviders(<WorkspaceView />);
  expect(await screen.findByRole('link', { name: /프로젝트 10/ })).toHaveAttribute(
    'href',
    '/chats/10',
  );
  expect(screen.getByRole('link', { name: '팀 만들기' })).toHaveAttribute('href', '/teams/new');
});
it('read-only teams retain the readable team entry and an explicit status', async () => {
  vi.mocked(apiFetch).mockResolvedValue({
    items: [team(1, 'READ_ONLY')],
    teamLimit: 10,
    teamCount: 1,
  });
  renderWithProviders(<WorkspaceView />);
  expect(await screen.findByRole('link', { name: /프로젝트 1.*읽기 전용/ })).toHaveAttribute(
    'href',
    '/teams/1/issues',
  );
});
