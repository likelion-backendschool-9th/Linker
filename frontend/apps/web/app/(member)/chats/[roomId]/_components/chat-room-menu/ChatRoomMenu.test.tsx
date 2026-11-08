import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';

import { apiFetch } from '@/lib/api/api-fetch';
import { renderWithProviders } from '@/test/render-with-providers';

import type { RoomInfo } from '../../_lib/room-api';
import { ChatRoomMenu } from './ChatRoomMenu';

vi.mock('@/lib/api/api-fetch', () => ({ apiFetch: vi.fn() }));
const fetchMock = vi.mocked(apiFetch);
const push = vi.fn();

const direct: RoomInfo = {
  id: 10,
  kind: 'DIRECT',
  title: '도윤',
  requestDirection: null,
  muted: false,
  members: [],
  team: null,
  historyLimitDays: null,
};
const team: RoomInfo = {
  ...direct,
  id: 3,
  kind: 'TEAM',
  title: '팀',
  team: { id: 3, name: '팀', myRole: 'MEMBER', status: 'ACTIVE' },
};

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

it('leaves a direct room from the menu and returns to the chat list', async () => {
  fetchMock.mockResolvedValue(undefined);
  const user = userEvent.setup();
  renderWithProviders(<ChatRoomMenu room={direct} login="me" disabled={false} />);
  await user.click(screen.getByRole('button', { name: '채팅방 더보기' }));
  await user.click(await screen.findByRole('menuitem', { name: '대화 나가기' }));
  expect(fetchMock).not.toHaveBeenCalled();
  expect(await screen.findByRole('heading', { name: '대화에서 나갈까요?' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: '나가기' }));
  await waitFor(() => expect(push).toHaveBeenCalledWith('/chats'));
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/user/chat-rooms/10/members/me', { method: 'DELETE' });
});

it('keeps the confirmation open when leaving fails', async () => {
  fetchMock.mockRejectedValue(new Error('offline'));
  const user = userEvent.setup();
  renderWithProviders(<ChatRoomMenu room={direct} login="me" disabled={false} />);
  await user.click(screen.getByRole('button', { name: '채팅방 더보기' }));
  await user.click(await screen.findByRole('menuitem', { name: '대화 나가기' }));
  await user.click(await screen.findByRole('button', { name: '나가기' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('대화에서 나가지 못했어요');
  expect(push).not.toHaveBeenCalled();
});

it('does not offer leave in a team room menu', async () => {
  const user = userEvent.setup();
  renderWithProviders(<ChatRoomMenu room={team} login="me" disabled={false} />);
  await user.click(screen.getByRole('button', { name: '채팅방 더보기' }));
  expect(await screen.findByRole('menuitem', { name: '방 정보' })).toBeVisible();
  expect(screen.getByRole('menuitem', { name: 'PR 목록' })).toBeVisible();
  expect(screen.queryByRole('menuitem', { name: '대화 나가기' })).not.toBeInTheDocument();
});
