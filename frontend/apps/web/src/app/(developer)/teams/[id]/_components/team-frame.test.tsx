import { render, screen } from '@testing-library/react';

import { getTeam } from '../_lib/get-team';
import type { MyTeam } from '../_lib/team-queries';
import { TeamFrame } from './team-frame';

vi.mock('../_lib/get-team', () => ({ getTeam: vi.fn() }));
vi.mock('./team-switcher', () => ({
  TeamSwitcher: ({ name }: { name: string }) => <span>{name}</span>,
}));
vi.mock('./team-nav', () => ({ TeamNav: () => null }));
vi.mock('@/components/layout/page-frame', () => ({
  PageFrame: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

const team: MyTeam = {
  id: 1,
  name: '연결된 팀',
  status: 'ACTIVE',
  myRole: 'MEMBER',
  memberCount: 1,
  joinedAt: '2026-11-01T00:00:00Z',
  orgAvatarUrl: null,
  chatRoomId: null,
  plan: null,
  openIssueCount: null,
  unreadCount: null,
};

it('renders team pages without a broken avatar or chat link before chat membership exists', async () => {
  vi.mocked(getTeam).mockResolvedValue(team);
  render(await TeamFrame({ teamId: '1', title: '이슈', children: <p>이슈 목록</p> }));
  expect(screen.getByText('이슈 목록')).toBeVisible();
  expect(screen.queryByRole('link', { name: /팀 채팅/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});

it('links to the actual room and announces its unread count', async () => {
  vi.mocked(getTeam).mockResolvedValue({ ...team, chatRoomId: 91, unreadCount: 4 });
  render(await TeamFrame({ teamId: '1', title: '설정', children: <p>팀 설정</p> }));
  expect(
    screen.getByRole('link', { name: '팀 채팅으로 가기, 안 읽은 메시지 4개' }),
  ).toHaveAttribute('href', '/chats/91');
});
