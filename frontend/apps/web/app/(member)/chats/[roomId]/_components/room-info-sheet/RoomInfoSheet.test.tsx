import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';

import { apiFetch } from '@/lib/api/api-fetch';
import { renderWithProviders } from '@/test/render-with-providers';

import type { RoomInfo } from '../../_lib/room-api';
import { RoomInfoSheet } from './RoomInfoSheet';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const fetchMock = vi.mocked(apiFetch);
const push = vi.fn();

const direct: RoomInfo = {
  id: 10,
  kind: 'DIRECT',
  title: '도윤',
  requestDirection: null,
  muted: false,
  members: [
    { id: 1, login: 'me', name: '나', avatarUrl: null, role: null },
    { id: 2, login: 'doyun', name: '도윤', avatarUrl: null, role: null },
  ],
  team: null,
  historyLimitDays: null,
};
const team: RoomInfo = {
  ...direct,
  id: 3,
  kind: 'TEAM',
  title: '팀',
  members: [
    { id: 1, login: 'owner', name: '김재호', avatarUrl: null, role: 'OWNER' },
    { id: 2, login: 'member', name: '김덕수', avatarUrl: null, role: 'MEMBER' },
  ],
  team: { id: 7, name: 'RESULTOT', myRole: 'MEMBER', status: 'ACTIVE', avatarUrl: null },
};
const open = (id: number) => ({ searchParams: `?overlay=chat-info&oid=${id}` });

beforeEach(() => {
  fetchMock.mockReset();
  push.mockReset();
  vi.spyOn(window.history, 'back').mockImplementation(() => {
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  vi.mocked(useRouter).mockReturnValue({
    bfcacheId: 'test',
    push,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  });
});

it('shows the member count, the team card, members with their team role, and "팀 나가기" to team settings', async () => {
  renderWithProviders(<RoomInfoSheet room={team} login="member" disabled={false} />, open(3));
  const screenEl = await screen.findByRole('dialog', { name: '팀' });
  expect(within(screenEl).getByRole('heading', { name: '멤버 2명' })).toBeVisible();
  expect(within(screenEl).getByText('RESULTOT')).toBeVisible();
  expect(within(screenEl).queryByRole('link', { name: /RESULTOT/ })).not.toBeInTheDocument();
  const members = within(screenEl).getByRole('list', { name: '참여자' });
  expect(within(members).getByRole('link', { name: /김재호.*@owner.*오너/ })).toHaveAttribute(
    'href',
    '/user/owner',
  );
  expect(within(members).getByRole('link', { name: /김덕수.*@member.*멤버/ })).toBeVisible();
  expect(within(screenEl).getByRole('link', { name: '팀 나가기' })).toHaveAttribute(
    'href',
    '/teams/7/settings',
  );
  expect(within(screenEl).getByRole('button', { name: 'PR 보러 가기' })).toBeVisible();
  // Mute moved from a row to the header bell
  expect(within(screenEl).getByRole('button', { name: '알림 끄기' })).toBeVisible();
  expect(within(screenEl).queryByRole('button', { name: 'PR 목록' })).not.toBeInTheDocument();
  expect(within(screenEl).queryByRole('button', { name: '대화 나가기' })).not.toBeInTheDocument();
});

it('leaves a direct room after confirmation and returns to the chat list', async () => {
  fetchMock.mockResolvedValue(undefined);
  const user = userEvent.setup();
  renderWithProviders(<RoomInfoSheet room={direct} login="me" disabled={false} />, open(10));
  await user.click(await screen.findByRole('button', { name: '대화 나가기' }));
  expect(fetchMock).not.toHaveBeenCalled();
  expect(await screen.findByRole('heading', { name: '대화에서 나갈까요?' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: '나가기' }));
  await waitFor(() => expect(push).toHaveBeenCalledWith('/chats'));
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/user/chat-rooms/10/members/me', {
    method: 'DELETE',
  });
});

it('keeps the confirmation open when leaving fails', async () => {
  fetchMock.mockRejectedValue(new Error('offline'));
  const user = userEvent.setup();
  renderWithProviders(<RoomInfoSheet room={direct} login="me" disabled={false} />, open(10));
  await user.click(await screen.findByRole('button', { name: '대화 나가기' }));
  await user.click(await screen.findByRole('button', { name: '나가기' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('대화에서 나가지 못했어요');
  expect(push).not.toHaveBeenCalled();
});
