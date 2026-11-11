import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { apiFetch } from '@/lib/api/api-fetch';
import { renderWithProviders } from '@/test/render-with-providers';
import type { MyTeam } from './api';
import { WorkspaceView } from './WorkspaceView';

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
  joinedAt: '2026-11-01T00:00:00Z',
});
function stubTeams(
  items: MyTeam[],
  teamCount = items.filter((t) => t.status !== 'ARCHIVED').length,
) {
  vi.mocked(apiFetch).mockImplementation(async (url: string) =>
    url === '/api/v1/user/me/teams'
      ? { items, teamLimit: 10, teamCount, nextCursor: null }
      : { teamId: 1, items: [] },
  );
}
beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
});

it('retains the full-list handoff and retry when the team service fails without querying issues', async () => {
  vi.mocked(apiFetch).mockRejectedValue(new Error('unavailable'));
  renderWithProviders(<WorkspaceView />);
  await screen.findByRole('alert');
  expect(screen.getByRole('link', { name: '내 이슈 전체 보기' })).toHaveAttribute(
    'href',
    '/workspace/issues',
  );
  expect(vi.mocked(apiFetch).mock.calls.every(([url]) => url === '/api/v1/user/me/teams')).toBe(
    true,
  );
});

it('keeps the documented empty-team destinations without the retired prose or statistics action', async () => {
  stubTeams([]);
  renderWithProviders(<WorkspaceView />);
  expect(await screen.findByText('아직 함께하는 팀이 없어요.')).toBeVisible();
  expect(screen.getByRole('link', { name: '팀 찾으러 가기' })).toHaveAttribute('href', '/recruits');
  expect(
    screen
      .getAllByRole('link', { name: '팀 만들기' })
      .every((a) => a.getAttribute('href') === '/teams/new'),
  ).toBe(true);
  expect(screen.queryByRole('link', { name: '내 통계' })).not.toBeInTheDocument();
});

it('uses server membership count for the creation limit even when the selected status has no rows', async () => {
  stubTeams([team(1, 'COMPLETED')], 10);
  renderWithProviders(<WorkspaceView />);
  await screen.findByText('이 상태의 팀이 없어요.');
  expect(screen.queryByRole('link', { name: '팀 만들기' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '팀 만들기' })).toBeDisabled();
});

it('shows the four design tabs and switches only the rows, leaving the chosen issue team alone', async () => {
  stubTeams([team(1, 'ACTIVE'), team(2, 'COMPLETED'), team(3, 'READ_ONLY'), team(4, 'ARCHIVED')]);
  renderWithProviders(<WorkspaceView />, { searchParams: '?teamId=1' });
  const tabs = await screen.findByRole('group', { name: '팀 상태 필터' });
  expect(within(tabs).getAllByRole('button')).toHaveLength(4);
  expect(within(tabs).getByRole('button', { name: '활성 1' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(screen.getByRole('article', { name: '프로젝트 1' })).toBeVisible();
  fireEvent.click(within(tabs).getByRole('button', { name: '읽기 전용 1' }));
  expect(await screen.findByRole('article', { name: '프로젝트 3' })).toBeVisible();
  expect(screen.queryByRole('article', { name: '프로젝트 1' })).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '내 프로젝트 1 팀의 이슈' })).toBeVisible();
});

it('excludes archived teams from the limit and routes them to chat history', async () => {
  stubTeams([team(1, 'ARCHIVED')], 0);
  renderWithProviders(<WorkspaceView />, { searchParams: '?status=ARCHIVED' });
  const card = await screen.findByRole('article', { name: '프로젝트 1' });
  expect(within(card).getByRole('link')).toHaveAttribute('href', '/chats/1');
  expect(screen.getByRole('link', { name: '팀 만들기' })).toHaveAttribute('href', '/teams/new');
});

it('never invents avatars, Free plan limits, dates or chat links for missing server fields', async () => {
  stubTeams([{ ...team(1, 'ARCHIVED'), orgAvatarUrl: null, chatRoomId: null, plan: null }]);
  const { container } = renderWithProviders(<WorkspaceView />, {
    searchParams: '?status=ARCHIVED',
  });
  const card = await screen.findByRole('article', { name: '프로젝트 1' });
  expect(within(card).queryByRole('link')).not.toBeInTheDocument();
  expect(within(card).queryByRole('img')).not.toBeInTheDocument();
  expect(card).toHaveTextContent('멤버 3');
  expect(card).not.toHaveTextContent('/6');
  expect(container.textContent).not.toMatch(/년.*월.*까지/);
  expect(await axe(container)).toHaveNoViolations();
});

it('shows the policy Free cap without treating Flex as capped', async () => {
  stubTeams([team(1, 'ACTIVE'), { ...team(2, 'ACTIVE'), plan: 'FLEX' }]);
  renderWithProviders(<WorkspaceView />);
  expect(await screen.findByRole('article', { name: '프로젝트 1' })).toHaveTextContent('멤버 3/6');
  const flex = screen.getByRole('article', { name: '프로젝트 2' });
  expect(flex).toHaveTextContent('멤버 3');
  expect(flex).not.toHaveTextContent('/6');
});

it('preserves an explicit valid team when handing off to C', async () => {
  stubTeams([team(42, 'ACTIVE')]);
  renderWithProviders(<WorkspaceView />, { searchParams: '?teamId=42' });
  expect(await screen.findByRole('link', { name: '내 이슈 전체 보기' })).toHaveAttribute(
    'href',
    '/workspace/issues?teamId=42',
  );
});

it('keeps issue creation for an active issue team', async () => {
  stubTeams([team(1, 'ACTIVE'), team(3, 'READ_ONLY')]);
  renderWithProviders(<WorkspaceView />, { searchParams: '?teamId=1' });
  expect(await screen.findByRole('link', { name: '이슈 작성' })).toHaveAttribute(
    'href',
    '/teams/1/issues/new',
  );
});

it('hides issue creation for a read-only issue team', async () => {
  stubTeams([team(1, 'ACTIVE'), team(3, 'READ_ONLY')]);
  cleanup();
  renderWithProviders(<WorkspaceView />, { searchParams: '?teamId=3' });
  expect(await screen.findByRole('heading', { name: '내 프로젝트 3 팀의 이슈' })).toBeVisible();
  expect(screen.queryByRole('link', { name: '이슈 작성' })).not.toBeInTheDocument();
});

it('hides issue creation for an archived issue team', async () => {
  stubTeams([team(1, 'ACTIVE'), team(4, 'ARCHIVED')]);
  cleanup();
  renderWithProviders(<WorkspaceView />, { searchParams: '?teamId=4' });
  expect(await screen.findByRole('heading', { name: '내 프로젝트 4 팀의 이슈' })).toBeVisible();
  expect(screen.queryByRole('link', { name: '이슈 작성' })).not.toBeInTheDocument();
});
