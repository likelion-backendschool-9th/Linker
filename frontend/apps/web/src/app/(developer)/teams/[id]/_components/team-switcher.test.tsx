import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiFetch } from '@/lib/api/api-fetch';
import { resetOverlayHistory } from '@/lib/navigation/use-overlay';
import { renderWithProviders } from '@/test/render-with-providers';
import type { MyTeam } from '../_lib/team-queries';
import { TeamSwitcher } from './team-switcher';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const team: MyTeam = {
  id: 1,
  name: '현재 프로젝트',
  orgAvatarUrl: 'https://avatars.githubusercontent.com/u/1',
  status: 'ACTIVE',
  plan: 'FREE',
  myRole: 'OWNER',
  memberCount: 3,
  openIssueCount: 2,
  chatRoomId: 10,
  unreadCount: 0,
};
beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  resetOverlayHistory();
});

it('selecting the current team closes the sheet, retains filters, and restores the trigger focus', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ items: [team] });
  const onUrlUpdate = vi.fn();
  renderWithProviders(<TeamSwitcher teamId="1" name={team.name} />, {
    searchParams: '?status=TODO&overlay=team-switcher',
    onUrlUpdate,
  });
  await userEvent.click(await screen.findByRole('button', { name: /현재 프로젝트.*현재 팀/ }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByRole('button', { name: '현재 프로젝트 팀 전환' })).toHaveFocus();
  expect(onUrlUpdate).toHaveBeenLastCalledWith(
    expect.objectContaining({ queryString: '?status=TODO' }),
  );
});

it('archived entries link to chat history and other live teams link to issues', async () => {
  vi.mocked(apiFetch).mockResolvedValue({
    items: [
      team,
      { ...team, id: 2, name: '다른 프로젝트', chatRoomId: 20 },
      { ...team, id: 3, name: '보관한 프로젝트', status: 'ARCHIVED', chatRoomId: 30 },
    ],
  });
  renderWithProviders(<TeamSwitcher teamId="1" name={team.name} />, {
    searchParams: '?overlay=team-switcher',
  });
  expect(await screen.findByRole('link', { name: /보관한 프로젝트.*보관됨/ })).toHaveAttribute(
    'href',
    '/chats/30',
  );
  expect(screen.getByRole('link', { name: /다른 프로젝트/ })).toHaveAttribute(
    'href',
    '/teams/2/issues',
  );
});

it('a failed team query offers retry and a workspace exit instead of a misleading empty list', async () => {
  vi.mocked(apiFetch).mockRejectedValue(new Error('unavailable'));
  renderWithProviders(<TeamSwitcher teamId="1" name={team.name} />, {
    searchParams: '?overlay=team-switcher',
  });
  expect(await screen.findByRole('alert')).toHaveTextContent('불러오지 못했어요');
  expect(screen.getByRole('button', { name: '다시 시도' })).toBeEnabled();
  expect(screen.getByRole('link', { name: '워크스페이스로 가기' })).toHaveAttribute(
    'href',
    '/workspace',
  );
  expect(screen.queryByText('참여 중인 팀이 없어요.')).not.toBeInTheDocument();
});
