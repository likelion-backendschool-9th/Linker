import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { apiFetch } from '@/lib/api/api-fetch';
import { resetOverlayHistory } from '@/lib/navigation/use-overlay';
import { renderWithProviders } from '@/test/render-with-providers';

import type { MyTeam } from '../../_lib/team-queries';
import { TeamSwitcher } from './TeamSwitcher';

const push = vi.fn();
vi.mock('next/navigation', async (original) => ({
  ...(await original<typeof import('next/navigation')>()),
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));
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
  joinedAt: '2026-11-01T00:00:00Z',
};

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  push.mockReset();
  resetOverlayHistory();
});

it('the header team name opens the Figma "팀 변경" sheet with the current team checked', async () => {
  vi.mocked(apiFetch).mockResolvedValue({
    items: [team, { ...team, id: 2, name: '다른 프로젝트' }],
  });
  renderWithProviders(<TeamSwitcher teamId="1" name={team.name} />, {
    searchParams: '?overlay=team-switcher',
  });
  expect(await screen.findByRole('dialog', { name: '팀 변경' })).toBeVisible();
  expect(await screen.findByRole('radio', { name: '현재 프로젝트' })).toBeChecked();
  expect(screen.getByRole('radio', { name: '다른 프로젝트' })).not.toBeChecked();
  expect(screen.getByRole('button', { name: '팀 변경' })).toHaveAttribute('type', 'submit');
});

it('keeping the current team only closes the sheet and retains the filters', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ items: [team] });
  const onUrlUpdate = vi.fn();
  renderWithProviders(<TeamSwitcher teamId="1" name={team.name} />, {
    searchParams: '?status=TODO&overlay=team-switcher',
    onUrlUpdate,
  });
  await screen.findByRole('radio', { name: '현재 프로젝트' });
  await userEvent.click(screen.getByRole('button', { name: '팀 변경' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(onUrlUpdate).toHaveBeenLastCalledWith(
    expect.objectContaining({ queryString: '?status=TODO' }),
  );
  expect(push).not.toHaveBeenCalled();
});

it('another team goes to its entry: issues for live teams, chat history for archived ones', async () => {
  vi.mocked(apiFetch).mockResolvedValue({
    items: [
      team,
      { ...team, id: 2, name: '다른 프로젝트', chatRoomId: 20 },
      { ...team, id: 3, name: '보관한 프로젝트', status: 'ARCHIVED', chatRoomId: 30 },
    ],
  });
  const user = userEvent.setup();
  renderWithProviders(<TeamSwitcher teamId="1" name={team.name} />, {
    searchParams: '?overlay=team-switcher',
  });
  await user.click(await screen.findByRole('radio', { name: '보관한 프로젝트' }));
  await user.click(screen.getByRole('button', { name: '팀 변경' }));
  await waitFor(() => expect(push).toHaveBeenCalledWith('/chats/30'));
});

it('an archived team without a room cannot be chosen and says why', async () => {
  vi.mocked(apiFetch).mockResolvedValue({
    items: [
      team,
      { ...team, id: 3, name: '연결 전 보관 팀', status: 'ARCHIVED', chatRoomId: null },
    ],
  });
  renderWithProviders(<TeamSwitcher teamId="1" name={team.name} />, {
    searchParams: '?overlay=team-switcher',
  });
  expect(
    await screen.findByRole('radio', { name: /연결 전 보관 팀.*채팅방을 찾지 못했어요/ }),
  ).toBeDisabled();
});

it('a failed team query offers retry instead of a misleading empty list', async () => {
  vi.mocked(apiFetch).mockRejectedValue(new Error('unavailable'));
  renderWithProviders(<TeamSwitcher teamId="1" name={team.name} />, {
    searchParams: '?overlay=team-switcher',
  });
  expect(await screen.findByRole('alert')).toHaveTextContent('불러오지 못했어요');
  expect(screen.getByRole('button', { name: '다시 시도' })).toBeEnabled();
  expect(screen.queryByText('참여 중인 팀이 없어요.')).not.toBeInTheDocument();
});
